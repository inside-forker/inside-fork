import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  toListingCard,
  toListingImage,
  toNumericListingRow,
  LISTING_CARD_COLUMNS,
  type ListingImageDTO,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

type TrendingSource = "pinned" | "organic" | "backfilled";

type TrendingRow = Record<string, unknown> & { id: number | string };

// `listings_with_details` is a DB-defined view; the trending-override columns
// live on the base `listings` table (added after the view existed), so every
// query below joins back to `listings` for them rather than assuming the view
// exposes them.
const CARD_COLUMNS_QUALIFIED = LISTING_CARD_COLUMNS.split(", ")
  .map((c) => `ld.${c}`)
  .join(", ");

const TRENDING_WINDOW = `now() - interval '7 days'`;

/** Weekly engagement CTEs shared by the organic count + data queries. */
const WEEKLY_SIGNALS_CTE = `
  WITH recent_favorites AS (
    SELECT listing_id, COUNT(*) AS cnt
    FROM favorite_listings
    WHERE created_at >= ${TRENDING_WINDOW}
    GROUP BY listing_id
  ),
  recent_reviews AS (
    SELECT listing_id, COUNT(*) AS cnt, AVG(rating) AS avg_rating
    FROM reviews
    WHERE created_at >= ${TRENDING_WINDOW} AND status = 'approved'
    GROUP BY listing_id
  ),
  recent_checkins AS (
    SELECT qc.related_id AS listing_id, COUNT(*) AS cnt
    FROM qr_scans qs
    JOIN qr_codes qc ON qc.id = qs.qr_code_id
    WHERE qc.qr_type = 'listing' AND qs.scanned_at >= ${TRENDING_WINDOW}
    GROUP BY qc.related_id
  )
`;

/** Eligibility shared by the organic count + data queries (must be kept in sync). */
const ORGANIC_ELIGIBILITY_SQL = `
  ld.status = 'published'
  AND l.trending_hidden = false
  AND l.trending_pinned = false
  AND (ld.avg_rating IS NULL OR ld.avg_rating >= 3.5)
  AND (COALESCE(rf.cnt, 0) + COALESCE(rr.cnt, 0) + COALESCE(rc.cnt, 0)) >= 1
`;

function buildTrendingCard(
  row: Record<string, unknown>,
  images: ListingImageDTO[],
  source: TrendingSource,
) {
  const card = toListingCard(toNumericListingRow(row), images);
  return {
    ...card,
    trending: {
      score: row.trending_score != null ? Number(row.trending_score) : null,
      weekly_favorites: Number(row.weekly_favorites ?? 0),
      weekly_reviews: Number(row.weekly_reviews ?? 0),
      weekly_checkins: Number(row.weekly_checkins ?? 0),
      source,
    },
  };
}

