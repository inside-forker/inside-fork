/** Prismfest student auto-discount (Inside Karachi logged-in, non-Parchi channel). */
export const PRISMFEST_SLUG = "prismfest-26";

export function isPrismfestSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === PRISMFEST_SLUG;
}

/** Organiser's venue layout (same artwork as on Ticketwala), shown above the tickets. */
export const PRISMFEST_VENUE_MAP = "/events/prismfest-26-venue-map.jpg";
