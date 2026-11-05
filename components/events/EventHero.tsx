import { MapPin, Navigation } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { ShareButton } from "@/components/shared/ShareButton";
import { EventOrganizer } from "@/components/events/EventOrganizer";
import type { Event } from "@/types/events.types";
import { cn } from "@/lib/utils";
import { formatEventFacts } from "@/lib/events/datetime";
import { eventDirectionsUrl } from "@/lib/events/directions";

/**
 * The event header, in three pieces the page places on its grid: phones
 * stack poster, title, facts; from lg the title runs above both columns and
 * the poster and facts open the main column.
 */

/** The whole poster, never cropped (posters carry text). */
export function EventPoster({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted lg:rounded-3xl", className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        width={1600}
        height={900}
        priority
        loading="eager"
        fetchPriority="high"
        sizes="(min-width: 1200px) 740px, (min-width: 1024px) 60vw, (min-width: 768px) 768px, 100vw"
        className="mx-auto block h-auto max-h-[75vh] w-full object-contain lg:max-h-[720px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-foreground/[0.06]"
      />
    </div>
  );
}

/** Title, organizer byline and share. */
export function EventTitle({ event, className }: { event: Event; className?: string }) {
  const share = {
    contentType: "event" as const,
    contentId: event.id,
    contentTitle: event.name,
    contentUrl: `/events/${event.slug}`,
  };

  return (
    <div className={cn("lg:flex lg:items-end lg:gap-6", className)}>
      <div className="min-w-0 lg:flex-1">
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.025em] lg:text-5xl lg:leading-[1.05] lg:tracking-[-0.03em]">
          {event.name}
        </h1>
        <div className="mt-3 flex items-center gap-2 lg:mt-3.5">
          <EventOrganizer event={event} className="mr-1 min-w-0 flex-1" />
          <DirectionsButton event={event} className="lg:hidden" />
          <ShareButton
            {...share}
            variant="compact"
            className="h-11 w-11 shrink-0 border-0 bg-muted shadow-none hover:bg-border lg:hidden"
          />
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 lg:flex">
        <DirectionsButton event={event} />
        <ShareButton
          {...share}
          variant="pill"
          className="h-11 gap-2 border-0 bg-muted pl-4 pr-[18px] text-[15px] font-semibold shadow-none hover:bg-border"
        />
      </div>
    </div>
  );
}

/** Grey capsule that opens the venue in Google Maps. */
function DirectionsButton({ event, className }: { event: Event; className?: string }) {
  if (!event.location_name && !event.address && !(event.latitude && event.longitude)) return null;
  return (
    <a
      href={eventDirectionsUrl(event)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-muted pl-4 pr-[18px] text-[15px] font-semibold text-foreground transition-colors hover:bg-border",
        className,
      )}
    >
      <Navigation className="h-4 w-4" aria-hidden="true" />
      Directions
    </a>
  );
}

const LABEL = "text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground";
const VALUE = "mt-1 text-[22px] font-bold leading-7 tracking-[-0.02em] lg:mt-1.5 lg:text-[28px] lg:leading-[34px]";
const SUB = "mt-0.5 text-[13px] text-muted-foreground lg:text-[15px]";

/** App Store-style Date / Time / Venue strip. */
export function EventFacts({ event, className }: { event: Event; className?: string }) {
  const facts = formatEventFacts(event.start_time, event.end_time);
  const venue = event.location_name || event.address;

  return (
    <div className={cn("grid", venue ? "grid-cols-3" : "grid-cols-2", className)}>
      <div className="px-1.5 text-center lg:px-3">
        <div className={LABEL}>Date</div>
        <div className={VALUE}>{facts.date}</div>
        <div className={SUB}>{facts.dateSub}</div>
      </div>
      <div className="border-l border-border px-1.5 text-center lg:px-3">
        <div className={LABEL}>Time</div>
        <div className={cn(VALUE, "tabular-nums")}>{facts.time}</div>
        {facts.timeSub && <div className={SUB}>{facts.timeSub}</div>}
      </div>
      {venue && (
        <a
          href={eventDirectionsUrl(event)}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-l border-border px-1.5 text-center text-foreground lg:px-3"
        >
          <div className={LABEL}>Venue</div>
          <div className="mt-1 grid h-7 place-items-center lg:mt-1.5 lg:h-[34px]">
            <MapPin className="h-[22px] w-[22px] lg:h-6 lg:w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className={cn(SUB, "line-clamp-3 leading-[1.3]")}>{venue}</div>
        </a>
      )}
    </div>
  );
}
