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
  const map = await getBorrowedHeaderImageUrls([
    { id: listingId, name: listingName ?? null },
  ]);
  return map.get(listingId) ?? null;
}

/**
 * Batch variant — one SQL round-trip for every distinct brand stem.
 *
 * Do not Promise.all per-stem queries: local/dev pools are tiny (often max:2)
 * and a deals catalog can have hundreds of stems, which saturates the pool,
 * times out, retries, and floods the logs.
 */
export async function getBorrowedHeaderImageUrls(
  listings: Array<{ id: number; name: string | null }>,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (listings.length === 0) return result;

  const byStem = new Map<string, { stem: string; ids: number[] }>();
  for (const listing of listings) {
    const stem = brandStemFromListingName(listing.name);
    if (!stem) continue;
    const key = stem.toLowerCase();
    const entry = byStem.get(key);
    if (entry) entry.ids.push(listing.id);
    else byStem.set(key, { stem, ids: [listing.id] });
  }

  if (byStem.size === 0) return result;

  const stemLabels: string[] = [];
  const stemKeys: string[] = [];
  const excludeStemIdx: number[] = [];
  const excludeIds: number[] = [];

  let idx = 0;
  for (const [key, { stem, ids }] of byStem) {
    stemKeys.push(key);
    stemLabels.push(stem);
    for (const id of ids) {
      excludeStemIdx.push(idx);
      excludeIds.push(id);
    }
    idx += 1;
  }

  try {
    const { rows } = await query<{ idx: number; url: string }>(
      `WITH stems AS (
         SELECT stem, (ordinality - 1)::int AS idx
         FROM unnest($1::text[]) WITH ORDINALITY AS t(stem, ordinality)
       ),
       excludes AS (
         SELECT stem_idx, exclude_id
         FROM unnest($2::int[], $3::int[]) AS t(stem_idx, exclude_id)
       ),
       ranked AS (
         SELECT
           s.idx,
           li.url,
           ROW_NUMBER() OVER (
             PARTITION BY s.idx
             ORDER BY
               (l.status = 'published') DESC,
               (COALESCE(b.branch_count, 0) >= 2) DESC,
               COALESCE(g.gallery_count, 0) DESC,
               li.is_primary DESC NULLS LAST,
               li.display_order ASC NULLS LAST,
               li.id ASC
           ) AS rn
         FROM stems s
         INNER JOIN listings l
           ON l.status IN ('published', 'archived')
          AND l.name ILIKE s.stem || '%'
          AND NOT EXISTS (
            SELECT 1
            FROM excludes e
            WHERE e.stem_idx = s.idx
              AND e.exclude_id = l.id
          )
         INNER JOIN listing_images li
           ON li.listing_id = l.id
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
       )
       SELECT idx, url
       FROM ranked
       WHERE rn = 1`,
      [stemLabels, excludeStemIdx, excludeIds],
    );

    const urlByIdx = new Map<number, string>();
    for (const row of rows) {
      const url = typeof row.url === "string" ? row.url.trim() : "";
      if (!url) continue;
      urlByIdx.set(Number(row.idx), url);
    }

    for (let i = 0; i < stemKeys.length; i++) {
      const url = urlByIdx.get(i);
      if (!url) continue;
      const ids = byStem.get(stemKeys[i])?.ids;
      if (!ids) continue;
      for (const id of ids) result.set(id, url);
    }
  } catch (error) {
    console.error("[listings] batch borrowed header lookup failed:", error);
  }

  return result;
}
