/**
 * Neighbourhoods the homepage offers as location bias for search.
 * Centroids match the mobile AREAS list (approximate; for distance ranking).
 * Empty-query picks can still deep-link to listings address browse.
 */

export type HomepageArea = {
  label: string;
  center: { lat: number; lng: number };
};

export const HOMEPAGE_AREAS: readonly HomepageArea[] = [
  { label: "Clifton", center: { lat: 24.8138, lng: 67.03 } },
  { label: "DHA", center: { lat: 24.813, lng: 67.064 } },
  { label: "PECHS", center: { lat: 24.868, lng: 67.062 } },
  { label: "Gulshan", center: { lat: 24.92, lng: 67.095 } },
  { label: "North Nazimabad", center: { lat: 24.938, lng: 67.04 } },
  { label: "Bahadurabad", center: { lat: 24.883, lng: 67.07 } },
] as const;

export function areaHref(area: string) {
  return `/listings?search=${encodeURIComponent(area)}`;
}

export function findHomepageArea(label: string): HomepageArea | undefined {
  return HOMEPAGE_AREAS.find(
    (a) => a.label.toLowerCase() === label.trim().toLowerCase(),
  );
}

/** Listings browse when Explore has no query but an area / near-me pin. */
export function areaBrowseHref(opts: {
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  if (opts.lat != null && opts.lng != null && !opts.area) {
    return `/listings?sort=distance&lat=${opts.lat.toFixed(6)}&lng=${opts.lng.toFixed(6)}`;
  }
  if (opts.area) {
    return areaHref(opts.area);
  }
  return "/listings";
}
