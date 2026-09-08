import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  toListingCard,
  toListingImage,
  toReview,
  type ListingImageDTO,
  type ListingRowLike,
  type ReviewRowLike,
} from "@/lib/mobile/mappers";
import { isRestaurantCategory } from "@/lib/utils/category-helpers";
import { getListingCategoryIds } from "@/lib/listings/sync-listing-categories";

export const dynamic = "force-dynamic";

const MAX_GALLERY_IMAGES = 20;
const REVIEW_PREVIEW_LIMIT = 5;

/**
 * `id`/`category_id`/`review_count`/`avg_rating` come back as strings from pg
 * for bigint/numeric columns - a bare `as` cast doesn't convert them, it just
 * asserts the (wrong) type. Mirrors the same helper in listings/route.ts and
 * user/recommendations/route.ts. Missing this here is what caused this
 * listing's `id` to round-trip as a string into POST /reviews' `listing_id`
 * (which expects a number) once the client echoed it back.
 */
function toNumericListingRow<T extends Record<string, unknown>>(
  row: T,
): T & { id: number; category_id: number | null; review_count: number | null; avg_rating: number | null } {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    review_count: row.review_count !== null ? Number(row.review_count) : null,
    avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
  };
}

/** Explicit column list for `listings_with_details` - never use `*`. */
const LISTING_DETAIL_SQL_COLUMNS =
  "id, name, slug, description, address, category_id, category_name, latitude, longitude, avg_rating, review_count, is_featured, status, menu_pdf_url, google_maps_url, place_id, phone_number, email, website";

