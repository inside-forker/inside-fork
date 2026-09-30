import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

export type BankWithOffers = {
  id: number;
  name: string;
  logoUrl: string | null;
  offers: number;
};

/**
 * Banks that currently have at least one live deal on a listing, busiest
 * first. Same "live" rule as the listings deals filter: active and not ended.
 */
export const getBanksWithOffers = unstable_cache(
  async (): Promise<BankWithOffers[]> => {
    try {
      const { rows } = await query(
        `SELECT b.id, b.name, b.logo_url,
                COUNT(DISTINCT d.listing_id)::integer AS offers
         FROM banks b
         JOIN deals d ON d.bank_id = b.id
         WHERE d.is_active = true
           AND d.listing_id IS NOT NULL
           AND (d.end_date IS NULL OR d.end_date::timestamptz >= NOW())
         GROUP BY b.id, b.name, b.logo_url
         ORDER BY offers DESC, b.name ASC
         LIMIT 12`,
      );
      return rows.map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        logoUrl: (row.logo_url as string | null) || null,
        offers: Number(row.offers) || 0,
      }));
    } catch (error) {
      console.error("Bank offers query failed:", error);
      return [];
    }
  },
  ["homepage-bank-offers"],
  { revalidate: 3600, tags: ["deals"] },
);
