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
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
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

async function searchUpcomingEvents({
  searchTerm,
  limit,
  offset,
  lat,
  lng,
}: {
  searchTerm: string;
  limit: number;
  offset: number;
  lat: number | null;
  lng: number | null;
}) {
  const hasLoc = lat != null && lng != null;
  const cleanTerm = sanitizeSearchTerm(searchTerm);
  if (!cleanTerm) return { rows: [], hasMore: false };

  const queryParams: unknown[] = [`${cleanTerm}%`, `%${cleanTerm}%`];
  let latIdx = 0;
  let lngIdx = 0;
  if (hasLoc) {
    queryParams.push(lat);
    latIdx = queryParams.length;
    queryParams.push(lng);
    lngIdx = queryParams.length;
  }
  queryParams.push(limit + 1);
  const limitIdx = queryParams.length;
  queryParams.push(offset);
  const offsetIdx = queryParams.length;

  const distanceExpr = hasLoc
    ? `(6371000 * acos(least(1, greatest(-1, cos(radians($${latIdx})) * cos(radians(e.latitude)) * cos(radians(e.longitude) - radians($${lngIdx})) + sin(radians($${latIdx})) * sin(radians(e.latitude))))))`
    : "NULL::double precision";

  const sql = `
    SELECT
      e.id,
      e.name,
      e.slug,
      COALESCE(e.location_name, e.address) AS address,
      c.name AS category_name,
      to_json(e.start_time) #>> '{}' AS start_time,
      to_json(e.end_time) #>> '{}' AS end_time,
      v.rating AS venue_rating,
      CASE
        WHEN e.name ILIKE $1 THEN 1
        WHEN e.name ILIKE $2 THEN 2
        WHEN c.name ILIKE $2 OR e.location_name ILIKE $2 THEN 3
        ELSE 4
      END AS match_rank,
      ${distanceExpr} AS distance_meters
    FROM events e
    LEFT JOIN categories c ON c.id = e.category_id
    LEFT JOIN venues v ON v.id = e.venue_id
    WHERE e.status = 'published'
      AND e.end_time >= NOW()
      AND (
        e.name ILIKE $2
        OR e.description ILIKE $2
        OR e.location_name ILIKE $2
        OR e.address ILIKE $2
        OR c.name ILIKE $2
      )
    ORDER BY
      match_rank ASC,
      ${hasLoc ? "distance_meters ASC NULLS LAST," : ""}
      e.start_time ASC,
      e.id ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, queryParams);
  const hasMore = res.rows.length > limit;
  const slice = hasMore ? res.rows.slice(0, limit) : res.rows;
  const eventIds = slice.map((r) => Number(r.id));
  const imageMap = await fetchPrimaryImagesByEventId(eventIds);

  const rows = slice.map((row) => ({
    type: "event" as const,
    id: Number(row.id),
    name: row.name as string | null,
    slug: row.slug as string | null,
    address: row.address as string | null,
    category: (row.category_name as string | null) || "Event",
    avg_rating: row.venue_rating != null ? Number(row.venue_rating) : null,
    review_count: null,
    distance_meters:
      row.distance_meters != null ? Number(row.distance_meters) : null,
    image_url: imageMap.get(Number(row.id)) ?? null,
    start_time: row.start_time as string | null,
    end_time: row.end_time as string | null,
    match_rank: Number(row.match_rank),
  }));

  return { rows, hasMore };
}

/**
 * GET /api/mobile/v1/search/places?q=&limit=&offset=&lat=&lng=&type=
 *
 * Fast path: resolve matching categories once, pull candidate listing ids via
 * name/address trigram + tag links, then score/rank only that subset.
 * Also searches published upcoming events in parallel or exclusively by type.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const searchType = (searchParams.get("type") ?? "all").toLowerCase();
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

  // Fast path: if the user specifically asked for events only, skip the heavy places query completely.
  if (searchType === "events") {
    const eventsRes = await searchUpcomingEvents({
      searchTerm: rawQuery,
      limit,
      offset,
      lat,
      lng,
    });
    return ok({
      query: rawQuery,
      categories: [],
      subcategories: [],
      listings: eventsRes.rows,
      total: eventsRes.rows.length,
      listings_offset: offset,
      listings_limit: limit,
      listings_has_more: eventsRes.hasMore,
    });
  }

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

  // If searchType is "all", query events concurrently with the places query
  const eventsPromise =
    searchType === "all"
      ? searchUpcomingEvents({
          searchTerm: rawQuery,
          limit: Math.min(6, limit),
          offset,
          lat,
          lng,
        })
      : null;

  let listingsRes;
  let eventsRes: Awaited<ReturnType<typeof searchUpcomingEvents>> | null = null;

  try {
    const [listingsQueryResult, eventsQueryResult] = await Promise.all([
      query(
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
    ),
      eventsPromise,
    ]);
    listingsRes = listingsQueryResult;
    eventsRes = eventsQueryResult;
  } catch (error) {
    console.error("[mobile-api] places search failed:", error);
    throw new MobileApiError("internal_error", "Failed to search places.", 500);
  }

  const listingRows = listingsRes.rows;
  const listingsHasMore = listingRows.length > limit;
  const listingSlice = listingsHasMore
    ? listingRows.slice(0, limit)
    : listingRows;

  // No thumbnails in places search — borrowed/logo covers repeat across every
  // same-brand branch (e.g. all KFCs showing one burger). Detail still borrows
  // a header; search stays text-only.
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
      image_url: null,
    };
  });

  let finalListings: Array<
    | (typeof listings)[number]
    | NonNullable<typeof eventsRes>["rows"][number]
  > = listings;

  if (eventsRes && eventsRes.rows.length > 0) {
    const directEvents = eventsRes.rows.filter((e) => e.match_rank <= 2);
    const otherEvents = eventsRes.rows.filter((e) => e.match_rank > 2);
    finalListings = [
      ...directEvents,
      ...listings,
      ...otherEvents,
    ].slice(0, limit);
  }

  return ok({
    query: rawQuery,
    categories: [],
    subcategories: [],
    listings: finalListings,
    total: finalListings.length,
    listings_offset: offset,
    listings_limit: limit,
    listings_has_more: listingsHasMore || (eventsRes?.hasMore ?? false),
  });
});
