"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/ds";
import type { LandingBanks as LandingBanksData, LandingDeal } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("en-US");

function OfferBadge({ offer, className }: { offer: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-primary px-2.5 py-1 text-data font-bold leading-4 text-primary-foreground",
        className,
      )}
    >
      {offer}
    </span>
  );
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
  const more = data.totalBanks - data.banks.length;

  return (
    <Section tone="cream" size="md" className="py-9" aria-labelledby="landing-banks">
      <Container className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-12">
        <div className="min-w-0 lg:flex-[4_1_380px]">
          <Image
            src="/assets/icons/saved-deals.png"
            alt=""
            width={56}
            height={56}
            className="h-10 w-10 rotate-6 lg:h-14 lg:w-14"
          />
          <h2
            id="landing-banks"
            className="mt-2.5 text-[26px] font-bold leading-8 tracking-[-0.03em] lg:mt-4 lg:text-[44px] lg:leading-[48px]"
          >
            Your card already has a discount
          </h2>
          <p className="mt-2 text-[15px] leading-[22px] lg:mt-3.5 lg:text-body-lg">
            {fmt(data.totalOffers)} live offers from {data.totalBanks} banks. Pick yours
            <span className="hidden lg:inline"> to see where it works</span>.
          </p>

          <div role="group" aria-label="Pick your bank" className="mt-4 grid grid-cols-2 gap-2 lg:mt-6 lg:gap-2.5">
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
          {more > 0 && (
            <Link
              href="/listings?deals=true"
              className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-small font-semibold transition-colors duration-fast hover:text-primary lg:mt-3 lg:gap-2 lg:text-[15px]"
            >
              {more} more banks
              <ArrowRight className="h-4 w-4 lg:h-[18px] lg:w-[18px]" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="min-w-0 rounded-container bg-card p-3.5 lg:flex-[7_1_560px] lg:p-6" aria-live="polite">
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
                <span className="relative block">
                  <DealPhoto deal={lead} sizes="100vw" className="aspect-video w-full rounded-media" />
                  <OfferBadge offer={lead.offer} className="absolute left-2.5 top-2.5" />
                </span>
                <span className="mt-2.5 block text-[17px] font-bold leading-[22px]">{lead.merchant}</span>
                {lead.meta && <span className="block text-data text-muted-foreground">{lead.meta}</span>}
              </Link>
              <ul className="mt-3 flex flex-col gap-3">
                {rest.map((d) => (
                  <li key={d.id}>
                    <Link href={d.href} className="flex items-center gap-3">
                      <DealPhoto deal={d} sizes="88px" className="h-[66px] w-[88px] shrink-0 rounded-media" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold leading-5">{d.merchant}</span>
                        {d.meta && <span className="block truncate text-label text-muted-foreground">{d.meta}</span>}
                      </span>
                      <OfferBadge offer={d.offer} className="shrink-0" />
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
                  <span className="relative block overflow-hidden rounded-media">
                    <DealPhoto
                      deal={d}
                      sizes="240px"
                      className="aspect-[4/3] w-full transition-transform duration-slow ease-standard group-hover:scale-[1.03] motion-reduce:transition-none"
                    />
                    <OfferBadge offer={d.offer} className="absolute left-2.5 top-2.5" />
                  </span>
                  <span className="mt-2.5 block truncate text-body font-bold leading-[22px]">{d.merchant}</span>
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
      </Container>
    </Section>
  );
}
