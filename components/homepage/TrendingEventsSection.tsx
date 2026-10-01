import Link from "next/link";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { Event } from "@/types/events.types";
import type { EventPriceRange } from "@/lib/mobile/event-pricing";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

interface TrendingEventsSectionProps {
  events: Event[];
  /** Ticket price range by event id; an event without one shows no price. */
  prices?: Record<number, EventPriceRange>;
}

// Pinned to Karachi time so the server render and the browser agree.
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Karachi",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

function formatWhen(startTime: string) {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return null;
  return `${dateFormat.format(date).replace(",", "")} · ${timeFormat.format(date)}`;
}

function priceLabel(range: EventPriceRange | undefined): string | null {
  if (!range || range.from === null) return null;
  const { from, to } = range;
  if (from === 0) return to ? `Free, or from PKR ${to.toLocaleString()}` : "Free";
  return to !== null && to !== from
    ? `From PKR ${from.toLocaleString()}`
    : `PKR ${from.toLocaleString()}`;
}

function primaryImage(event: Event) {
  if (!event.images || event.images.length === 0) return null;
  return event.images.find((img) => img.is_primary)?.url || event.images[0].url;
}

/**
 * One event gets the whole row (image beside its details) so the section
 * doesn't read as a lone card next to empty space; more become a grid.
 */
function FeaturedEvent({ event, price }: { event: Event; price: string | null }) {
  const image = primaryImage(event);
  const when = formatWhen(event.start_time);

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group grid overflow-hidden rounded-2xl border border-border bg-card active:opacity-80 md:grid-cols-2"
    >
      <div className="relative aspect-[16/10] bg-muted md:aspect-auto md:min-h-[300px]">
        {image ? (
          <OptimizedImage
            src={image}
            alt={event.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-5 sm:p-8">
        <h3 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary sm:text-2xl">
          {event.name}
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {when ? (
            <li className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {when}
            </li>
          ) : null}
          {event.location_name ? (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="line-clamp-1">{event.location_name}</span>
            </li>
          ) : null}
          {price ? (
            <li className="flex items-center gap-2 font-semibold text-foreground">
              <Ticket className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {price}
            </li>
          ) : null}
        </ul>
        {event.organizer_name ? (
          <p className="text-xs text-muted-foreground">By {event.organizer_name}</p>
        ) : null}
        <span className="inline-flex w-fit items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          View event
        </span>
      </div>
    </Link>
  );
}

export function TrendingEventsSection({ events, prices = {} }: TrendingEventsSectionProps) {
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading
          title="What's on"
          subtitle="Upcoming events in Karachi"
          href="/events"
          actionLabel="All events"
        />

        {events.length === 1 ? (
          <FeaturedEvent event={events[0]} price={priceLabel(prices[events[0].id])} />
        ) : (
          <div
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              events.length === 2 ? "" : "lg:grid-cols-3"
            }`}
          >
            {events.map((event) => {
              const image = primaryImage(event);
              const when = formatWhen(event.start_time);
              const price = priceLabel(prices[event.id]);

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group block overflow-hidden rounded-2xl border border-border bg-card active:opacity-80"
                >
                  <div className="relative aspect-[16/10] bg-muted">
                    {image ? (
                      <OptimizedImage
                        src={image}
                        alt={event.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="line-clamp-1 font-semibold tracking-tight text-foreground group-hover:text-primary">
                      {event.name}
                    </h3>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {[when, event.location_name].filter(Boolean).join(" · ")}
                    </p>
                    {price ? (
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {price}
                      </p>
                    ) : null}
                    {event.organizer_name ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        By {event.organizer_name}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
