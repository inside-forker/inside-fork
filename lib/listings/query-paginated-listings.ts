import { query } from "@/lib/db";
import { getNearbyListings } from "@/app/actions/nearby-listings";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import {
  compareSearchRankThenIds,
  sortFetchedListingsBySearchRelevance,
} from "@/lib/listings/search-relevance";
import {
  resolveCategoryBySlugWithScope,
  listingCategoriesExistsClause,
} from "@/lib/listings/category-scope";

export type QueryListingsFilters = {
  page?: number;
  limit?: number;
  categorySlug?: string | null;
  search?: string | null;
  sort?: string;
  minRating?: string | null;
  dealsOnly?: boolean;
  bankParam?: string | null;
  cardParam?: string | null;
  openNow?: boolean;
  excludeFeatured?: boolean;
  lat?: number;
  lng?: number;
};

type ListingRow = Record<string, unknown> & { id?: number | null };

const sortRequiresDeals = (sortKey?: string) =>
  sortKey === "max-discount" || sortKey === "best-deals";

// listing_branches.is_open_now is a stale, never-computed import snapshot
// (always false). Compute it live from `timings` ("HH:MM:SS-HH:MM:SS",
// validated by regex so malformed rows are excluded rather than erroring
// on the ::time cast) against the current time in Asia/Karachi, handling
// ranges that span midnight (open > close).
export const OPEN_NOW_EXISTS_CLAUSE = `EXISTS (
  SELECT 1 FROM listing_branches lb
  WHERE lb.listing_id = listings_with_details.id
    AND lb.timings ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}$'
    AND (
      CASE
        WHEN split_part(lb.timings, '-', 1)::time <= split_part(lb.timings, '-', 2)::time THEN
          (now() AT TIME ZONE 'Asia/Karachi')::time
            BETWEEN split_part(lb.timings, '-', 1)::time AND split_part(lb.timings, '-', 2)::time
        ELSE
          (now() AT TIME ZONE 'Asia/Karachi')::time >= split_part(lb.timings, '-', 1)::time
          OR (now() AT TIME ZONE 'Asia/Karachi')::time <= split_part(lb.timings, '-', 2)::time
      END
    )
)`;

// Listings open on the current day during nightly hours (e.g. crossing midnight or open in the evening/night >= 20:00).
export const OPEN_TONIGHT_EXISTS_CLAUSE = `(
  EXISTS (
    SELECT 1 FROM listing_branches lb
    WHERE lb.listing_id = listings_with_details.id
      AND lb.timings ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}$'
      AND (
        split_part(lb.timings, '-', 1)::time > split_part(lb.timings, '-', 2)::time
        OR (
          split_part(lb.timings, '-', 2)::time >= '20:00:00'::time
          AND split_part(lb.timings, '-', 1)::time <= '22:00:00'::time
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM opening_hours oh
    WHERE oh.listing_id = listings_with_details.id
      AND oh.day_of_week = EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Karachi'))::int
      AND oh.is_closed = false
      AND oh.open_time IS NOT NULL
      AND oh.close_time IS NOT NULL
      AND (
        oh.close_time <= oh.open_time
        OR (
          oh.close_time >= '20:00:00'::time
          AND oh.open_time <= '22:00:00'::time
        )
      )
  )
)`;


export async function attachListingImages(listings: ListingRow[]) {
  const listingIds = listings
    .map((l) => l.id)
    .filter((id): id is number => typeof id === "number");

  const imagesMap: Record<number, Record<string, unknown>[]> = {};
  if (listingIds.length > 0) {
    const { rows: images } = await query(
      `SELECT * FROM listing_images
       WHERE listing_id = ANY($1)
       ORDER BY display_order ASC`,
      [listingIds],
    );
    for (const img of images) {
      const listingId = img.listing_id as number;
      if (!imagesMap[listingId]) imagesMap[listingId] = [];
      imagesMap[listingId].push(img);
    }
  }

  return listings.map((listing) => ({
    ...listing,
    images: listing.id ? imagesMap[listing.id] || [] : [],
  }));
}

