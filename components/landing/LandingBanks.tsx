"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container, Section } from "@/components/ds";
import { SectionHeader } from "@/components/landing/SectionHeader";
import type { LandingBanks as LandingBanksData, LandingDeal } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");

/** The discount comes first, at text size, as on /discounts (no badges on deal cards). */
function Offer({ offer, className }: { offer: string; className?: string }) {
  return <span className={cn("block text-small font-semibold leading-5 lg:text-[15px]", className)}>{offer}</span>;
}

function DealPhoto({ deal, className, sizes }: { deal: LandingDeal; className: string; sizes: string }) {
  return deal.image ? (
    <Image src={deal.image} alt="" width={640} height={480} sizes={sizes} className={cn("block object-cover", className)} />
  ) : (
    <span className={cn("block bg-muted", className)} />
  );
}

/**
 * "Your card already has a discount", on cream: pick one of the six banks
 * with the most offers and see its best three places, then all its offers.
 */
export function LandingBanks({ data }: { data: LandingBanksData }) {
  const [selectedId, setSelectedId] = useState(data.banks[0]?.id);
  if (data.banks.length === 0) return null;

  const bank = data.banks.find((b) => b.id === selectedId) ?? data.banks[0];
  const [lead, ...rest] = bank.deals;

  return (
    <Section tone="cream" size="md" aria-labelledby="landing-banks">
      <Container>
        <SectionHeader
          id="landing-banks"
          eyebrow="Bank discounts"
          title="Your card already has a discount"
          subline={`${fmt(data.totalOffers)} live offers from ${data.totalBanks} banks. Pick yours to see where it works.`}
          action={{ href: "/discounts", label: "All discounts" }}
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-8">
          {/* Two columns on phones; one on desktop, so the list runs the panel's height. */}
          <div role="group" aria-label="Pick your bank" className="grid grid-cols-2 gap-2 lg:w-[340px] lg:shrink-0 lg:grid-cols-1 lg:gap-2.5">
            {data.banks.map((b) => {
              const on = b.id === bank.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(b.id)}
                  className={cn(
                    "flex h-14 w-full items-center gap-2.5 rounded-media px-3 text-left transition-colors duration-fast lg:h-16 lg:gap-3 lg:pl-3 lg:pr-4",
                    on ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-card/70",
                  )}
                >
                  {b.logo ? (
                    <Image
                      src={b.logo}
                      alt=""
                      width={36}
                      height={36}
                      className="h-[30px] w-[30px] shrink-0 rounded-control bg-white object-cover lg:h-9 lg:w-9"
                    />
                  ) : (
                    <span className="h-[30px] w-[30px] shrink-0 rounded-control bg-muted lg:h-9 lg:w-9" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold leading-[18px] lg:text-[15px] lg:leading-5">
                      {b.name}
                    </span>
                    <span
                      className={cn(
                        "block text-label lg:text-data",
                        on ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      {fmt(b.offers)} offers
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 flex-1 rounded-container bg-card p-3.5 lg:p-6" aria-live="polite">
            <p className="text-small lg:text-body">
              <strong>With {bank.name} cards</strong>{" "}
              <span className="text-muted-foreground">
                · {fmt(bank.offers)} offers<span className="hidden lg:inline"> at {fmt(bank.places)} places</span>
              </span>
            </p>

            {/* Phones: one big deal, then two rows. */}
            {lead && (
              <div className="lg:hidden">
                <Link href={lead.href} className="mt-3 block">
                  <DealPhoto deal={lead} sizes="100vw" className="aspect-video w-full rounded-media" />
                  <Offer offer={lead.offer} className="mt-2.5" />
                  <span className="block text-[17px] font-bold leading-[22px]">{lead.merchant}</span>
                  {lead.meta && <span className="block text-data text-muted-foreground">{lead.meta}</span>}
                </Link>
                <ul className="mt-3 flex flex-col gap-3">
                  {rest.map((d) => (
                    <li key={d.id}>
                      <Link href={d.href} className="flex items-center gap-3">
                        <DealPhoto deal={d} sizes="88px" className="h-[66px] w-[88px] shrink-0 rounded-media" />
                        <span className="min-w-0 flex-1">
                          <Offer offer={d.offer} />
                          <span className="block truncate text-[15px] font-bold leading-5">{d.merchant}</span>
                          {d.meta && <span className="block truncate text-label text-muted-foreground">{d.meta}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Desktop: three cards. */}
            <ul className="mt-4 hidden grid-cols-3 gap-4 lg:grid">
              {bank.deals.map((d) => (
                <li key={d.id} className="min-w-0">
                  <Link href={d.href} className="group block">
                    <span className="block overflow-hidden rounded-media">
                      <DealPhoto
                        deal={d}
                        sizes="260px"
                        className="aspect-[4/3] w-full transition-transform duration-slow ease-standard group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    </span>
                    <Offer offer={d.offer} className="mt-2.5" />
                    <span className="block truncate text-body font-bold leading-[22px]">{d.merchant}</span>
                    {d.meta && <span className="mt-0.5 block truncate text-data text-muted-foreground">{d.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={bank.href}
              className="mt-3.5 flex h-12 items-center justify-center rounded-full bg-primary px-4 text-center text-[15px] font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90 lg:mt-5 lg:h-[52px] lg:text-body"
            >
              See all {fmt(bank.offers)} {bank.short} offers
            </Link>
            <p className="mt-2 text-center text-label text-muted-foreground lg:mt-2.5 lg:text-data">
              Each bank sets its own terms.<span className="hidden lg:inline"> Check them before you pay.</span>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
