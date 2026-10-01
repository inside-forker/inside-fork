import { unstable_cache } from "next/cache";
import { query } from "@/lib/db";

/**
 * Published places per area, counted with the same rule the area links use
 * (the listings search: name, description or address contains the area), so
 * the number on the card matches the list it opens. A failed query yields an
 * empty map and the cards simply show no count.
 */
export const getAreaPlaceCounts = unstable_cache(
  async (areas: readonly string[]): Promise<Record<string, number>> => {
    try {
      const { rows } = await query(
        `SELECT a.area, COUNT(l.id)::integer AS places
           FROM unnest($1::text[]) AS a(area)
           LEFT JOIN listings_with_details l
             ON l.status = 'published'
            AND (l.name ILIKE '%' || a.area || '%'
                 OR l.description ILIKE '%' || a.area || '%'
                 OR l.address ILIKE '%' || a.area || '%')
          GROUP BY a.area`,
        [areas],
      );
      return Object.fromEntries(
        rows.map((row) => [String(row.area), Number(row.places) || 0]),
      );
    } catch (error) {
      console.error("Area place counts query failed:", error);
      return {};
    }
  },
  ["homepage-area-counts-v1"],
  { revalidate: 3600, tags: ["listings"] },
);
