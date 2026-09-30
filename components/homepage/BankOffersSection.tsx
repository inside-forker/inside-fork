import Image from "next/image";
import Link from "next/link";
import { getSupportedBanks, type SupportedBank } from "@/lib/homepage/bank-offers";
import {
  CalloutHeading,
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

/** Every supported bank; the ones with live offers link to their deals. */
export async function BankOffersSection() {
  const banks = await getSupportedBanks();

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

        <ul className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
          {banks.map((bank) => {
            const body = (
              <>
                <BankCoin bank={bank} />
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                  {bank.name}
                </span>
                {/* Foreground ink, not pink: a count on every coin isn't an accent */}
                <span className="-mt-1 text-xs tabular-nums text-muted-foreground">
                  {bank.offers > 0
                    ? `${bank.offers} ${bank.offers === 1 ? "place" : "places"}`
                    : "No offers yet"}
                </span>
              </>
            );
            const className = "flex flex-col items-center gap-2 text-center";

            return (
              <li key={bank.id}>
                {bank.offers > 0 ? (
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
