import Link from "next/link";
import type { CSSProperties } from "react";
import { EventBannerCard } from "@/components/events/EventBannerCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventBanner } from "@/lib/events/list";
import { SECTION_TITLE } from "./styles";

export interface MoreEventItem {
  id: number;
  slug: string;
  name: string;
  dateLabel: string;
  priceLabel: string | null;
  banner: EventBanner | null;
}

/**
 * "More events": the next events coming up, as banner cards. Phones stack
 * them; from lg they share one row at one height.
 */
export function MoreEvents({ events, className }: { events: MoreEventItem[]; className?: string }) {
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="more-events-title" className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="more-events-title" className={SECTION_TITLE}>
          More events
        </h2>
        <Link href="/events" className="text-small font-semibold text-foreground hover:underline lg:text-[15px]">
          See all
        </Link>
      </div>
      <ul className="mt-3 grid gap-3 lg:flex lg:gap-5">
        {events.map((e) => {
          const ratio = e.banner ? e.banner.width / e.banner.height : 16 / 9;
          return (
            <li
              key={e.id}
              style={{ "--ratio": ratio.toFixed(4) } as CSSProperties}
              className="min-w-0 lg:[flex:var(--ratio)_1_0px]"
            >
              <EventBannerCard
                href={`/events/${e.slug}`}
                name={e.name}
                dateLabel={e.dateLabel}
                priceLabel={e.priceLabel}
                banner={e.banner}
                sizes="(min-width: 1024px) 420px, 100vw"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Suspense fallback shaped like the section. */
export function MoreEventsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="h-6 w-36" />
      <div className="mt-3 grid gap-3 lg:grid-cols-2 lg:gap-5">
        <Skeleton className="aspect-video w-full rounded-media" />
        <Skeleton className="hidden aspect-video w-full rounded-media lg:block" />
      </div>
    </div>
  );
}
