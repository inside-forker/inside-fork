import Image from "next/image";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { getBanksWithOffers } from "@/lib/homepage/bank-offers";
import {
  CalloutHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

/** Bank card offers: pick your bank, see the places with a live deal on it. */
export async function BankOffersSection() {
  const banks = await getBanksWithOffers();

  // Nothing live means nothing to choose from, so the section stays hidden.
  if (banks.length === 0) return null;

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <CalloutHeading
          title="Your card might get you more."
          subtitle="Choose your bank to find available offers."
          href="/listings?deals=true"
          actionLabel="All deals"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {banks.map((bank) => (
            <Link
              key={bank.id}
              href={`/listings?deals=true&bank=${bank.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 active:opacity-80 sm:p-4"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {bank.logoUrl ? (
                  <Image
                    src={bank.logoUrl}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                ) : (
                  <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
                  {bank.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {bank.offers} {bank.offers === 1 ? "place" : "places"} with offers
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
