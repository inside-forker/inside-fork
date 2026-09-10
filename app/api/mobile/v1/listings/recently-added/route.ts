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

type RecentlyAddedRow = Record<string, unknown> & {
  id: number | string;
  added_at: string | null;
};

/**
 * GET /api/mobile/v1/listings/recently-added
 *
 * Public, paginated feed for the home screen's "Recently added" section.
 * Only published listings are eligible. "Added" is the immutable
 * `listings.created_at` timestamp (rather than `updated_at`), so routine edits
 * do not make an older listing appear new. Results are newest first, with the
 * listing id as a deterministic tie-breaker.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  try {
    const [{ rows: countRows }, { rows }] = await Promise.all([
      query(
        `SELECT COUNT(*)::integer AS total
         FROM listings
         WHERE status = 'published'`,
      ),
      query(
        `SELECT ${LISTING_CARD_COLUMNS}, created_at AS added_at
         FROM listings_with_details
         WHERE status = 'published'
         ORDER BY created_at DESC NULLS LAST, id DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);

    const listingRows = rows as RecentlyAddedRow[];
    const listingIds = listingRows
      .map((row) => Number(row.id))
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
          toListingImage({
            ...image,
            id: Number(image.id),
          }),
        );
      }
    }

    const listings = listingRows.map((row) => ({
      ...toListingCard(
        toNumericListingRow(row),
        imagesByListing[Number(row.id)] ?? [],
      ),
      added_at: row.added_at,
    }));

    return ok(
      listings,
      {
        pagination: buildPaginationMeta(
          page,
          limit,
          Number(countRows[0]?.total ?? 0),
        ),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error(
      "[mobile-api] recently added listings query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load recently added listings.",
      500,
    );
  }
});
