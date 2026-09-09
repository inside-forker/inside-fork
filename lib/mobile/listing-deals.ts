/**
 * Best-deal summaries for listing *cards*.
 *
 * The listing-detail endpoint returns every active deal, but the browse
 * surfaces only ever render one badge per row ("20% OFF · with HBL Platinum"),
 * so shipping the full deal list to a 50-card page would be mostly waste. This
 * collapses each listing to its single strongest deal plus a count, in one
 * round trip for the whole page.
 */
import { query } from "@/lib/db";

export type ListingDealSummaryDTO = {
  id: number;
  title: string | null;
  discount_value: string | null;
  deal_type: string | null;
  end_date: string | null;
  bank: { name: string | null; logo_url: string | null } | null;
};

export type ListingDeals = {
  /** The deal the card leads with — highest parsed percentage. */
  best: ListingDealSummaryDTO;
  /** Every active deal on the listing, so the card can say "+2 more". */
  count: number;
};

/**
 * Active deals for each of `listingIds`, keyed by listing id. Listings with no
 * active deal are absent from the map rather than present with a null.
 *
 * "Active" matches GET /listings/[slug] exactly (`is_active` plus an unexpired
 * `end_date`, ignoring `start_date`) so a card's badge can never advertise an
 * offer the detail screen then fails to show.
 *
 * Ranking mirrors the client's `pickBestDeal`: the leading integer in
 * `discount_value` ("20%" -> 20, "Up to 15%" -> 15), with unparseable values
 * ("Buy 1 Get 1") sorting last and ties broken by recency.
 */
export async function fetchBestDealsByListing(
  listingIds: number[],
): Promise<Record<number, ListingDeals>> {
  if (listingIds.length === 0) return {};

  const { rows } = await query(
    `SELECT DISTINCT ON (d.listing_id)
            d.listing_id, d.id, d.title, d.discount_value, d.deal_type, d.end_date,
            b.name AS bank_name, b.logo_url AS bank_logo_url,
            COUNT(*) OVER (PARTITION BY d.listing_id) AS deal_count
       FROM deals d
       LEFT JOIN banks b ON b.id = d.bank_id
      WHERE d.listing_id = ANY($1::int[])
        AND d.is_active = true
        AND (d.end_date IS NULL OR d.end_date >= NOW())
      ORDER BY d.listing_id,
               NULLIF(substring(d.discount_value from '[0-9]+'), '')::int DESC NULLS LAST,
               d.created_at DESC`,
    [listingIds],
  );

  const byListing: Record<number, ListingDeals> = {};
  for (const row of rows) {
    byListing[Number(row.listing_id)] = {
      best: {
        id: Number(row.id),
        title: row.title,
        discount_value: row.discount_value,
        deal_type: row.deal_type,
        end_date: row.end_date,
        bank: row.bank_name ? { name: row.bank_name, logo_url: row.bank_logo_url } : null,
      },
      count: Number(row.deal_count),
    };
  }

  return byListing;
}
