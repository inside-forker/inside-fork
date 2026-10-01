/**
 * Neighbourhoods the homepage offers as browsing shortcuts. Listings have no
 * area column, so each one opens the listings search for its name, which
 * matches against the address.
 */
export const HOMEPAGE_AREAS = [
  "Clifton",
  "DHA",
  "PECHS",
  "Gulshan",
  "North Nazimabad",
  "Bahadurabad",
] as const;

export function areaHref(area: string) {
  return `/listings?search=${encodeURIComponent(area)}`;
}