/**
 * GET /api/mobile/v1/listings/trending
 *
 * Public, paginated "Trending Spots This Week" feed. Ranks published listings
 * by real weekly engagement (favorites, reviews, listing check-in QR scans in
 * the last 7 days), gated by a quality floor (avg_rating >= 3.5 or no ratings
 * yet) so a poorly-rated place can't trend on volume alone.
 *
 * Admins can force a listing in (`trending_pinned`) or out (`trending_hidden`)
 * via PATCH /api/admin/listings/[id]/trending-override — pinned listings
 * always sort first (bypassing the eligibility gate entirely), hidden
 * listings are always excluded (hidden wins if both are set). If the
 * genuinely-trending set (pinned + organic) doesn't fill page 1, it's
 * backfilled with the next-best published listings so the feed is never
 * sparse; deeper pages are not backfilled. Every item is tagged with
 * `trending.source` ("pinned" | "organic" | "backfilled") so a client can
 * tell genuine buzz from a curated pick or a backfill.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  let pinnedRows: TrendingRow[] = [];
  let organicRows: TrendingRow[] = [];
  let organicTotal = 0;
  let backfillRows: TrendingRow[] = [];

  try {
    // Tier 1 (pinned) and the organic eligibility count don't depend on each
    // other - only the pagination math below needs both - so they run
    // concurrently rather than as two sequential round trips.
    const [{ rows: pinned }, { rows: countRows }] = await Promise.all([
      // Admin-curated and expected to be a handful of rows, so fetched whole
      // (unpaginated) and sliced in JS alongside the organic tier below.
      query(
        `SELECT ${CARD_COLUMNS_QUALIFIED}
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         WHERE ld.status = 'published'
           AND l.trending_pinned = true
           AND l.trending_hidden = false
         ORDER BY l.trending_pinned_at DESC NULLS LAST, ld.id ASC`,
      ),
      // Tier 2: organic - real weekly-signal scoring, excludes pinned/hidden.
      query(
        `${WEEKLY_SIGNALS_CTE}
         SELECT COUNT(*)::integer AS total
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         LEFT JOIN recent_favorites rf ON rf.listing_id = ld.id
         LEFT JOIN recent_reviews rr ON rr.listing_id = ld.id
         LEFT JOIN recent_checkins rc ON rc.listing_id = ld.id
         WHERE ${ORGANIC_ELIGIBILITY_SQL}`,
      ),
    ]);
    pinnedRows = pinned as TrendingRow[];
    organicTotal = countRows[0]?.total ?? 0;

    // Combined pinned+organic list is ordered [pinned..., organic...]; slicing
    // by the requested offset/limit against that combined list tells us
    // exactly how many pinned rows land on this page and where the organic
    // slice for this page starts, without a single unified SQL query across
    // two very different row shapes.
    const pinnedPageRows = pinnedRows.slice(offset, offset + limit);
    const organicNeeded = limit - pinnedPageRows.length;
    const organicOffset = Math.max(0, offset - pinnedRows.length);

    if (organicNeeded > 0) {
      const { rows: organic } = await query(
        `${WEEKLY_SIGNALS_CTE}
         SELECT ${CARD_COLUMNS_QUALIFIED},
                (
                  COALESCE(rf.cnt, 0) * 3
                  + COALESCE(rr.cnt, 0) * 2 * COALESCE(rr.avg_rating, 0) / 5.0
                  + COALESCE(rc.cnt, 0) * 4
                  + CASE WHEN ld.is_featured THEN 1.5 ELSE 0 END
                ) AS trending_score,
                COALESCE(rf.cnt, 0) AS weekly_favorites,
                COALESCE(rr.cnt, 0) AS weekly_reviews,
                COALESCE(rc.cnt, 0) AS weekly_checkins
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         LEFT JOIN recent_favorites rf ON rf.listing_id = ld.id
         LEFT JOIN recent_reviews rr ON rr.listing_id = ld.id
         LEFT JOIN recent_checkins rc ON rc.listing_id = ld.id
         WHERE ${ORGANIC_ELIGIBILITY_SQL}
         ORDER BY trending_score DESC, ld.avg_rating DESC NULLS LAST, ld.id ASC
         LIMIT $1 OFFSET $2`,
        [organicNeeded, organicOffset],
      );
      organicRows = organic as TrendingRow[];
    }

    // Tier 3: backfill - page 1 only, fills remaining slots so the feed is
    // never sparse when few listings have weekly activity yet.
    if (page === 1) {
      const shownCount = pinnedPageRows.length + organicRows.length;
      const shortBy = limit - shownCount;
      if (shortBy > 0) {
        const excludeIds = [...pinnedRows, ...organicRows].map((r) =>
          Number(r.id),
        );
        const { rows: backfill } = await query(
          // Quality floor excludes only a genuinely bad rating (< 3.5) -
          // `avg_rating` is 0 (not NULL) for listings with zero reviews, so
          // treating 0 the same as NULL keeps unrated listings eligible for
          // backfill instead of the floor silently excluding everything
          // whenever the catalog has little/no review data yet.
          `SELECT ${CARD_COLUMNS_QUALIFIED}
           FROM listings_with_details ld
           JOIN listings l ON l.id = ld.id
           WHERE ld.status = 'published'
             AND l.trending_hidden = false
             AND (ld.avg_rating IS NULL OR ld.avg_rating = 0 OR ld.avg_rating >= 3.5)
             AND ld.id != ALL($1::int[])
           ORDER BY ld.is_featured DESC NULLS LAST, ld.avg_rating DESC NULLS LAST, ld.id ASC
           LIMIT $2`,
          [excludeIds, shortBy],
        );
        backfillRows = backfill as TrendingRow[];
      }
    }

    const pageRows: { row: TrendingRow; source: TrendingSource }[] = [
      ...pinnedPageRows.map((row) => ({ row, source: "pinned" as const })),
      ...organicRows.map((row) => ({ row, source: "organic" as const })),
      ...backfillRows.map((row) => ({ row, source: "backfilled" as const })),
    ];

    const listingIds = pageRows
      .map(({ row }) => Number(row.id))
      .filter((id) => Number.isFinite(id));

    const imagesByListing: Record<number, ListingImageDTO[]> = {};
    if (listingIds.length > 0) {
      const { rows: images } = await query(
        `SELECT id, listing_id, url, alt_text, display_order, is_primary
         FROM listing_images
         WHERE listing_id = ANY($1::int[])
         ORDER BY display_order ASC`,
        [listingIds],
      );
      for (const img of images) {
        (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
      }
    }

    const listings = pageRows.map(({ row, source }) =>
      buildTrendingCard(row, imagesByListing[Number(row.id)] ?? [], source),
    );

    // The "real" trending count is pinned + organic (backfill isn't part of
    // the genuine trending set). But on page 1, backfill can pad the actual
    // returned count above that - if we reported the smaller number here,
    // the response would say e.g. "0 total" while rendering 5 listings,
    // which is self-contradictory on the very page a client is looking at.
    // Floor the reported total at what's actually being returned.
    const totalItems = Math.max(pinnedRows.length + organicTotal, listings.length);

    return ok(
      listings,
      { pagination: buildPaginationMeta(page, limit, totalItems) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error(
      "[mobile-api] trending listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load trending listings.",
      500,
    );
  }
});
