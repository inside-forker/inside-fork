import Image from "next/image";
import Link from "next/link";
import type { Event } from "@/types/events.types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatEventDateTile, formatEventWhen } from "@/lib/events/datetime";
import { SECTION_TITLE } from "./styles";

/**
 * "More events": the next event coming up, as one feature card (poster with
 * a date block; from lg a wide grey card with the details beside it).
 */
export function MoreEvents({
  event,
  fromPrice,
  className,
}: {
  event: Event;
  /** Cheapest ticket, or null when the event sells none. */
  fromPrice: number | null;
  className?: string;
}) {
  const tile = formatEventDateTile(event.start_time);
  const poster = event.images?.[0]?.url ?? null;
  const price =
    fromPrice == null ? null : fromPrice === 0 ? "Free" : `From Rs ${fromPrice.toLocaleString("en-US")}`;
  const venue = event.location_name || event.address || null;
  const phoneLine = [venue, price].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="more-events-title" className={className}>
      <div className="mb-4 flex items-baseline justify-between gap-3 lg:mb-5">
        <h2 id="more-events-title" className={SECTION_TITLE}>
          More events
        </h2>
        <Link href="/events" className="text-[15px] font-semibold text-foreground hover:underline lg:text-[17px]">
          See all
        </Link>
      </div>

      <Link
        href={`/events/${event.slug}`}
        className="group block text-foreground lg:flex lg:items-center lg:gap-10 lg:rounded-[28px] lg:bg-muted lg:p-4"
      >
        <div className="relative lg:min-w-0 lg:flex-[1_1_420px]">
          <div className="aspect-video overflow-hidden rounded-[20px] bg-muted lg:rounded-[18px] lg:bg-border">
            {poster && (
              <Image
                src={poster}
                alt={event.name}
                width={960}
                height={540}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="h-full w-full object-cover transition-opacity group-hover:opacity-95"
              />
            )}
          </div>
          <div
            className={cn(
              "absolute left-3 top-3 w-[52px] rounded-xl bg-background pb-[7px] pt-1.5 text-center",
              "lg:left-3.5 lg:top-3.5 lg:w-[60px] lg:rounded-[14px] lg:pb-2 lg:pt-[7px]",
            )}
          >
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {tile.month}
            </div>
            <div className="text-[22px] font-bold leading-[1.05] tracking-[-0.02em] lg:text-[26px]">{tile.day}</div>
          </div>
        </div>

        <div className="mt-3 lg:mt-0 lg:min-w-0 lg:flex-[1_1_320px] lg:py-2 lg:pr-6">
          <div className="text-[17px] font-semibold lg:text-[32px] lg:font-bold lg:leading-[1.1] lg:tracking-[-0.025em]">
            {event.name}
          </div>
          {phoneLine && <div className="text-[15px] text-muted-foreground lg:hidden">{phoneLine}</div>}
          <div className="hidden lg:block">
            <div className="mt-2.5 text-[17px] text-muted-foreground">{formatEventWhen(event.start_time)}</div>
            {venue && <div className="text-[17px] text-muted-foreground">{venue}</div>}
            <div className="mt-6 flex items-center gap-4">
              <span className="inline-flex h-11 items-center rounded-full bg-background px-5 text-[15px] font-semibold">
                View event
              </span>
              {price && <span className="text-[15px] text-muted-foreground">{price}</span>}
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

/** Suspense fallback shaped like the feature card. */
export function MoreEventsSkeleton({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="mb-4 h-7 w-40 lg:mb-5 lg:h-8" />
      <Skeleton className="aspect-video w-full rounded-[20px] lg:aspect-auto lg:h-[340px] lg:rounded-[28px]" />
    </div>
  );
}
