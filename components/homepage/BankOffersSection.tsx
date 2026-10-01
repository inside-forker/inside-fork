import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupportedBanks, type SupportedBank } from "@/lib/homepage/bank-offers";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

/**
 * The bank's mark on a white coin, as in the app's "Browse by bank" row.
 * White specifically (the logos are cut for white), and the mark is inset and
 * clipped round so a full-bleed square logo doesn't read as a tile on a circle.
 */
function BankCoin({ bank }: { bank: SupportedBank }) {
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border sm:h-[72px] sm:w-[72px] ${
        bank.logoUrl ? "bg-white" : "bg-muted"
      }`}
    >
      {bank.logoUrl ? (
        <span className="relative h-12 w-12 overflow-hidden rounded-full sm:h-14 sm:w-14">
          <Image
            src={bank.logoUrl}
            alt=""
            fill
            sizes="56px"
            className="object-contain"
          />
        </span>
      ) : (
        <span className="text-xs font-bold text-muted-foreground">
          {bank.name.substring(0, 3).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * Bank discounts: a row of every supported bank, each one opening the deals
 * list filtered to it.
 */
export async function BankOffersSection() {
  const banks = await getSupportedBanks();

  if (banks.length === 0) return null;

  // Desktop rows: as few as fit at most 10 per row, split evenly, so 18 banks
  // become 9 + 9 rather than 12 + 6. The row is capped at that width and
  // centred, so a shorter last row sits in the middle.
  const rows = Math.ceil(banks.length / 10);
  const perRow = Math.ceil(banks.length / rows);
  const ITEM = 112; // lg:w-28
  const GAP = 16; // lg:gap-x-4
  const rowWidth = perRow * ITEM + (perRow - 1) * GAP;

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading
          title="Your card might get you more"
          subtitle="Choose your bank to find available offers."
          href="/listings?deals=true"
          actionLabel="Browse all offers"
          align="center"
        />

        {/* One scrolling row on phones (it reads as a filter, not a wall of
            logos); wraps on desktop, where a hidden overflow can't be swiped */}
        <ul
          className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 lg:mx-auto lg:max-w-[var(--bank-row)] lg:flex-wrap lg:justify-center lg:gap-x-4 lg:gap-y-6 lg:overflow-visible lg:px-0"
          style={{ "--bank-row": `${rowWidth}px` } as React.CSSProperties}
        >
          {banks.map((bank) => {
            const body = (
              <>
                <BankCoin bank={bank} />
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                  {bank.name}
                </span>
                {/* Foreground ink, not pink: a count on every coin isn't an accent */}
                <span className="-mt-1 text-xs tabular-nums text-muted-foreground">
                  {/* Breaks only at the dot, never inside "248 deals" */}
                  {bank.dealsCount > 0 ? (
                    <>
                      <span className="whitespace-nowrap">{bank.places} places ·</span>{" "}
                      <span className="whitespace-nowrap">{bank.dealsCount} deals</span>
                    </>
                  ) : (
                    "No offers yet"
                  )}
                </span>
              </>
            );
            const className = "flex flex-col items-center gap-2 text-center";

            return (
              <li key={bank.id} className="w-20 shrink-0 sm:w-24 lg:w-28">
                {bank.dealsCount > 0 ? (
                  <Link
                    href={`/listings?deals=true&bank=${bank.id}`}
                    className={`${className} active:opacity-80`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>

      </div>
    </section>
  );
}
