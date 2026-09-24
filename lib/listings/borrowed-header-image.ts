import { query } from "@/lib/db";

/**
 * Brand stem used to find a same-brand sibling with photos.
 * "Melbrew - E Street" → "Melbrew"; "Melbrew Coffee" → "Melbrew Coffee".
 */
export function brandStemFromListingName(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const dashIdx = trimmed.indexOf(" - ");
  const stem = (dashIdx >= 0 ? trimmed.slice(0, dashIdx) : trimmed).trim();
  return stem.length > 0 ? stem : null;
}

/**
 * Primary non-menu cover from a same-stem sibling that has images.
 * Prefer published donors, then multi-branch Peekaboo parents (incl. archived
 * ones — e.g. Melbrew Coffee is archived while Excel location rows are live).
 */
export async function getBorrowedHeaderImageUrl(
  listingId: number,
  listingName: string | null | undefined,
): Promise<string | null> {
  const stem = brandStemFromListingName(listingName);
  if (!stem) return null;

  try {
    const { rows } = await query(
      `SELECT li.url
       FROM listings l
       INNER JOIN listing_images li ON li.listing_id = l.id
         AND li.url NOT LIKE '%/menu/%'
         AND (li.availability IS NULL OR li.availability IS DISTINCT FROM 'dead')
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS branch_count
         FROM listing_branches lb
         WHERE lb.listing_id = l.id
       ) b ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS gallery_count
         FROM listing_images gi
         WHERE gi.listing_id = l.id
           AND gi.url NOT LIKE '%/menu/%'
           AND (gi.availability IS NULL OR gi.availability IS DISTINCT FROM 'dead')
       ) g ON true
       WHERE l.status IN ('published', 'archived')
         AND l.id <> $1
         AND l.name ILIKE $2 || '%'
       ORDER BY
         (l.status = 'published') DESC,
         (COALESCE(b.branch_count, 0) >= 2) DESC,
         COALESCE(g.gallery_count, 0) DESC,
         li.is_primary DESC NULLS LAST,
         li.display_order ASC NULLS LAST,
         li.id ASC
       LIMIT 1`,
      [listingId, stem],
    );
    const url = rows[0]?.url;
    return typeof url === "string" && url.trim() ? url.trim() : null;
  } catch (error) {
    console.error("[listings] borrowed header lookup failed:", error);
    return null;
  }
}

/**
 * Batch variant for search results — one donor lookup per distinct brand stem.
 */
export async function getBorrowedHeaderImageUrls(
  listings: Array<{ id: number; name: string | null }>,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (listings.length === 0) return result;

  const byStem = new Map<string, number[]>();
  for (const listing of listings) {
    const stem = brandStemFromListingName(listing.name);
    if (!stem) continue;
    const key = stem.toLowerCase();
    const ids = byStem.get(key);
    if (ids) ids.push(listing.id);
    else byStem.set(key, [listing.id]);
  }

  await Promise.all(
    [...byStem.entries()].map(async ([stemKey, ids]) => {
      // Recover original casing from the first matching name for the ILIKE prefix.
      const sample = listings.find((l) => brandStemFromListingName(l.name)?.toLowerCase() === stemKey);
      const stem = brandStemFromListingName(sample?.name) ?? stemKey;
      try {
        const { rows } = await query(
          `SELECT li.url
           FROM listings l
           INNER JOIN listing_images li ON li.listing_id = l.id
             AND li.url NOT LIKE '%/menu/%'
             AND (li.availability IS NULL OR li.availability IS DISTINCT FROM 'dead')
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS branch_count
             FROM listing_branches lb
             WHERE lb.listing_id = l.id
           ) b ON true
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS gallery_count
             FROM listing_images gi
             WHERE gi.listing_id = l.id
               AND gi.url NOT LIKE '%/menu/%'
               AND (gi.availability IS NULL OR gi.availability IS DISTINCT FROM 'dead')
           ) g ON true
           WHERE l.status IN ('published', 'archived')
             AND NOT (l.id = ANY($1::int[]))
             AND l.name ILIKE $2 || '%'
           ORDER BY
             (l.status = 'published') DESC,
             (COALESCE(b.branch_count, 0) >= 2) DESC,
             COALESCE(g.gallery_count, 0) DESC,
             li.is_primary DESC NULLS LAST,
             li.display_order ASC NULLS LAST,
             li.id ASC
           LIMIT 1`,
          [ids, stem],
        );
        const url = rows[0]?.url;
        if (typeof url === "string" && url.trim()) {
          for (const id of ids) result.set(id, url.trim());
        }
      } catch (error) {
        console.error("[listings] batch borrowed header lookup failed:", error);
      }
    }),
  );

  return result;
}