/**
 * GET /api/mobile/v1/listings/{slug}
 *
 * Aggregated listing detail for the mobile detail screen - mirrors the data the
 * website's server component (`app/listing/[slug]/page.tsx`) assembles, in one
 * round trip. Published-only; reviewer auth UUIDs are never exposed.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);

  const { slug } = await params;
  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  const { rows: listingRows } = await query(
    `SELECT ${LISTING_DETAIL_SQL_COLUMNS} FROM listings_with_details
     WHERE slug = $1 AND status = 'published'`,
    [slug],
  );
  const listingRow = listingRows[0];

  if (!listingRow) {
    throw new MobileApiError("not_found", "Listing not found.", 404);
  }

  const row = toNumericListingRow(
    listingRow as unknown as ListingRowLike & {
      place_id: string | null;
      phone_number: string | null;
      email: string | null;
      website: string | null;
    },
  );
  const listingId = row.id;

  const listingCategoryIds = await getListingCategoryIds(listingId);
  const isRestaurant = await isRestaurantCategory(
    listingCategoryIds.length > 0 ? listingCategoryIds : [row.category_id],
  );

  const [
    imagesRes,
    menuSectionsRes,
    dealsRes,
    hoursRes,
    branchesRes,
    reviewsRes,
    reviewsCountRes,
    favRes,
  ] = await Promise.all([
    query(
      `SELECT id, listing_id, url, alt_text, display_order, is_primary
       FROM listing_images WHERE listing_id = $1
       ORDER BY display_order ASC LIMIT 50`,
      [listingId],
    ),
    isRestaurant
      ? query(
          `SELECT id, name, description, display_order FROM menu_sections
           WHERE listing_id = $1 ORDER BY display_order ASC LIMIT 50`,
          [listingId],
        )
      : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    query(
      `SELECT d.id, d.title, d.description, d.discount_value, d.deal_type, d.end_date,
              d.bank_id, d.valid_card_variants,
              b.name AS bank_name, b.logo_url AS bank_logo_url
       FROM deals d
       LEFT JOIN banks b ON b.id = d.bank_id
       WHERE d.listing_id = $1 AND d.is_active = true
         AND (d.end_date IS NULL OR d.end_date >= NOW())
       ORDER BY d.created_at DESC LIMIT 50`,
      [listingId],
    ),
    query(
      `SELECT id, day_of_week, open_time, close_time, is_closed, branch_id
       FROM opening_hours WHERE listing_id = $1
       ORDER BY day_of_week ASC LIMIT 100`,
      [listingId],
    ),
    query(
      `SELECT id, name, address, city, latitude, longitude, is_primary, phone_number
       FROM listing_branches WHERE listing_id = $1
       ORDER BY is_primary DESC, created_at ASC LIMIT 50`,
      [listingId],
    ),
    query(
      `SELECT r.id, r.listing_id, r.branch_id, r.user_id, r.rating, r.comment,
              r.status, r.helpful_count, r.created_at, r.updated_at,
              p.username, p.avatar_url
       FROM reviews r
       LEFT JOIN profiles p ON p.id = r.user_id
       WHERE r.listing_id = $1 AND r.status = 'approved'
       ORDER BY r.created_at DESC LIMIT $2`,
      [listingId, REVIEW_PREVIEW_LIMIT],
    ),
    query(
      `SELECT COUNT(*) FROM reviews WHERE listing_id = $1 AND status = 'approved'`,
      [listingId],
    ),
    currentUserId
      ? query(
          `SELECT listing_id FROM favorite_listings WHERE user_id = $1 AND listing_id = $2`,
          [currentUserId, listingId],
        )
      : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
  ]);

  let menuItemsBySection: Record<
    number,
    Array<{
      id: number;
      name: string;
      description: string | null;
      price: number;
      display_order: number | null;
      image_url: string | null;
      is_available: boolean;
    }>
  > = {};
  if (isRestaurant && menuSectionsRes.rows.length > 0) {
    const sectionIds = menuSectionsRes.rows.map((s) => s.id as number);
    const { rows: itemRows } = await query(
      `SELECT id, section_id, name, description, price, display_order, image_url, is_available
       FROM menu_items WHERE section_id = ANY($1::int[])
       ORDER BY display_order ASC`,
      [sectionIds],
    );
    menuItemsBySection = {};
    for (const item of itemRows) {
      (menuItemsBySection[item.section_id as number] ??= []).push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        display_order: item.display_order,
        image_url: item.image_url,
        is_available: item.is_available,
      });
    }
  }

  // Favorited flag (only when authenticated).
  const favorited = favRes.rows.length > 0;

  const allImages = imagesRes.rows as Array<{
    id: number;
    url: string;
    alt_text: string | null;
    display_order: number | null;
    is_primary: boolean | null;
  }>;

  const gallery: ListingImageDTO[] = allImages
    .filter((img) => !img.url.includes("/menu/"))
    .slice(0, MAX_GALLERY_IMAGES)
    .map(toListingImage);

  const menuImages = allImages
    .filter((img) => img.url.includes("/menu/"))
    .map((img, index) => ({
      id: img.id,
      url: img.url,
      alt_text: img.alt_text ?? "Menu image",
      display_order: index,
    }));

  const menu = menuSectionsRes.rows.map((section) => ({
    id: section.id as number,
    name: section.name as string,
    description: section.description as string | null,
    display_order: section.display_order as number | null,
    items: [...(menuItemsBySection[section.id as number] ?? [])].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    ),
  }));

  const dealsRows = dealsRes.rows as Array<{
    id: number | string;
    title: string;
    description: string | null;
    discount_value: string | null;
    deal_type: string;
    end_date: Date | string | null;
    bank_id: number | string | null;
    valid_card_variants: number[] | null;
    bank_name: string | null;
    bank_logo_url: string | null;
  }>;

  const deals = dealsRows.map((deal) => ({
    id: Number(deal.id),
    title: deal.title,
    description: deal.description,
    discount_value: deal.discount_value,
    deal_type: deal.deal_type,
    end_date:
      deal.end_date instanceof Date
        ? deal.end_date.toISOString()
        : deal.end_date,
    bank_id: deal.bank_id != null ? Number(deal.bank_id) : null,
    valid_card_variants: Array.isArray(deal.valid_card_variants)
      ? deal.valid_card_variants.map(Number).filter((n) => Number.isFinite(n))
      : [],
    bank: deal.bank_name
      ? { name: deal.bank_name, logo_url: deal.bank_logo_url }
      : null,
  }));

  const openingHours = (
    hoursRes.rows as Array<{
      id: number;
      day_of_week: number;
      open_time: string | null;
      close_time: string | null;
      is_closed: boolean | null;
      branch_id: number | null;
    }>
  ).map((h) => ({
    id: h.id,
    day_of_week: h.day_of_week,
    // Postgres `time` serializes as HH:MM:SS; the contract surfaces HH:mm.
    open_time: h.open_time ? h.open_time.slice(0, 5) : null,
    close_time: h.close_time ? h.close_time.slice(0, 5) : null,
    is_closed: h.is_closed,
    branch_id: h.branch_id,
  }));

  // `as` alone was a type-only assertion with no runtime conversion - id is
  // bigint, so node-postgres actually returns it as a string, silently
  // breaking any client that JSON-serializes it back as a `branch_id`
  // (e.g. POST /reviews' zod schema expects a number). lat/lng are numeric
  // for the same reason.
  const branches = (
    branchesRes.rows as Array<{
      id: number | string;
      name: string;
      address: string;
      city: string;
      latitude: number | string | null;
      longitude: number | string | null;
      is_primary: boolean | null;
      phone_number: string | null;
    }>
  ).map((b) => ({
    id: Number(b.id),
    name: b.name,
    address: b.address,
    city: b.city,
    latitude: b.latitude !== null ? Number(b.latitude) : null,
    longitude: b.longitude !== null ? Number(b.longitude) : null,
    is_primary: b.is_primary,
    phone_number: b.phone_number,
  }));

  const reviewsPreview = (reviewsRes.rows as Array<Record<string, unknown>>).map(
    (r) => {
      const reviewRow: ReviewRowLike = {
        // id/listing_id/branch_id are bigint - Number() them same as
        // `branches` above, not just cast, or they come back as strings.
        id: Number(r.id),
        listing_id: Number(r.listing_id),
        branch_id: Number(r.branch_id),
        user_id: r.user_id as string,
        rating: Number(r.rating),
        comment: r.comment as string | null,
        status: r.status as string,
        helpful_count: r.helpful_count !== null ? Number(r.helpful_count) : null,
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : (r.created_at as string),
        updated_at:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : (r.updated_at as string | null),
        profiles: {
          username: r.username as string | null,
          avatar_url: r.avatar_url as string | null,
        },
      };
      return toReview(reviewRow, currentUserId);
    },
  );

  const reviewsTotal = parseInt(reviewsCountRes.rows[0]?.count ?? "0", 10);

  const listing = {
    ...toListingCard(row, gallery),
    place_id: row.place_id,
    phone_number: row.phone_number,
    email: row.email,
    website: row.website,
    is_restaurant: isRestaurant,
    favorited,
  };

  return ok({
    listing,
    menu_images: menuImages,
    menu,
    deals,
    opening_hours: openingHours,
    branches,
    reviews_preview: reviewsPreview,
    reviews_total: reviewsTotal,
    flags: {
      hasMenu: isRestaurant && menu.length > 0,
      hasDeals: deals.length > 0,
      hasOpeningHours: openingHours.length > 0,
      hasReviews: reviewsTotal > 0,
      hasMenuImages: menuImages.length > 0,
    },
  });
});
