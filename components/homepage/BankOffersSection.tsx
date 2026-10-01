import Image from "next/image";
import Link from "next/link";
import {
  getHomepageOffers,
  getSupportedBanks,
  type HomepageOffer,
  type SupportedBank,
} from "@/lib/homepage/bank-offers";
import { OptimizedImage } from "@/components/ui/optimized-image";
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

// Pinned to Karachi time so the server render and the browser agree.
const endFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Karachi",
});

function endsLabel(endDate: string | null): string | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 7) return `Ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
  return `Ends ${endFormat.format(end)}`;
}

function OfferCard({ offer }: { offer: HomepageOffer }) {
  const facts = [
    offer.days,
    offer.cap ? `Capped at ${offer.cap}` : null,
    endsLabel(offer.endDate),
  ].filter(Boolean);

  return (
    <Link
      href={`/listing/${offer.listingSlug}`}
      className="group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 active:opacity-80"
    >
      <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {offer.imageUrl ? (
          <OptimizedImage
            src={offer.imageUrl}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : offer.bankLogoUrl ? (
          <Image
            src={offer.bankLogoUrl}
            alt=""
            fill
            sizes="80px"
            className="bg-white object-contain p-3"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold leading-tight text-primary">
          {offer.discountLabel}
        </span>
        <span className="mt-0.5 block line-clamp-1 text-sm font-semibold text-foreground">
          {offer.merchant}
          {offer.area ? (
            <span className="font-normal text-muted-foreground"> · {offer.area}</span>
          ) : null}
        </span>
        <span className="block line-clamp-1 text-xs text-muted-foreground">
          {offer.bankName} · {offer.cardLabel}
        </span>
        {facts.length > 0 ? (
          <span className="block line-clamp-1 text-xs text-muted-foreground">
            {facts.join(" · ")}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Bank discounts: a row of every supported bank (each one opens the deals
 * list filtered to it) and a few live offers to show what's there.
 */
export async function BankOffersSection() {
  const [banks, offers] = await Promise.all([
    getSupportedBanks(),
    getHomepageOffers(),
  ]);

  if (banks.length === 0 && offers.length === 0) return null;

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading
          title="Your card might get you more"
          subtitle="Choose your bank to find available offers."
          href="/listings?deals=true"
          actionLabel="Browse all offers"
        />

        {/* One scrolling row on phones (it reads as a filter, not a wall of
            logos); wraps on desktop, where a hidden overflow can't be swiped */}
        <ul className="scrollbar-hide -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:gap-y-5 lg:overflow-visible lg:px-0">
          {banks.map((bank) => {
            const body = (
              <>
                <BankCoin bank={bank} />
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-foreground sm:text-sm">
                  {bank.name}
                </span>
                {/* Foreground ink, not pink: a count on every coin isn't an accent */}
                <span className="-mt-1 text-xs tabular-nums text-muted-foreground">
                  {bank.dealsCount > 0
                    ? `${bank.dealsCount} ${bank.dealsCount === 1 ? "deal" : "deals"}`
                    : "No offers yet"}
                </span>
              </>
            );
            const className = "flex flex-col items-center gap-2 text-center";

            return (
              <li key={bank.id} className="w-20 shrink-0 sm:w-24">
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

        {offers.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
