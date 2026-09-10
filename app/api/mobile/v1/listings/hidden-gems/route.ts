import { type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { MobileApiError } from "@/lib/mobile/errors";
import { mobileRoute } from "@/lib/mobile/handler";
import {
  LISTING_CARD_COLUMNS,
  toListingCard,
  toListingImage,
  toNumericListingRow,
  type ListingImageDTO,
} from "@/lib/mobile/mappers";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/lib/mobile/pagination";
import { ok } from "@/lib/mobile/response";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";

export const dynamic = "force-dynamic";

const MIN_REVIEWS = 3;
const MAX_REVIEWS = 20;
const MIN_RATING = 4.2;
const MAX_FAVORITES = 10;
const BAYES_M = 5;
const FALLBACK_MEAN = 4.0;
const DISCOVERY_MIN_AGE = "30 days";

type HiddenGemSource = "pinned" | "organic" | "backfilled";
type HiddenGemRow = Record<string, unknown> & {
  id: number | string;
  discovery_score: number | string | null;
  favorite_count: number | string | null;
};

const CARD_COLUMNS_QUALIFIED = LISTING_CARD_COLUMNS.split(", ")
  .map((column) => `ld.${column}`)
  .join(", ");

const FAVORITES_CTE = `
  WITH all_time_favorites AS (
    SELECT listing_id, COUNT(*) AS cnt
    FROM favorite_listings
    GROUP BY listing_id
  ),
  published_rating_mean AS (
    SELECT AVG(avg_rating) AS mean_rating
    FROM listings_with_details
    WHERE status = 'published' AND review_count > 0
  )
`;

const ORGANIC_ELIGIBILITY_SQL = `
  ld.status = 'published'
  AND l.hidden_gem_hidden = false
  AND l.hidden_gem_pinned = false
  AND ld.is_featured = false
  AND ld.avg_rating >= $1
  AND ld.review_count BETWEEN $2 AND $3
  AND COALESCE(f.cnt, 0) <= $4
`;

function buildHiddenGemCard(
  row: HiddenGemRow,
  images: ListingImageDTO[],
  source: HiddenGemSource,
) {
  const card = toListingCard(toNumericListingRow(row), images);
  return {
    ...card,
    hidden_gem: {
      source,
      discovery_score:
        row.discovery_score !== null ? Number(row.discovery_score) : null,
      favorite_count: Number(row.favorite_count ?? 0),
    },
  };
}

/**
 * GET /api/mobile/v1/listings/hidden-gems
 *
 * Public, paginated Hidden Gems feed. Its first tier is explicitly curated by
 * admins, followed by high-quality but under-discovered listings: published,
 * non-featured places with a 4.2+ rating, 3-20 reviews, and at most ten
 * favorites. Organic results use Bayesian rating smoothing and a small penalty
 * for favorites, preventing tiny samples or already-popular places from
 * dominating. If the real feed is sparse, page one is backfilled with complete,
 * older unfeatured listings and labelled accordingly.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  let pinnedRows: HiddenGemRow[] = [];
  let organicRows: HiddenGemRow[] = [];
  let organicTotal = 0;
  let backfillRows: HiddenGemRow[] = [];

  try {
    const { rows: pinned } = await query(
      `${FAVORITES_CTE}
       SELECT ${CARD_COLUMNS_QUALIFIED},
              COALESCE(f.cnt, 0) AS favorite_count,
              NULL::numeric AS discovery_score
       FROM listings_with_details ld
       JOIN listings l ON l.id = ld.id
       LEFT JOIN all_time_favorites f ON f.listing_id = ld.id
       WHERE ld.status = 'published'
         AND l.hidden_gem_pinned = true
         AND l.hidden_gem_hidden = false
       ORDER BY l.hidden_gem_pinned_at DESC NULLS LAST, ld.id ASC`,
    );
    pinnedRows = pinned as HiddenGemRow[];

    const { rows: countRows } = await query(
      `${FAVORITES_CTE}
       SELECT COUNT(*)::integer AS total
       FROM listings_with_details ld
       JOIN listings l ON l.id = ld.id
       LEFT JOIN all_time_favorites f ON f.listing_id = ld.id
       WHERE ${ORGANIC_ELIGIBILITY_SQL}`,
      [MIN_RATING, MIN_REVIEWS, MAX_REVIEWS, MAX_FAVORITES],
    );
    organicTotal = Number(countRows[0]?.total ?? 0);

    const pinnedPageRows = pinnedRows.slice(offset, offset + limit);
    const organicNeeded = limit - pinnedPageRows.length;
    const organicOffset = Math.max(0, offset - pinnedRows.length);

    if (organicNeeded > 0) {
      const { rows: organic } = await query(
        `${FAVORITES_CTE}
         SELECT ${CARD_COLUMNS_QUALIFIED},
                COALESCE(f.cnt, 0) AS favorite_count,
                (
                  (ld.review_count::numeric / (ld.review_count + $1)) * ld.avg_rating
                  + ($1::numeric / (ld.review_count + $1))
                    * COALESCE((SELECT mean_rating FROM published_rating_mean), $2)
                  - (LEAST(COALESCE(f.cnt, 0), $3) * 0.02)
                ) AS discovery_score
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         LEFT JOIN all_time_favorites f ON f.listing_id = ld.id
         WHERE ld.status = 'published'
           AND l.hidden_gem_hidden = false
           AND l.hidden_gem_pinned = false
           AND ld.is_featured = false
           AND ld.avg_rating >= $4
           AND ld.review_count BETWEEN $5 AND $6
           AND COALESCE(f.cnt, 0) <= $7
         ORDER BY discovery_score DESC, ld.review_count DESC, ld.id ASC
         LIMIT $8 OFFSET $9`,
        [
          BAYES_M,
          FALLBACK_MEAN,
          MAX_FAVORITES,
          MIN_RATING,
          MIN_REVIEWS,
          MAX_REVIEWS,
          MAX_FAVORITES,
          organicNeeded,
          organicOffset,
        ],
      );
      organicRows = organic as HiddenGemRow[];
    }

    if (page === 1) {
      const shortBy = limit - pinnedPageRows.length - organicRows.length;
      if (shortBy > 0) {
        const excludeIds = [...pinnedRows, ...organicRows].map((row) =>
          Number(row.id),
        );
        const { rows: backfill } = await query(
          `${FAVORITES_CTE}
           SELECT ${CARD_COLUMNS_QUALIFIED},
                  COALESCE(f.cnt, 0) AS favorite_count,
                  NULL::numeric AS discovery_score
           FROM listings_with_details ld
           JOIN listings l ON l.id = ld.id
           LEFT JOIN all_time_favorites f ON f.listing_id = ld.id
           WHERE ld.status = 'published'
             AND l.hidden_gem_hidden = false
             AND ld.is_featured = false
             AND COALESCE(ld.review_count, 0) < $2
             AND ld.created_at <= now() - $3::interval
             AND NULLIF(BTRIM(ld.description), '') IS NOT NULL
             AND NULLIF(BTRIM(ld.address), '') IS NOT NULL
             AND EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = ld.id)
             AND ld.id != ALL($1::int[])
           ORDER BY
             (COALESCE(ld.avg_rating, 0) > 0) DESC,
             COALESCE(ld.avg_rating, 0) DESC,
             ld.created_at ASC,
             ld.id DESC
           LIMIT $4`,
          [excludeIds, MIN_REVIEWS, DISCOVERY_MIN_AGE, shortBy],
        );
        backfillRows = backfill as HiddenGemRow[];
      }
    }

    const pageRows: { row: HiddenGemRow; source: HiddenGemSource }[] = [
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
         ORDER BY listing_id ASC, display_order ASC, id ASC`,
        [listingIds],
      );
      for (const image of images) {
        const listingId = Number(image.listing_id);
        (imagesByListing[listingId] ??= []).push(
          toListingImage({ ...image, id: Number(image.id) }),
        );
      }
    }

    const listings = pageRows.map(({ row, source }) =>
      buildHiddenGemCard(row, imagesByListing[Number(row.id)] ?? [], source),
    );
    const totalItems = Math.max(
      pinnedRows.length + organicTotal,
      listings.length,
    );

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
      "[mobile-api] hidden gems listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load hidden gems.",
      500,
    );
  }
});
