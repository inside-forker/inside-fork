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
  LISTING_CARD_COLUMNS,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

/** Minimum approved insider reviews for a listing to rank organically. */
const MIN_INSIDER_REVIEWS = 2;
/** Bayesian smoothing constant - reviews below this are pulled toward the global mean. */
const BAYES_M = 5;
/** Fallback global mean when there are no insider reviews at all (pure cold start). */
const FALLBACK_MEAN = 4.0;

type TopRatedSource = "pinned" | "insider" | "backfilled";

type TopRatedRow = Record<string, unknown> & { id: number | string };

/** `id`/`category_id`/etc come back as strings from pg for bigint columns - convert before use. Mirrors listings/route.ts. */
function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

// `listings_with_details` is a DB-defined view; the override columns live on
// the base `listings` table, so every query joins back to `listings` for them.
const CARD_COLUMNS_QUALIFIED = LISTING_CARD_COLUMNS.split(", ")
  .map((c) => `ld.${c}`)
  .join(", ");

// "Insider" = the two highest-XP active ranks (Influencer + INSIDER). Derived
// by ordering the ranks table rather than hardcoding names/slugs/XP (those
// thresholds live only in the DB), so it survives a rank rename. A review is
// an insider review when its author currently holds one of those ranks.
const INSIDER_CTE = `
  WITH insider_rank_ids AS (
    SELECT id FROM ranks WHERE is_active = true
    ORDER BY min_xp_required DESC
    LIMIT 2
  ),
  insider_reviews AS (
    SELECT r.listing_id, COUNT(*) AS cnt, AVG(r.rating) AS avg_rating
    FROM reviews r
    JOIN user_ranks ur ON ur.user_id = r.user_id AND ur.current_rank = true
    WHERE r.status = 'approved'
      AND ur.rank_id IN (SELECT id FROM insider_rank_ids)
    GROUP BY r.listing_id
  ),
  insider_global AS (
    SELECT AVG(r.rating) AS c
    FROM reviews r
    JOIN user_ranks ur ON ur.user_id = r.user_id AND ur.current_rank = true
    WHERE r.status = 'approved'
      AND ur.rank_id IN (SELECT id FROM insider_rank_ids)
  )
`;

function buildTopRatedCard(
  row: Record<string, unknown>,
  images: ListingImageDTO[],
  source: TopRatedSource,
) {
  const card = toListingCard(toNumericListingRow(row), images);
  return {
    ...card,
    top_rated: {
      insider_rating:
        row.insider_avg_rating != null ? Number(row.insider_avg_rating) : null,
      insider_review_count: Number(row.insider_review_count ?? 0),
      weighted_score:
        row.weighted_score != null ? Number(row.weighted_score) : null,
      source,
    },
  };
}

