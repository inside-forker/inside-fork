/**
 * Batched Home payload — one round trip for the rails that used to each
 * hit their own endpoint on cold mount (opener, spine, open-now, for-you,
 * this-week / free-cheap events).
 */
import { query } from "@/lib/db";
import { resolveHomeOpenerSlides } from "@/lib/home-opener/resolve";
import {
  EVENT_CARD_SQL_COLUMNS,
  EVENTS_FROM_SQL,
  fetchUpcomingPublishedEvents,
} from "@/lib/events/upcoming-query";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";
import { fetchPriceRangeByEventId } from "@/lib/mobile/event-pricing";
import { getOpenListingIds } from "@/lib/listings/open-status";
import {
  resolveCategoryBySlugWithScope,
  listingCategoriesExistsClause,
} from "@/lib/listings/category-scope";
import {
  LISTING_CARD_COLUMNS,
  toEventCard,
  toListingCard,
  toListingImage,
  toNumericListingRow,
  type EventCardDTO,
  type EventCardRow,
  type ListingCardDTO,
  type ListingImageDTO,
} from "@/lib/mobile/mappers";

const OPEN_NOW_CATEGORY_SLUG = "fast-food-street-food";
const OPEN_NOW_LIMIT = 12;
const SPINE_LIMIT = 6;
const FOR_YOU_LIMIT = 8;
const UPCOMING_EVENTS_LIMIT = 24;

async function loadListingImages(
  listingIds: number[],
): Promise<Record<number, ListingImageDTO[]>> {
  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  if (listingIds.length === 0) return imagesByListing;

  const { rows: images } = await query(
    `SELECT id, listing_id, url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = ANY($1::bigint[])
     ORDER BY listing_id ASC, display_order ASC, id ASC`,
    [listingIds],
  );
  for (const image of images) {
    const listingId = Number(image.listing_id);
    (imagesByListing[listingId] ??= []).push(
      toListingImage({
        id: Number(image.id),
        url: String(image.url),
        alt_text: (image.alt_text as string | null) ?? null,
        display_order:
          image.display_order != null ? Number(image.display_order) : null,
        is_primary:
          image.is_primary != null ? Boolean(image.is_primary) : null,
      }),
    );
  }
  return imagesByListing;
}

async function fetchOpenNowListings(): Promise<ListingCardDTO[]> {
  const openIds = await getOpenListingIds("now");
  if (openIds.length === 0) return [];

  const resolved = await resolveCategoryBySlugWithScope(OPEN_NOW_CATEGORY_SLUG);
  const params: unknown[] = [openIds];
  const where = [`ld.status = 'published'`, `ld.id = ANY($1::bigint[])`];

  if (resolved && resolved.categoryIds.length > 0) {
    params.push(resolved.categoryIds);
    where.push(
      listingCategoriesExistsClause("ld.id", params.length, {
        primaryOnly: false,
      }),
    );
  }

  params.push(OPEN_NOW_LIMIT);
  const { rows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS.split(", ")
      .map((c) => `ld.${c}`)
      .join(", ")}
     FROM listings_with_details ld
     WHERE ${where.join(" AND ")}
     ORDER BY
       (ld.avg_rating IS NOT NULL AND ld.avg_rating > 0) DESC,
       ld.avg_rating DESC NULLS LAST,
       ld.review_count DESC NULLS LAST,
       ld.id ASC
     LIMIT $${params.length}`,
    params,
  );

  const listingIds = rows.map((r) => Number(r.id)).filter(Number.isFinite);
  const imagesByListing = await loadListingImages(listingIds);
  return rows.map((row) =>
    toListingCard(
      toNumericListingRow(row as Record<string, unknown>),
      imagesByListing[Number(row.id)] ?? [],
    ),
  );
}

async function fetchForYouListings(): Promise<ListingCardDTO[]> {
  const { rows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS.split(", ")
      .map((c) => `ld.${c}`)
      .join(", ")}
     FROM listings_with_details ld
     WHERE ld.status = 'published'
     ORDER BY
       (ld.avg_rating IS NOT NULL AND ld.avg_rating >= 3.5) DESC,
       ld.is_featured DESC NULLS LAST,
       ld.avg_rating DESC NULLS LAST,
       ld.review_count DESC NULLS LAST,
       ld.id ASC
     LIMIT $1`,
    [FOR_YOU_LIMIT],
  );
  const listingIds = rows.map((r) => Number(r.id)).filter(Number.isFinite);
  const imagesByListing = await loadListingImages(listingIds);
  return rows.map((row) =>
    toListingCard(
      toNumericListingRow(row as Record<string, unknown>),
      imagesByListing[Number(row.id)] ?? [],
    ),
  );
}

async function enrichEventCards(
  rows: Array<Record<string, unknown>>,
): Promise<EventCardDTO[]> {
  const cardRows: EventCardRow[] = rows.map((row) => ({
    ...row,
    event_id: Number(row.event_id),
    category_id: row.category_id != null ? Number(row.category_id) : null,
    venue_id: row.venue_id != null ? Number(row.venue_id) : null,
    venue_rating: row.venue_rating != null ? Number(row.venue_rating) : null,
  })) as unknown as EventCardRow[];

  const eventIds = cardRows
    .map((r) => r.event_id)
    .filter((id): id is number => id != null);

  const images = await fetchPrimaryImagesByEventId(eventIds);
  const prices = await fetchPriceRangeByEventId(eventIds);

  return cardRows.map((row) =>
    toEventCard(
      row,
      undefined,
      row.event_id != null ? (images.get(row.event_id) ?? null) : null,
      row.event_id != null
        ? (prices.get(row.event_id) ?? { from: null, to: null })
        : { from: null, to: null },
    ),
  );
}

async function fetchSpineEvents(): Promise<EventCardDTO[]> {
  const { rows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS}
     FROM ${EVENTS_FROM_SQL}
     WHERE e.status = 'published'
       AND e.end_time >= now()
       AND e.is_featured IS NOT TRUE
     ORDER BY e.start_time ASC, e.id ASC
     LIMIT $1`,
    [SPINE_LIMIT],
  );
  return enrichEventCards(rows as Record<string, unknown>[]);
}

export type HomeFeedPayload = {
  opener: Awaited<ReturnType<typeof resolveHomeOpenerSlides>>;
  spine: EventCardDTO[];
  openNow: ListingCardDTO[];
  forYou: ListingCardDTO[];
  /** Soonest upcoming events (client filters free/cheap; [0] is this-week). */
  upcomingEvents: EventCardDTO[];
};

/**
 * Sequential on purpose (prod pool max:1). Each step is already batched SQL.
 */
export async function resolveHomeFeed(): Promise<HomeFeedPayload> {
  const opener = await resolveHomeOpenerSlides();
  const spine = await fetchSpineEvents();
  const openNow = await fetchOpenNowListings();
  const forYou = await fetchForYouListings();

  const upcomingRows = await fetchUpcomingPublishedEvents({
    limit: UPCOMING_EVENTS_LIMIT,
  });
  const upcomingEvents = await enrichEventCards(
    upcomingRows.map((row) => ({
      ...row,
      event_id: row.event_id,
      event_name: row.event_name,
      event_slug: row.event_slug,
      event_description: row.event_description,
      event_status: row.event_status,
      start_time: row.start_time,
      end_time: row.end_time,
      is_featured: row.is_featured,
      organizer_name: row.organizer_name,
      organizer_avatar: row.organizer_avatar,
      location_name: row.location_name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      category_id: row.category_id,
    })),
  );

  return { opener, spine, openNow, forYou, upcomingEvents };
}
