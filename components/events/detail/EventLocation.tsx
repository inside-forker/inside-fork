import type { CSSProperties } from "react";
import type { Event } from "@/types/events.types";
import { cn } from "@/lib/utils";
import { eventDirectionsUrl } from "@/lib/events/directions";
import { EventVenueMap } from "@/components/events/EventVenueMap";
import { SECTION_TITLE } from "./styles";

const ZOOM = 15;
const TILE = 256;
// 5 × 3 tiles around the venue cover the map at every width it is drawn at;
// tiles clipped by the frame are lazy and never load.
const COLS = [-2, -1, 0, 1, 2];
const ROWS = [-1, 0, 1];

/** OpenStreetMap tile under a point, and the point's pixel offset inside it. */
function tileFor(lat: number, lng: number) {
  const n = 2 ** ZOOM;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return {
    n,
    x: Math.floor(x),
    y: Math.floor(y),
    px: Math.round((x - Math.floor(x)) * TILE),
    py: Math.round((y - Math.floor(y)) * TILE),
  };
}

function PlaceCard({ name, address, directionsUrl, floating }: {
  name: string;
  address: string | null;
  directionsUrl: string;
  floating: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-background",
        floating
          ? "absolute inset-x-3 bottom-3 rounded-2xl py-3.5 pl-4 pr-3 shadow-[0_1px_2px_hsl(var(--ink)/0.08),0_6px_20px_hsl(var(--ink)/0.08)] lg:inset-x-auto lg:bottom-5 lg:left-5 lg:block lg:w-[340px] lg:max-w-[calc(100%_-_40px)] lg:rounded-[20px] lg:p-5"
          : "rounded-[20px] bg-muted p-4 lg:p-5",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-semibold leading-[1.3]">{name}</div>
        {address && <div className="text-[15px] text-muted-foreground">{address}</div>}
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-11 shrink-0 items-center rounded-full px-[18px] text-[15px] font-semibold text-foreground transition-opacity hover:opacity-80 lg:px-5",
          floating ? "bg-muted lg:mt-4" : "bg-background",
        )}
      >
        Directions
      </a>
    </div>
  );
}

/**
 * Location: a greyscale street map with a pink pin and a floating place card
 * (Directions opens Google Maps), then the organizer's venue layout if any.
 */
export function EventLocation({
  event,
  layoutImageUrl,
  className,
}: {
  event: Event;
  layoutImageUrl: string | null;
  className?: string;
}) {
  const name = event.location_name || event.address || "";
  // "Defence Authority Creek Club, Karachi" under that same name reads as "Karachi".
  const rawAddress = event.address?.trim() || null;
  const address =
    !rawAddress || rawAddress === name
      ? null
      : rawAddress.toLowerCase().startsWith(name.toLowerCase())
        ? rawAddress.slice(name.length).replace(/^[\s,.-]+/, "") || null
        : rawAddress;
  const directionsUrl = eventDirectionsUrl(event);
  const lat = Number(event.latitude);
  const lng = Number(event.longitude);
  const hasCoords =
    event.latitude != null && event.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) < 85;

  const tile = hasCoords ? tileFor(lat, lng) : null;

  return (
    <section id="location" aria-labelledby="location-title" className={cn("scroll-mt-24", className)}>
      <h2 id="location-title" className={cn(SECTION_TITLE, "mb-4 lg:mb-5")}>
        Location
      </h2>

      {tile ? (
        <div className="relative h-[290px] overflow-hidden rounded-3xl bg-muted lg:h-[400px] lg:rounded-[28px]">
          <div
            aria-hidden="true"
            style={
              {
                "--map-x": `${-COLS[0] * TILE + tile.px}px`,
                "--map-y": `${-ROWS[0] * TILE + tile.py}px`,
                gridTemplateColumns: `repeat(${COLS.length}, ${TILE}px)`,
              } as CSSProperties
            }
            className="absolute left-[calc(50%_-_var(--map-x))] top-[calc(38%_-_var(--map-y))] grid grayscale contrast-[.92] brightness-[1.04] dark:invert lg:left-[calc(58%_-_var(--map-x))] lg:top-[calc(45%_-_var(--map-y))]"
          >
            {ROWS.map((dy) =>
              COLS.map((dx) => {
                const x = (((tile.x + dx) % tile.n) + tile.n) % tile.n;
                const y = tile.y + dy;
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${dx},${dy}`}
                    src={`https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`}
                    alt=""
                    width={TILE}
                    height={TILE}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="block h-64 w-64 max-w-none select-none"
                  />
                );
              }),
            )}
          </div>
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-[38%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--background)),0_0_0_5px_hsl(var(--ink)/0.12)] lg:left-[58%] lg:top-[45%] lg:h-[22px] lg:w-[22px] lg:shadow-[0_0_0_5px_hsl(var(--background)),0_0_0_6px_hsl(var(--ink)/0.12)]"
          />
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-3 top-2.5 text-[11px] text-muted-foreground lg:bottom-2.5 lg:right-3.5 lg:top-auto"
          >
            © OpenStreetMap
          </a>
          <PlaceCard name={name} address={address} directionsUrl={directionsUrl} floating />
        </div>
      ) : (
        <PlaceCard name={name} address={address} directionsUrl={directionsUrl} floating={false} />
      )}

      {layoutImageUrl && (
        <div className="mt-3 lg:mt-4">
          <EventVenueMap src={layoutImageUrl} alt={`${event.name} venue map`} />
        </div>
      )}
    </section>
  );
}