/**
 * GET /api/mobile/v1/listings/top-rated
 *
 * Public, paginated "Top Rated by Insiders" feed. Ranks published listings by
 * a Bayesian-weighted average of ratings from *insider* reviewers only -
 * users who currently hold one of the top two gamification ranks (Influencer
 * or INSIDER) - so the list reflects trusted community members rather than a
 * raw average of everyone. A listing needs at least MIN_INSIDER_REVIEWS
 * insider reviews to rank organically, and the Bayesian smoothing prevents a
 * single glowing insider review from topping listings with a deeper track
 * record.
 *
 * Admins can force a listing in (`top_rated_pinned`) or out
 * (`top_rated_hidden`) via PATCH /api/admin/listings/[id]/top-rated-override -
 * pinned listings sort first (bypassing the eligibility gate), hidden
 * listings are always excluded (hidden wins if both are set). If the
 * genuinely-qualified set (pinned + insider) doesn't fill page 1, it's
 * backfilled with the next best-rated published listings so the feed is never
 * sparse; deeper pages are not backfilled. Every item is tagged with
 * `top_rated.source` ("pinned" | "insider" | "backfilled").
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  let pinnedRows: TopRatedRow[] = [];
  let insiderRows: TopRatedRow[] = [];
  let insiderTotal = 0;
  let backfillRows: TopRatedRow[] = [];

  try {
    // Pinned tier and the insider eligibility count are independent of each
    // other - only the pagination math below needs both - so run concurrently
    // instead of as two sequential round trips.
    const [{ rows: pinned }, { rows: countRows }] = await Promise.all([
      // Tier 1: pinned - always shown, always first, no eligibility gate.
      // Admin-curated (a handful of rows), fetched whole and sliced in JS.
      query(
        `${INSIDER_CTE}
         SELECT ${CARD_COLUMNS_QUALIFIED},
                ir.cnt AS insider_review_count,
                ir.avg_rating AS insider_avg_rating,
                NULL::numeric AS weighted_score
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         LEFT JOIN insider_reviews ir ON ir.listing_id = ld.id
         WHERE ld.status = 'published'
           AND l.top_rated_pinned = true
           AND l.top_rated_hidden = false
         ORDER BY l.top_rated_pinned_at DESC NULLS LAST, ld.id ASC`,
      ),
      // Tier 2: insider - Bayesian-weighted insider rating, excludes pinned/hidden.
      query(
        `${INSIDER_CTE}
         SELECT COUNT(*)::integer AS total
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         JOIN insider_reviews ir ON ir.listing_id = ld.id
         WHERE ld.status = 'published'
           AND l.top_rated_hidden = false
           AND l.top_rated_pinned = false
           AND ir.cnt >= $1`,
        [MIN_INSIDER_REVIEWS],
      ),
    ]);
    pinnedRows = pinned as TopRatedRow[];
    insiderTotal = countRows[0]?.total ?? 0;

    const pinnedPageRows = pinnedRows.slice(offset, offset + limit);
    const insiderNeeded = limit - pinnedPageRows.length;
    const insiderOffset = Math.max(0, offset - pinnedRows.length);

    if (insiderNeeded > 0) {
      const { rows: insider } = await query(
        `${INSIDER_CTE}
         SELECT ${CARD_COLUMNS_QUALIFIED},
                ir.cnt AS insider_review_count,
                ir.avg_rating AS insider_avg_rating,
                (
                  (ir.cnt::numeric / (ir.cnt + $1)) * ir.avg_rating
                  + ($1::numeric / (ir.cnt + $1)) * COALESCE((SELECT c FROM insider_global), $2)
                ) AS weighted_score
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         JOIN insider_reviews ir ON ir.listing_id = ld.id
         WHERE ld.status = 'published'
           AND l.top_rated_hidden = false
           AND l.top_rated_pinned = false
           AND ir.cnt >= $3
         ORDER BY weighted_score DESC, ir.cnt DESC, ld.id ASC
         LIMIT $4 OFFSET $5`,
        [BAYES_M, FALLBACK_MEAN, MIN_INSIDER_REVIEWS, insiderNeeded, insiderOffset],
      );
      insiderRows = insider as TopRatedRow[];
    }

    // Tier 3: backfill - page 1 only, fills remaining slots with the next
    // best-rated published listings so the feed is never sparse.
    if (page === 1) {
      const shownCount = pinnedPageRows.length + insiderRows.length;
      const shortBy = limit - shownCount;
      if (shortBy > 0) {
        const excludeIds = [...pinnedRows, ...insiderRows].map((r) =>
          Number(r.id),
        );
        const { rows: backfill } = await query(
          // No review_count floor here: the whole point of backfill is to
          // guarantee non-empty results when the insider tier can't fill the
          // page, including the case where the catalog has zero reviews
          // anywhere yet - a `review_count >= 1` floor made backfill itself
          // return nothing in exactly that situation. Ordering still puts any
          // real rating first; zero-review listings just sort last.
          `SELECT ${CARD_COLUMNS_QUALIFIED},
                  NULL::bigint AS insider_review_count,
                  NULL::numeric AS insider_avg_rating,
                  NULL::numeric AS weighted_score
           FROM listings_with_details ld
           JOIN listings l ON l.id = ld.id
           WHERE ld.status = 'published'
             AND l.top_rated_hidden = false
             AND ld.id != ALL($1::int[])
           ORDER BY ld.avg_rating DESC NULLS LAST, ld.review_count DESC, ld.id ASC
           LIMIT $2`,
          [excludeIds, shortBy],
        );
        backfillRows = backfill as TopRatedRow[];
      }
    }

    const pageRows: { row: TopRatedRow; source: TopRatedSource }[] = [
      ...pinnedPageRows.map((row) => ({ row, source: "pinned" as const })),
      ...insiderRows.map((row) => ({ row, source: "insider" as const })),
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
      buildTopRatedCard(row, imagesByListing[Number(row.id)] ?? [], source),
    );

    // "Real" total is pinned + insider (backfill isn't part of the genuine
    // set), but floor it at what's actually returned so page 1 never reports
    // fewer items than it renders.
    const totalItems = Math.max(pinnedRows.length + insiderTotal, listings.length);

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
      "[mobile-api] top-rated listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load top-rated listings.",
      500,
    );
  }
});
