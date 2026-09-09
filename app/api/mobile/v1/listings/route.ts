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
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";
import { fetchBestDealsByListing, type ListingDeals } from "@/lib/mobile/listing-deals";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { sortFetchedListingsBySearchRelevance } from "@/lib/listings/search-relevance";
import {
  resolveCategoryIdScope,
  listingCategoriesExistsClause,
} from "@/lib/listings/category-scope";

/** Explicit column list for `listings_with_details` - never use `*`. */
const LISTING_CARD_SQL_COLUMNS =
  "id, name, slug, description, address, category_id, category_name, latitude, longitude, avg_rating, review_count, is_featured, status, menu_pdf_url, google_maps_url";

/** `id`/`category_id`/etc come back as strings from pg for bigint columns - convert before use. */
function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

export const dynamic = "force-dynamic";

/** Sorts supported in this version. Deal/distance-ranked sorts are not yet wired. */
const SUPPORTED_SORTS = new Set([
  "featured",
  "rating",
  "top-rated",
  "newest",
  "name",
]);

/**
 * GET /api/mobile/v1/listings
 *
 * Public, paginated list of published listings. Supports the common filters
 * (category, search, rating, open_now, exclude_featured) and the order-based
 * sorts in {@link SUPPORTED_SORTS}. Deal/distance-ranked sorts (`distance`,
 * `best-deals`, `max-discount`) and deal filters (`deals`, `bank`, `card`) are
 * not yet implemented and are rejected rather than silently ignored.
 *
 * `category` is the stringified integer id from GET /categories (contract
 * section 1, IDs) - not a slug. An id with no matching category (or a
 * non-numeric value) is treated as no filter, same as omitting it.
 *
 * `primary_only=true` restricts the category match to each listing's
 * primary category, ignoring secondary tags - use for curated single-theme
 * carousels where a listing's secondary tags shouldn't qualify it.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 9,
    maxLimit: 50,
  });

  const categoryParam =
    searchParams.get("sub") ??
    searchParams.get("subCategory") ??
    searchParams.get("category");
  const rawSearch = searchParams.get("search");
  const sanitizedSearch =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";
  const sort = searchParams.get("sort") ?? "featured";
  if (!SUPPORTED_SORTS.has(sort)) {
    throw new MobileApiError(
      "unsupported_sort",
      `Sort '${sort}' is not supported in this version of the API.`,
      400,
      "sort",
    );
  }
  const minRating = searchParams.get("rating");
  const excludeFeatured = searchParams.get("exclude_featured") === "true";
  // Client-generated once per screen visit (not per request) - keeps the
  // shuffle stable across pagination within one visit, but different on the
  // next visit. Bound as a query param below, never concatenated into SQL.
  const shuffleSeedRaw = searchParams.get("shuffleSeed");
  const shuffleSeed =
    shuffleSeedRaw && shuffleSeedRaw.length > 0 && shuffleSeedRaw.length <= 64
      ? shuffleSeedRaw
      : null;
  // Curated single-identity carousels (e.g. Home's "Retail Therapy") pass
  // this so a listing's secondary category tags don't qualify it - only its
  // primary category counts.
  const primaryOnly = searchParams.get("primary_only") === "true";

  // Resolve a category id (per the mobile contract, `category` is the
  // stringified integer id returned by GET /categories, not a slug) to the
  // set of category ids covering it and its subcategories.
  let categoryIds: number[] = [];
  if (categoryParam && categoryParam !== "all") {
    const categoryId = Number(categoryParam);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      categoryIds = await resolveCategoryIdScope(categoryId);
    }
  }

  const whereClauses: string[] = [`status = 'published'`];
  const params: unknown[] = [];

  if (categoryIds.length > 0) {
    params.push(categoryIds);
    whereClauses.push(
      listingCategoriesExistsClause("listings_with_details.id", params.length, {
        primaryOnly,
      }),
    );
  }

  if (sanitizedSearch) {
    params.push(`%${sanitizedSearch}%`);
    const idx = params.length;
    whereClauses.push(
      `(name ILIKE $${idx} OR description ILIKE $${idx} OR address ILIKE $${idx})`,
    );
  }

  if (minRating) {
    const rating = parseFloat(minRating);
    if (!Number.isNaN(rating)) {
      params.push(rating);
      whereClauses.push(`avg_rating >= $${params.length}`);
    }
  }

  if (excludeFeatured) {
    whereClauses.push(`is_featured = false`);
  }

  // Placeholder swapped for the real $N once dataParams is finalized below -
  // kept out of the shared `params` array so the COUNT query (which doesn't
  // need it) never sees it.
  const SHUFFLE_SEED_PLACEHOLDER = "$SHUFFLE_SEED";
  const usesShuffleSeed = sort === "featured" && shuffleSeed !== null;

  let orderBySql: string;
  switch (sort) {
    case "rating":
    case "top-rated":
      orderBySql = `avg_rating DESC NULLS LAST, id ASC`;
      break;
    case "newest":
      orderBySql = `created_at DESC, id ASC`;
      break;
    case "name":
      orderBySql = `name ASC, id ASC`;
      break;
    default:
      // Ratings 3.5-5 float to the top; within that tier, order is a stable
      // pseudo-random shuffle keyed by shuffleSeed - same seed always
      // produces the same order (so pagination within one screen visit
      // never duplicates/skips a listing), but a client that generates a
      // fresh seed per visit sees a different shuffle each time it opens
      // the screen. Without a seed, this tier still floats to the top, just
      // in the previous stable order.
      orderBySql = usesShuffleSeed
        ? `(avg_rating IS NOT NULL AND avg_rating >= 3.5) DESC, md5(id::text || ${SHUFFLE_SEED_PLACEHOLDER}) ASC, is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC`
        : `(avg_rating IS NOT NULL AND avg_rating >= 3.5) DESC, is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC`;
      break;
  }

  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  let data: ListingRowLike[];
  let count: number;
  try {
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM listings_with_details ${whereSql}`,
      params,
    );
    count = parseInt(countRows[0].count, 10);

    const dataParams = [...params];
    let finalOrderBySql = orderBySql;
    if (usesShuffleSeed) {
      dataParams.push(shuffleSeed);
      finalOrderBySql = finalOrderBySql.replace(
        SHUFFLE_SEED_PLACEHOLDER,
        `$${dataParams.length}`,
      );
    }
    dataParams.push(limit, offset);

    const { rows } = await query(
      `SELECT ${LISTING_CARD_SQL_COLUMNS} FROM listings_with_details
       ${whereSql}
       ORDER BY ${finalOrderBySql}
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );
    data = rows.map(toNumericListingRow);
  } catch (error) {
    console.error(
      "[mobile-api] listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load listings.", 500);
  }

  let rows = data ?? [];
  // Match the website's per-page relevance ordering for searches (parity with
  // /api/listings/paginated) so name-prefix matches float to the top.
  if (sanitizedSearch.length >= 2) {
    rows = sortFetchedListingsBySearchRelevance(
      rows as never,
      sanitizedSearch,
    ) as unknown as ListingRowLike[];
  }

  const listingIds = rows
    .map((r) => r.id)
    .filter((id): id is number => typeof id === "number");

  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  // Browse rows lead with a discount badge, so the page's deals are fetched
  // alongside its images rather than left to a per-card follow-up request.
  let dealsByListing: Record<number, ListingDeals> = {};
  if (listingIds.length > 0) {
    const [{ rows: images }, deals] = await Promise.all([
      query(
        `SELECT id, listing_id, url, alt_text, display_order, is_primary
       FROM listing_images
       WHERE listing_id = ANY($1::int[])
       ORDER BY display_order ASC`,
        [listingIds],
      ),
      fetchBestDealsByListing(listingIds),
    ]);
    dealsByListing = deals;

    for (const img of images) {
      (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
    }
  }

  const listings = rows
    .filter((r) => typeof r.id === "number")
    .map((r) =>
      toListingCard(
        r,
        imagesByListing[r.id as number] ?? [],
        // `?? null` (not `undefined`) so a listing with no active deal still
        // reports `best_deal: null` — the client can tell "no offer" apart
        // from an endpoint that never loaded deals at all.
        dealsByListing[r.id as number] ?? null,
      ),
    );

  return ok(listings, {
    pagination: buildPaginationMeta(page, limit, count ?? 0),
  });
});
