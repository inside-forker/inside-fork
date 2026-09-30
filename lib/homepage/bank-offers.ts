import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

export type SupportedBank = {
  id: number;
  name: string;
  logoUrl: string | null;
  /** Number of distinct places with a live deal on this bank. */
  places: number;
  /** Total number of live deals on this bank. */
  dealsCount: number;
  /** Backwards compatible alias */
  offers: number;
};

/**
 * Every bank the platform supports, with how many places currently have a
 * live deal on it (active and not ended, the same rule as the listings deals
 * filter). Busiest first, then A-Z, like the app's bank index.
 */
export const getSupportedBanks = unstable_cache(
  async (): Promise<SupportedBank[]> => {
    try {
      const { rows } = await query(
        `SELECT b.id, b.name, b.logo_url,
                COUNT(DISTINCT l.id)::integer AS places,
                COUNT(d.id)::integer AS deals_count
         FROM banks b
         LEFT JOIN deals d
           ON d.bank_id = b.id
          AND d.is_active = true
          AND d.listing_id IS NOT NULL
          AND (d.end_date IS NULL OR d.end_date::timestamptz >= NOW())
         LEFT JOIN listings l
           ON l.id = d.listing_id
          AND l.status = 'published'
         GROUP BY b.id, b.name, b.logo_url
         ORDER BY deals_count DESC, places DESC, b.name ASC`,
      );
      return rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        logoUrl: (row.logo_url as string | null) || null,
        places: Number(row.places) || 0,
        dealsCount: Number(row.deals_count) || 0,
        offers: Number(row.places) || 0,
      }));
    } catch (error) {
      console.error("Supported banks query failed:", error);
      return [];
    }
  },
  ["homepage-supported-banks-v2"],
  { revalidate: 300, tags: ["deals"] },
);
