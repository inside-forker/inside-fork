import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { Event } from "@/types/events.types";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

interface TrendingEventsSectionProps {
  events: Event[];
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

function primaryImage(event: Event) {
  if (!event.images || event.images.length === 0) return null;
  return event.images.find((img) => img.is_primary)?.url || event.images[0].url;
}

export function TrendingEventsSection({ events }: TrendingEventsSectionProps) {
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const image = primaryImage(event);
            const when = formatWhen(event.start_time);

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
      </div>
    </section>
  );
}
