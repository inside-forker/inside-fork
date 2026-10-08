/** Prismfest student auto-discount (Inside Karachi logged-in, non-Parchi channel). */
export const PRISMFEST_SLUG = "prismfest-26";

export function isPrismfestSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === PRISMFEST_SLUG;
}
