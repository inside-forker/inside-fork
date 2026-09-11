import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { query } from "@/lib/db";
import {
  LISTING_CARD_COLUMNS,
  toListingCard,
  toListingImage,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

function toNumericListingRow(row: Record<string, unknown>): ListingRowLike {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  } as unknown as ListingRowLike;
}

/**
 * GET /api/mobile/v1/favorites/list?page=&limit=
 *
 * The caller's favorited listings as paginated ListingCards, most-recently
 * favorited first. Favorites whose listing is no longer published are omitted
 * from the page (filtered by `status = 'published'`) though they still count
 * toward the total.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 9,
    maxLimit: 50,
  });

  // Page over the user's favorites, newest first. The page and its total are
  // fetched in ONE statement via a window function rather than two queries in
  // a `Promise.all`: the production pool is capped at `max: 1` connection per
  // serverless instance (see lib/db.ts), so a second concurrent query cannot
  // actually run in parallel - it queues on the sole connection while racing
  // `connectionTimeoutMillis` (10s), which is what made this screen fail
  // intermittently while unrelated screens loaded fine.
  const { rows: favRows } = await query(
    `SELECT fl.listing_id, COUNT(*) OVER () AS total_count
     FROM favorite_listings fl
     JOIN listings_with_details l ON l.id = fl.listing_id AND l.status = 'published'
     WHERE fl.user_id = $1
     ORDER BY fl.created_at DESC LIMIT $2 OFFSET $3`,
    [user.id, limit, offset],
  );

  // COUNT(*) OVER () is only present on returned rows, so an empty page (no
  // favorites at all, or an offset past the end) needs its own lookup.
  let countRows: Record<string, unknown>[];
  if (favRows.length > 0) {
    countRows = [{ count: favRows[0].total_count }];
  } else {
    const res = await query(
      `SELECT COUNT(*) FROM favorite_listings fl
       JOIN listings_with_details l ON l.id = fl.listing_id AND l.status = 'published'
       WHERE fl.user_id = $1`,
      [user.id],
    );
    countRows = res.rows;
  }

  const orderedIds = favRows.map((f) => Number(f.listing_id));
  const total = Number(countRows[0]?.count ?? 0);

  if (orderedIds.length === 0) {
    return ok([], { pagination: buildPaginationMeta(page, limit, total) });
  }

  // Resolve the favorited listings (published-only).
  const { rows: listingRows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS} FROM listings_with_details
     WHERE id = ANY($1::bigint[]) AND status = 'published'`,
    [orderedIds],
  );
  const rows = listingRows.map(toNumericListingRow);
  const listingIds = rows.map((r) => r.id as number);

  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  if (listingIds.length > 0) {
    const { rows: imageRows } = await query(
      `SELECT id, listing_id, url, alt_text, display_order, is_primary
       FROM listing_images WHERE listing_id = ANY($1::bigint[])
       ORDER BY display_order ASC`,
      [listingIds],
    );
    for (const img of imageRows) {
      const listingId = Number(img.listing_id);
      (imagesByListing[listingId] ??= []).push(
        toListingImage({ ...img, id: Number(img.id) } as never),
      );
    }
  }

  // Preserve the favorite order (the ANY() query returns rows arbitrarily).
  const byId = new Map<number, ListingRowLike>();
  for (const r of rows) {
    if (typeof r.id === "number") byId.set(r.id, r);
  }
  const listings = orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ListingRowLike => r != null)
    .map((r) => toListingCard(r, imagesByListing[r.id as number] ?? []));

  return ok(listings, {
    pagination: buildPaginationMeta(page, limit, total),
  });
});
