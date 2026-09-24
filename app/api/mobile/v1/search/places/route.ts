import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import {
  MIN_QUERY_LENGTH,
  NEW_TAXONOMY_PARENT_IDS,
  TAG_ONLY_CAP,
  tokenizeQuery,
} from "@/lib/utils/places-search";
import { getBorrowedHeaderImageUrls } from "@/lib/listings/borrowed-header-image";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;

function parseCoord(
  raw: string | null,
  min: number,
  max: number,
): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * GET /api/mobile/v1/search/places?q=&limit=&offset=&lat=&lng=
 *
 * Fast path: resolve matching categories once, pull candidate listing ids via
 * name/address trigram + tag links, then score/rank only that subset.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      1,
      parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) ||
        DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
  );

  let lat = parseCoord(searchParams.get("lat"), -90, 90);
  let lng = parseCoord(searchParams.get("lng"), -180, 180);

  if (lat == null || lng == null) {
    const { user } = await getOptionalMobileUser(request);
    if (user) {
      try {
        const { rows } = await query(
          `SELECT latitude, longitude FROM public.user_saved_locations
           WHERE user_id = $1 AND is_active = true LIMIT 1`,
          [user.id],
        );
        const active = rows[0];
        if (active?.latitude != null && active?.longitude != null) {
          lat = Number(active.latitude);
          lng = Number(active.longitude);
        }
      } catch {
        // ignore
      }
    }
  }

  const hasLocation = lat != null && lng != null;

  const { normalized, tokens, fuzzyThreshold } = tokenizeQuery(rawQuery);
  if (tokens.length === 0 || normalized.length < MIN_QUERY_LENGTH) {
    throw new MobileApiError(
      "validation_error",
      "Query must be at least 2 characters long.",
      400,
      "q",
    );
  }

  const parentIds = [...NEW_TAXONOMY_PARENT_IDS];
  const listingFetchLimit = limit + 1;
  const tagOnlyCap = hasLocation ? limit : TAG_ONLY_CAP;
  const tokenCount = tokens.length;

  let listingsRes;

  try {
    // $1 norm, $2 tokens, $3 fuzzy, $4 parents, $5 limit, $6 offset,
    // $7 tagCap, $8 lat, $9 lng, $10 token_count
    listingsRes = await query(
      `WITH cfg AS (
         SELECT
           set_config(
             'pg_trgm.similarity_threshold',
             LEAST($3::float8, 1.0)::text,
             true
           ) AS sim,
           set_config(
             'pg_trgm.word_similarity_threshold',
             LEAST($3::float8, 1.0)::text,
             true
           ) AS wsim
       ),
       matched_cat_tokens AS (
         SELECT DISTINCT t.token, c.id AS category_id
         FROM cfg, unnest($2::text[]) AS t(token)
         JOIN categories c ON c.is_enabled = true
           AND (c.id = ANY($4::bigint[]) OR c.parent_id = ANY($4::bigint[]))
         LEFT JOIN category_search_aliases a ON a.category_id = c.id
         WHERE
           public.normalize_search_text(c.name) ILIKE '%' || t.token || '%'
           OR extensions.similarity(public.normalize_search_text(c.name), t.token) >= $3
           OR a.alias = t.token
           OR (
             $3 <= 1.0
             AND a.alias IS NOT NULL
             AND extensions.similarity(a.alias, t.token) >= $3
           )
           OR (
             $10::int = 1
             AND (
               a.alias = $1
               OR public.normalize_search_text(c.name) ILIKE '%' || $1 || '%'
               OR (
                 $3 <= 1.0
                 AND a.alias IS NOT NULL
                 AND extensions.similarity(a.alias, $1) >= $3
               )
             )
           )
       ),
       token_hits AS (
         -- Indexed / cheap name+address probes (UNION, not OR — avoids full scan)
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND l.name ILIKE '%' || t.token || '%'
         UNION
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND public.normalize_search_text(l.address) ILIKE '%' || t.token || '%'
         UNION
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND $3 <= 1.0
           AND public.normalize_search_text(l.name) OPERATOR(extensions.%) t.token
         UNION
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND $3 <= 1.0
           AND public.normalize_search_text(l.address) OPERATOR(extensions.%) t.token
         UNION
         -- Fuzzy word-in-name/address (piza ⊂ "… Pizza …")
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND $3 <= 1.0
           AND t.token OPERATOR(extensions.<%) public.normalize_search_text(l.name)
         UNION
         SELECT t.token, l.id AS listing_id
         FROM unnest($2::text[]) AS t(token)
         JOIN listings l ON l.status = 'published'
           AND $3 <= 1.0
           AND t.token OPERATOR(extensions.<%) public.normalize_search_text(l.address)
         UNION
         SELECT m.token, lc.listing_id
         FROM matched_cat_tokens m
         JOIN listing_categories lc ON lc.category_id = m.category_id
         JOIN listings l ON l.id = lc.listing_id AND l.status = 'published'
       ),
       candidates AS (
         SELECT listing_id AS id
         FROM token_hits
         GROUP BY listing_id
         HAVING COUNT(DISTINCT token) = $10::int
       ),
       scored AS (
         SELECT
           l.id,
           l.name,
           l.slug,
           l.address,
           cat.name AS category_name,
           l.is_featured,
           public.normalize_search_text(l.name) AS norm_name,
           public.normalize_search_text(l.address) AS norm_address,
           GREATEST(
             extensions.similarity(public.normalize_search_text(l.name), $1),
             extensions.word_similarity($1, public.normalize_search_text(l.name))
           ) AS name_sim,
           CASE
             WHEN $8::float8 IS NULL OR $9::float8 IS NULL THEN NULL
             WHEN l.latitude IS NULL OR l.longitude IS NULL THEN NULL
             ELSE (
               6371000 * acos(
                 LEAST(1.0, GREATEST(-1.0,
                   cos(radians($8::float8)) * cos(radians(l.latitude))
                   * cos(radians(l.longitude) - radians($9::float8))
                   + sin(radians($8::float8)) * sin(radians(l.latitude))
                 ))
               )
             )
           END AS distance_meters,
           (
             SELECT MAX(lc.relevance_score)
             FROM listing_categories lc
             JOIN matched_cat_tokens m ON m.category_id = lc.category_id
             WHERE lc.listing_id = l.id
           ) AS category_relevance
         FROM candidates c
         JOIN listings l ON l.id = c.id
         LEFT JOIN categories cat ON cat.id = l.category_id
       ),
       ranked AS (
         SELECT
           s.*,
           CASE
             WHEN s.norm_name = $1 THEN 0
             WHEN (
               SELECT bool_and(
                 s.norm_name ILIKE token || '%'
                 OR s.norm_name ILIKE '% ' || token || '%'
               )
               FROM unnest($2::text[]) AS t(token)
             ) THEN 0
             WHEN (
               SELECT bool_and(s.norm_name ILIKE '%' || token || '%')
               FROM unnest($2::text[]) AS t(token)
             ) THEN 1
             WHEN $3 <= 1.0 AND s.name_sim >= $3 THEN 2
             WHEN (
               SELECT bool_and(
                 s.norm_name ILIKE '%' || token || '%'
                 OR s.norm_address ILIKE '%' || token || '%'
                 OR ($3 <= 1.0 AND (
                   extensions.similarity(s.norm_name, token) >= $3
                   OR extensions.word_similarity(token, s.norm_name) >= $3
                 ))
                 OR ($3 <= 1.0 AND (
                   extensions.similarity(s.norm_address, token) >= $3
                   OR extensions.word_similarity(token, s.norm_address) >= $3
                 ))
               )
               FROM unnest($2::text[]) AS t(token)
             )
             AND EXISTS (
               SELECT 1 FROM unnest($2::text[]) AS t(token)
               WHERE s.norm_address ILIKE '%' || token || '%'
                  OR ($3 <= 1.0 AND (
                    extensions.similarity(s.norm_address, token) >= $3
                    OR extensions.word_similarity(token, s.norm_address) >= $3
                  ))
             )
             AND NOT (
               SELECT bool_and(
                 s.norm_name ILIKE '%' || token || '%'
                 OR ($3 <= 1.0 AND (
                   extensions.similarity(s.norm_name, token) >= $3
                   OR extensions.word_similarity(token, s.norm_name) >= $3
                 ))
               )
               FROM unnest($2::text[]) AS t(token)
             ) THEN 3
             ELSE 4
           END AS match_rank
         FROM scored s
       ),
       capped AS (
         SELECT *
         FROM (
           SELECT
             r.*,
             ROW_NUMBER() OVER (
               PARTITION BY (r.match_rank = 4)
               ORDER BY
                 r.match_rank ASC,
                 r.distance_meters ASC NULLS LAST,
                 r.name_sim DESC NULLS LAST,
                 r.category_relevance DESC NULLS LAST,
                 r.is_featured DESC NULLS LAST,
                 r.name ASC
             ) AS part_rn
           FROM ranked r
         ) x
         WHERE x.match_rank < 4 OR x.part_rn <= $7::int
       )
       SELECT
         c.id,
         c.name,
         c.slug,
         c.address,
         c.category_name,
         COALESCE(rev.avg_rating, 0) AS avg_rating,
         COALESCE(rev.review_count, 0) AS review_count,
         c.is_featured,
         c.match_rank,
         c.name_sim,
         c.category_relevance,
         c.distance_meters
       FROM capped c
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(AVG(rating) FILTER (WHERE status = 'approved'), 0) AS avg_rating,
           COUNT(id) FILTER (WHERE status = 'approved') AS review_count
         FROM reviews
         WHERE listing_id = c.id
       ) rev ON true
       ORDER BY
         c.match_rank ASC,
         c.distance_meters ASC NULLS LAST,
         c.name_sim DESC NULLS LAST,
         c.category_relevance DESC NULLS LAST,
         c.is_featured DESC NULLS LAST,
         rev.avg_rating DESC NULLS LAST,
         c.name ASC
       LIMIT $5 OFFSET $6`,
      [
        normalized,
        tokens,
        fuzzyThreshold,
        parentIds,
        listingFetchLimit,
        offset,
        tagOnlyCap,
        lat,
        lng,
        tokenCount,
      ],
    );
  } catch (error) {
    console.error("[mobile-api] places search failed:", error);
    throw new MobileApiError("internal_error", "Failed to search places.", 500);
  }

  const listingRows = listingsRes.rows;
  const listingsHasMore = listingRows.length > limit;
  const listingSlice = listingsHasMore
    ? listingRows.slice(0, limit)
    : listingRows;

  // Primary non-menu thumbnail per hit. Kept as a follow-up query so the
  // ranking CTE stays lean; empty map → client keeps text-only rows.
  const imageByListing = new Map<number, string>();
  const listingIds = listingSlice.map((row) => Number(row.id));
  if (listingIds.length > 0) {
    try {
      const { rows: imageRows } = await query(
        `SELECT DISTINCT ON (listing_id)
           listing_id,
           url
         FROM listing_images
         WHERE listing_id = ANY($1::int[])
           AND url NOT LIKE '%/menu/%'
         ORDER BY listing_id,
           is_primary DESC NULLS LAST,
           display_order ASC NULLS LAST,
           id ASC`,
        [listingIds],
      );
      for (const img of imageRows) {
        imageByListing.set(Number(img.listing_id), img.url as string);
      }

      // Own gallery first, then same-brand sibling cover (incl. archived
      // Peekaboo parents like Melbrew Coffee), then Peekaboo logo.
      const stillMissing = listingSlice
        .map((row) => ({ id: Number(row.id), name: row.name as string | null }))
        .filter((l) => !imageByListing.has(l.id));
      if (stillMissing.length > 0) {
        const borrowed = await getBorrowedHeaderImageUrls(stillMissing);
        for (const [id, url] of borrowed) {
          imageByListing.set(id, url);
        }
      }

      const missingIds = listingIds.filter((id) => !imageByListing.has(id));
      if (missingIds.length > 0) {
        const { rows: logoRows } = await query(
          `SELECT id, custom_attributes->>'peekaboo_logo_url' AS logo_url
           FROM listings
           WHERE id = ANY($1::int[])
             AND NULLIF(custom_attributes->>'peekaboo_logo_url', '') IS NOT NULL`,
          [missingIds],
        );
        for (const row of logoRows) {
          if (row.logo_url) {
            imageByListing.set(Number(row.id), row.logo_url as string);
          }
        }
      }
    } catch (error) {
      console.error("[mobile-api] places search image lookup failed:", error);
    }
  }

  const listings = listingSlice.map((row) => {
    const id = Number(row.id);
    return {
      type: "listing" as const,
      id,
      name: row.name as string | null,
      slug: row.slug as string | null,
      address: row.address as string | null,
      category: row.category_name as string | null,
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
      review_count: row.review_count !== null ? Number(row.review_count) : null,
      distance_meters:
        row.distance_meters !== null && row.distance_meters !== undefined
          ? Number(row.distance_meters)
          : null,
      image_url: imageByListing.get(id) ?? null,
    };
  });

  return ok({
    query: rawQuery,
    categories: [],
    subcategories: [],
    listings,
    total: listings.length,
    listings_offset: offset,
    listings_limit: limit,
    listings_has_more: listingsHasMore,
  });
});
