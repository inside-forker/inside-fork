import { query } from "@/lib/db";
import { queryPaginatedListings } from "@/lib/listings/query-paginated-listings";
import {
  toListingCard,
  toListingImage,
  toNumericListingRow,
  type ListingCardDTO,
  type ListingImageDTO,
} from "@/lib/mobile/mappers";

export type OutingListingCard = ListingCardDTO & {
  min_price_per_person?: number | null;
  max_price_per_person?: number | null;
  min_guest_capacity?: number | null;
  max_guest_capacity?: number | null;
  category_slug?: string | null;
};

/**
 * Fetch published ListingCard DTOs for outing planning.
 * Uses the same listings_with_details path as the web browse query.
 */
export async function fetchListingCards(opts: {
  categorySlug?: string | null;
  search?: string | null;
  limit?: number;
}): Promise<OutingListingCard[]> {
  const limit = Math.min(30, Math.max(1, opts.limit ?? 10));
  const { listings } = await queryPaginatedListings({
    page: 1,
    limit,
    categorySlug: opts.categorySlug ?? null,
    search: opts.search ?? null,
    sort: "top-rated",
  });

  const cards = listings
    .filter((row) => row.id != null)
    .map((row) => {
      const numeric = toNumericListingRow(row as Record<string, unknown>);
      const rawImages = (row.images ?? []) as Array<{
        id: number;
        url: string;
        alt_text: string | null;
        display_order: number | null;
        is_primary: boolean | null;
      }>;
      const images: ListingImageDTO[] = rawImages.map((img) =>
        toListingImage(img),
      );
      return toListingCard(numeric, images) as OutingListingCard;
    });

  return enrichOutingCards(cards);
}

/** Attach price/capacity from `listings` (not on listings_with_details). */
export async function enrichOutingCards(
  cards: OutingListingCard[],
): Promise<OutingListingCard[]> {
  if (cards.length === 0) return cards;
  const ids = cards.map((c) => c.id);
  try {
    const { rows } = await query(
      `SELECT l.id,
              l.min_price_per_person,
              l.max_price_per_person,
              l.min_guest_capacity,
              l.max_guest_capacity,
              c.slug AS category_slug
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = ANY($1::int[])`,
      [ids],
    );
    const byId = new Map(
      (
        rows as Array<{
          id: number | string;
          min_price_per_person: number | string | null;
          max_price_per_person: number | string | null;
          min_guest_capacity: number | string | null;
          max_guest_capacity: number | string | null;
          category_slug: string | null;
        }>
      ).map((r) => [
        Number(r.id),
        {
          min_price_per_person:
            r.min_price_per_person != null
              ? Number(r.min_price_per_person)
              : null,
          max_price_per_person:
            r.max_price_per_person != null
              ? Number(r.max_price_per_person)
              : null,
          min_guest_capacity:
            r.min_guest_capacity != null
              ? Number(r.min_guest_capacity)
              : null,
          max_guest_capacity:
            r.max_guest_capacity != null
              ? Number(r.max_guest_capacity)
              : null,
          category_slug: r.category_slug,
        },
      ]),
    );
    return cards.map((c) => {
      const extra = byId.get(c.id);
      if (!extra) return c;
      return { ...c, ...extra };
    });
  } catch (err) {
    console.warn(
      "[outing] enrichOutingCards failed:",
      err instanceof Error ? err.message : err,
    );
    return cards;
  }
}

/** Highest rated first; null ratings sink. */
export function byRatingDesc(
  a: OutingListingCard,
  b: OutingListingCard,
): number {
  return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
}