export async function queryPaginatedListings(filters: QueryListingsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 9));
  const offset = (page - 1) * limit;
  const sort = filters.sort || "featured";

  const whereClauses: string[] = ["status = 'published'"];
  const queryParams: unknown[] = [];

  if (filters.excludeFeatured) {
    whereClauses.push("is_featured = false");
  }

  const resolvedCategory = await resolveCategoryBySlugWithScope(
    filters.categorySlug,
  );
  if (resolvedCategory && resolvedCategory.categoryIds.length > 0) {
    queryParams.push(resolvedCategory.categoryIds);
    whereClauses.push(
      listingCategoriesExistsClause(
        "listings_with_details.id",
        queryParams.length,
      ),
    );
  }

  const searchTerm = filters.search?.trim()
    ? sanitizeSearchTerm(filters.search)
    : "";
  if (searchTerm) {
    queryParams.push(`%${searchTerm}%`);
    const idx = queryParams.length;
    whereClauses.push(
      `(name ILIKE $${idx} OR description ILIKE $${idx} OR address ILIKE $${idx})`,
    );
  }

  if (filters.minRating) {
    const rating = parseFloat(filters.minRating);
    if (!Number.isNaN(rating)) {
      queryParams.push(rating);
      whereClauses.push(`avg_rating >= $${queryParams.length}`);
    }
  }

  if (filters.openNow) {
    whereClauses.push(OPEN_NOW_EXISTS_CLAUSE);
  }

  const needsDeals =
    filters.dealsOnly ||
    !!filters.bankParam ||
    !!filters.cardParam ||
    sortRequiresDeals(sort);

  const maxDiscountByListingId: Record<number, number> = {};

  if (needsDeals) {
    const { rows: dealRows } = await query(
      `SELECT listing_id, discount_value, is_active, bank_id, valid_card_variants, end_date
       FROM deals`,
    );

    const nowMs = Date.now();
    const bankId = filters.bankParam ? parseInt(filters.bankParam, 10) : null;
    const cardId = filters.cardParam ? parseInt(filters.cardParam, 10) : null;
    const filteredIds = new Set<number>();

    for (const deal of dealRows) {
      if (deal.listing_id == null) continue;
      const lid = deal.listing_id as number;
      const endMs = deal.end_date
        ? Date.parse(String(deal.end_date))
        : Number.POSITIVE_INFINITY;
      const isActiveNow = Boolean(deal.is_active) && endMs >= nowMs;

      let maxDiscount = 0;
      if (deal.discount_value) {
        const match = String(deal.discount_value).match(/(\d+)(?=%)/);
        if (match) maxDiscount = parseInt(match[1], 10);
      }
      maxDiscountByListingId[lid] = Math.max(
        maxDiscountByListingId[lid] || 0,
        maxDiscount,
      );

      const bankMatch =
        bankId != null && !Number.isNaN(bankId)
          ? deal.bank_id === bankId
          : true;
      const cardMatch =
        cardId != null && !Number.isNaN(cardId)
          ? Array.isArray(deal.valid_card_variants) &&
            deal.valid_card_variants.includes(cardId)
          : true;
      const dealsMatch = filters.dealsOnly ? isActiveNow : true;

      if (dealsMatch && bankMatch && cardMatch) {
        filteredIds.add(lid);
      }
    }

    const dealIds = Array.from(filteredIds);
    if (dealIds.length === 0) {
      return {
        listings: [],
        totalItems: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    queryParams.push(dealIds);
    whereClauses.push(`id = ANY($${queryParams.length})`);
  }

  const whereSql = whereClauses.join(" AND ");

  const getCount = async () => {
    const { rows } = await query(
      `SELECT COUNT(*)::integer AS total FROM listings_with_details WHERE ${whereSql}`,
      queryParams,
    );
    return (rows[0]?.total as number) || 0;
  };

  let orderByClause =
    "ORDER BY is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id ASC";
  switch (sort) {
    case "rating":
    case "top-rated":
      orderByClause = "ORDER BY avg_rating DESC NULLS LAST, id ASC";
      break;
    case "newest":
      orderByClause = "ORDER BY created_at DESC, id ASC";
      break;
    case "name":
      orderByClause = "ORDER BY name ASC, id ASC";
      break;
    case "trending":
      // Mirrors the previous in-memory scoring formula:
      // (is_featured ? 50 : 0) + avg_rating*10 - age_in_days
      orderByClause =
        "ORDER BY (CASE WHEN is_featured THEN 50 ELSE 0 END) " +
        "+ COALESCE(avg_rating, 0) * 10 " +
        "- EXTRACT(EPOCH FROM (now() - created_at)) / 86400 DESC, id ASC";
      break;
  }

  const hasDistanceSort =
    sort === "distance" &&
    filters.lat != null &&
    !Number.isNaN(filters.lat) &&
    filters.lng != null &&
    !Number.isNaN(filters.lng);

  let listings: ListingRow[] = [];
  let totalItems = 0;

  if (hasDistanceSort || sortRequiresDeals(sort)) {
    const { rows } = await query(
      `SELECT * FROM listings_with_details WHERE ${whereSql}`,
      queryParams,
    );

    let sorted = rows as ListingRow[];

    if (hasDistanceSort) {
      const nearby = await getNearbyListings({
        lat: filters.lat!,
        lng: filters.lng!,
        radius: 50000,
        limit: 100,
      });

      const distanceMap = new Map<number, number>();
      if (nearby.success) {
        nearby.data.forEach((item) => {
          distanceMap.set(item.id, item.distance_meters);
        });
      }

      sorted = sorted
        .filter((row) => row.id != null && distanceMap.has(row.id))
        .map((row) => ({
          ...row,
          distance_meters: row.id != null ? distanceMap.get(row.id) : undefined,
        }))
        .sort((a, b) => {
          const distA =
            typeof a.distance_meters === "number"
              ? a.distance_meters
              : Number.POSITIVE_INFINITY;
          const distB =
            typeof b.distance_meters === "number"
              ? b.distance_meters
              : Number.POSITIVE_INFINITY;
          return compareSearchRankThenIds(a, b, filters.search ?? undefined, distA - distB);
        });
    } else {
      sorted = [...sorted].sort((a, b) => {
        const discountA = a.id != null ? maxDiscountByListingId[a.id] || 0 : 0;
        const discountB = b.id != null ? maxDiscountByListingId[b.id] || 0 : 0;
        return compareSearchRankThenIds(
          a,
          b,
          filters.search ?? undefined,
          discountB - discountA,
        );
      });
    }

    totalItems = sorted.length;
    listings = sorted.slice(offset, offset + limit);
  } else {
    totalItems = await getCount();
    const limitIdx = queryParams.length + 1;
    const offsetIdx = queryParams.length + 2;
    const { rows } = await query(
      `SELECT * FROM listings_with_details
       WHERE ${whereSql}
       ${orderByClause}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...queryParams, limit, offset],
    );
    listings = rows as ListingRow[];

    if (searchTerm.length >= 2) {
      listings = sortFetchedListingsBySearchRelevance(
        listings as never,
        searchTerm,
      ) as ListingRow[];
    }
  }

  // node-pg returns bigint columns (id) as strings; attachListingImages
  // requires a real number to collect/match listing IDs.
  listings = listings.map((l) => ({
    ...l,
    id: l.id !== null && l.id !== undefined ? Number(l.id) : l.id,
  }));

  const enrichedListings = await attachListingImages(listings);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    listings: enrichedListings,
    totalItems,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
