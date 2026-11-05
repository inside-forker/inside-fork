import type { Event } from "@/types/events.types";

/** Google Maps: exact pin when we have coordinates, else search the address. */
export function eventDirectionsUrl(
  event: Pick<Event, "latitude" | "longitude" | "address" | "location_name">,
): string {
  if (event.latitude && event.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    event.address || event.location_name || "",
  )}`;
}
