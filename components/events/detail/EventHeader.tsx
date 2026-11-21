import Image from "next/image";
import { MapPin } from "lucide-react";
import { ShareButton } from "@/components/shared/ShareButton";
import { EventOrganizer } from "@/components/events/EventOrganizer";
import type { Event } from "@/types/events.types";
import type { ImageSize } from "@/lib/images/dimensions";
import { cn } from "@/lib/utils";
import { formatEventClock, formatEventDateLine } from "@/lib/events/datetime";
import { eventDirectionsUrl } from "@/lib/events/directions";
import { eventVenueLabel } from "@/lib/events/areas";

function whenText(event: Event): string {
  return `${formatEventDateLine(event.start_time, event.end_time)} · ${formatEventClock(event.start_time)}`;
}

/** Pin, venue and a pink Directions link to Google Maps. */
export function EventVenueLine({
  event,
  tone = "light",
  className,
}: {
  event: Event;
  tone?: "light" | "ink";
  className?: string;
}) {
  const venue = eventVenueLabel(event.location_name, event.address);
  if (!venue && !(event.latitude && event.longitude)) return null;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <MapPin
        className={cn("h-4 w-4 shrink-0", tone === "ink" ? "text-cream/75" : "text-muted-foreground")}
        aria-hidden="true"
      />
      {venue && (
        <span className={cn("min-w-0 flex-1 truncate", tone === "ink" ? "text-cream" : "text-foreground")}>
          {venue}
        </span>
      )}
      <a
        href={eventDirectionsUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className="-my-2 shrink-0 py-2 font-semibold text-primary hover:underline"
      >
        Directions
      </a>
    </div>
  );
}

/**
 * The banner, whole and uncropped, with Share on it. On phones it sits on an
 * ink strip carrying the title, date, time, organizer and venue; from lg the
 * strip hides and those details move to the sidebar.
 */
export function EventHeroBanner({
  event,
  poster,
  posterSize,
  className,
}: {
  event: Event;
  poster: string;
  posterSize: ImageSize | null;
  className?: string;
}) {
  const size = posterSize ?? { width: 1600, height: 900 };

  return (
    <div className={cn("overflow-hidden rounded-media bg-ink lg:bg-muted", className)}>
      <div className="relative">
        <Image
          src={poster}
          alt={event.name}
          width={size.width}
          height={size.height}
          priority
          sizes="(min-width: 1200px) 750px, (min-width: 1024px) 60vw, (min-width: 768px) 704px, 100vw"
          className="mx-auto block h-auto max-h-[80vh] w-full object-contain"
        />
        <ShareButton
          contentType="event"
          contentId={event.id}
          contentTitle={event.name}
          contentUrl={`/events/${event.slug}`}
          variant="compact"
          className="absolute right-2.5 top-2.5 h-11 w-11 border-0 bg-background text-foreground shadow-none hover:bg-background lg:right-3.5 lg:top-3.5"
        />
      </div>
      <div className="px-3.5 pb-3.5 pt-3 text-white lg:hidden">
        <h1 className="text-xl font-bold leading-tight tracking-[-0.02em]">{event.name}</h1>
        <p className="mt-1 text-data text-cream/80">
          {whenText(event)}
          <EventOrganizer event={event} variant="names" prefix=" · " />
        </p>
        <EventVenueLine event={event} tone="ink" className="mt-0.5 text-data" />
      </div>
    </div>
  );
}

/** Desktop sidebar head: date and time, title, venue and organizer. */
export function EventSideDetails({ event, className }: { event: Event; className?: string }) {
  return (
    <div className={className}>
      <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">{whenText(event)}</p>
      <h1 className="mt-1.5 text-[32px] font-bold leading-[38px] tracking-[-0.025em]">{event.name}</h1>
      <EventVenueLine event={event} className="mt-2 text-[15px]" />
      <EventOrganizer
        event={event}
        variant="names"
        prefix="By "
        className="mt-0.5 block text-small text-muted-foreground"
      />
    </div>
  );
}
