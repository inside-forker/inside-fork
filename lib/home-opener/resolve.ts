import { query } from "@/lib/db";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";
import {
  EVENT_CARD_COLUMNS,
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
import {
  HOME_OPENER_CONFIG_KEY,
  HOME_OPENER_MAX_SLIDES,
  EMPTY_HOME_OPENER_CONFIG,
  parseHomeOpenerConfig,
  type HomeOpenerConfig,
  type HomeOpenerSlideRef,
} from "@/lib/home-opener/types";

export type HomeOpenerResolvedSlide =
  | { kind: "event"; event: EventCardDTO }
  | { kind: "listing"; listing: ListingCardDTO };

export type HomeOpenerPreview = {
  kind: "event" | "listing";
  id: number;
  title: string;
  image_url: string | null;
  subtitle: string | null;
  status: string | null;
  valid: boolean;
  warning: string | null;
};

async function loadConfigFromDb(): Promise<HomeOpenerConfig> {
  try {
    const { rows } = await query(
      `SELECT config_value FROM system_config WHERE config_key = $1 LIMIT 1`,
      [HOME_OPENER_CONFIG_KEY],
    );
    if (rows.length === 0) return { ...EMPTY_HOME_OPENER_CONFIG };
    return parseHomeOpenerConfig(rows[0].config_value);
  } catch (error) {
    console.error("[home-opener] failed to load config:", error);
    return { ...EMPTY_HOME_OPENER_CONFIG };
  }
}

function toEventCardRowFromDb(row: Record<string, unknown>): EventCardRow {
  return {
    event_id: row.event_id != null ? Number(row.event_id) : null,
    event_name: (row.event_name as string | null) ?? null,
    event_slug: (row.event_slug as string | null) ?? null,
    event_description: (row.event_description as string | null) ?? null,
    event_status: (row.event_status as EventCardRow["event_status"]) ?? null,
    start_time: row.start_time != null ? String(row.start_time) : null,
    end_time: row.end_time != null ? String(row.end_time) : null,
    is_featured: row.is_featured != null ? Boolean(row.is_featured) : null,
    organizer_name: (row.organizer_name as string | null) ?? null,
    organizer_avatar: (row.organizer_avatar as string | null) ?? null,
    location_name: (row.location_name as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    category_id: row.category_id != null ? Number(row.category_id) : null,
  };
}

async function loadListingImages(
  listingIds: number[],
): Promise<Record<number, ListingImageDTO[]>> {
  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  if (listingIds.length === 0) return imagesByListing;

  const { rows: images } = await query(
    `SELECT id, listing_id, url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = ANY($1)
     ORDER BY is_primary DESC NULLS LAST, display_order ASC NULLS LAST, id ASC`,
    [listingIds],
  );
  for (const img of images) {
    const listingId = Number(img.listing_id);
    (imagesByListing[listingId] ??= []).push(
      toListingImage({
        id: Number(img.id),
        url: String(img.url),
        alt_text: (img.alt_text as string | null) ?? null,
        display_order: img.display_order != null ? Number(img.display_order) : null,
        is_primary: img.is_primary != null ? Boolean(img.is_primary) : null,
      }),
    );
  }
  return imagesByListing;
}

async function fetchEventById(id: number): Promise<EventCardDTO | null> {
  const { rows } = await query(
    `SELECT ${EVENT_CARD_COLUMNS}
     FROM events_with_details
     WHERE event_id = $1
     LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return null;
  const cardRow = toEventCardRowFromDb(rows[0]);
  const images = await fetchPrimaryImagesByEventId([id]);
  return toEventCard(cardRow, undefined, images.get(id) ?? null);
}

async function fetchListingById(id: number): Promise<ListingCardDTO | null> {
  const { rows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS}
     FROM listings_with_details
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return null;
  const imagesByListing = await loadListingImages([id]);
  return toListingCard(toNumericListingRow(rows[0]), imagesByListing[id] ?? []);
}

function eventIsLive(event: EventCardDTO): boolean {
  if (event.event_status !== "published") return false;
  if (!event.end_time) return true;
  return new Date(event.end_time).getTime() >= Date.now();
}

function listingIsLive(listing: ListingCardDTO): boolean {
  return listing.status === "published";
}

/** Resolve curated refs into preview rows for the admin UI (keeps invalid picks visible). */
export async function previewHomeOpenerSlides(
  refs: HomeOpenerSlideRef[],
): Promise<HomeOpenerPreview[]> {
  const previews: HomeOpenerPreview[] = [];

  for (const ref of refs) {
    if (ref.kind === "event") {
      const event = await fetchEventById(ref.id);
      if (!event) {
        previews.push({
          kind: "event",
          id: ref.id,
          title: `Event #${ref.id}`,
          image_url: null,
          subtitle: null,
          status: null,
          valid: false,
          warning: "Event not found",
        });
        continue;
      }
      const live = eventIsLive(event);
      previews.push({
        kind: "event",
        id: ref.id,
        title: event.event_name ?? `Event #${ref.id}`,
        image_url: event.image_url ?? null,
        subtitle: event.start_time
          ? new Date(event.start_time).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        status: event.event_status,
        valid: live,
        warning: live
          ? null
          : event.event_status !== "published"
            ? `Status: ${event.event_status ?? "unknown"}`
            : "Event has ended",
      });
    } else {
      const listing = await fetchListingById(ref.id);
      if (!listing) {
        previews.push({
          kind: "listing",
          id: ref.id,
          title: `Listing #${ref.id}`,
          image_url: null,
          subtitle: null,
          status: null,
          valid: false,
          warning: "Listing not found",
        });
        continue;
      }
      const live = listingIsLive(listing);
      previews.push({
        kind: "listing",
        id: ref.id,
        title: listing.name ?? `Listing #${ref.id}`,
        image_url: listing.images[0]?.url ?? null,
        subtitle: listing.category_name,
        status: listing.status,
        valid: live,
        warning: live ? null : `Status: ${listing.status ?? "unknown"}`,
      });
    }
  }

  return previews;
}

async function fetchFeaturedEvent(): Promise<EventCardDTO | null> {
  const { rows } = await query(
    `SELECT ${EVENT_CARD_COLUMNS}
     FROM events_with_details
     WHERE event_status = 'published'
       AND end_time >= NOW()
       AND is_featured = true
     ORDER BY featured_rank DESC NULLS LAST, start_time ASC, event_id ASC
     LIMIT 1`,
  );
  if (rows.length === 0) return null;
  const id = Number(rows[0].event_id);
  const images = await fetchPrimaryImagesByEventId([id]);
  return toEventCard(toEventCardRowFromDb(rows[0]), undefined, images.get(id) ?? null);
}

async function fetchTrendingListings(
  limit: number,
  excludeIds: Set<number>,
): Promise<ListingCardDTO[]> {
  if (limit <= 0) return [];

  // Prefer featured + high-rated published listings (same spirit as HomeOpener's
  // client sort of trending). Keep the query simple so this resolver stays
  // independent of the heavier weekly-engagement trending CTE.
  const { rows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS}
     FROM listings_with_details
     WHERE status = 'published'
     ORDER BY is_featured DESC NULLS LAST,
              avg_rating DESC NULLS LAST,
              review_count DESC NULLS LAST,
              id ASC
     LIMIT $1`,
    [Math.max(limit + excludeIds.size, limit) + 8],
  );

  const candidates = rows
    .map((r) => toNumericListingRow(r))
    .filter((r) => r.id != null && !excludeIds.has(Number(r.id)))
    .slice(0, limit);

  const ids = candidates.map((c) => Number(c.id));
  const imagesByListing = await loadListingImages(ids);
  return candidates.map((row) =>
    toListingCard(row, imagesByListing[Number(row.id)] ?? []),
  );
}

async function resolveAutoSlides(
  maxSlides: number,
  excludeListingIds: Set<number>,
  excludeEventIds: Set<number>,
): Promise<HomeOpenerResolvedSlide[]> {
  const slides: HomeOpenerResolvedSlide[] = [];

  if (slides.length < maxSlides && excludeEventIds.size === 0) {
    const featured = await fetchFeaturedEvent();
    if (featured?.event_id != null && !excludeEventIds.has(featured.event_id)) {
      slides.push({ kind: "event", event: featured });
      excludeEventIds.add(featured.event_id);
    }
  }

  const remaining = maxSlides - slides.length;
  if (remaining > 0) {
    const listings = await fetchTrendingListings(remaining, excludeListingIds);
    for (const listing of listings) {
      slides.push({ kind: "listing", listing });
      if (listing.id != null) excludeListingIds.add(listing.id);
    }
  }

  return slides;
}

/**
 * Resolve the Home opener for mobile: curated picks first (skipping dead
 * refs), then optionally fill with the auto algorithm up to MAX_SLIDES.
 * Empty curated + auto = empty array (client can hide the block).
 */
export async function resolveHomeOpenerSlides(): Promise<{
  source: "curated" | "auto" | "mixed";
  slides: HomeOpenerResolvedSlide[];
  config: HomeOpenerConfig;
}> {
  const config = await loadConfigFromDb();
  const curated: HomeOpenerResolvedSlide[] = [];
  const usedListings = new Set<number>();
  const usedEvents = new Set<number>();

  for (const ref of config.slides) {
    if (curated.length >= HOME_OPENER_MAX_SLIDES) break;
    if (ref.kind === "event") {
      const event = await fetchEventById(ref.id);
      if (!event || !eventIsLive(event) || event.event_id == null) continue;
      if (usedEvents.has(event.event_id)) continue;
      curated.push({ kind: "event", event });
      usedEvents.add(event.event_id);
    } else {
      const listing = await fetchListingById(ref.id);
      if (!listing || !listingIsLive(listing) || listing.id == null) continue;
      if (usedListings.has(listing.id)) continue;
      curated.push({ kind: "listing", listing });
      usedListings.add(listing.id);
    }
  }

  if (curated.length === 0) {
    const auto = await resolveAutoSlides(
      HOME_OPENER_MAX_SLIDES,
      usedListings,
      usedEvents,
    );
    return { source: "auto", slides: auto, config };
  }

  if (!config.fill_remaining || curated.length >= HOME_OPENER_MAX_SLIDES) {
    return { source: "curated", slides: curated, config };
  }

  const fill = await resolveAutoSlides(
    HOME_OPENER_MAX_SLIDES - curated.length,
    usedListings,
    usedEvents,
  );
  // Auto fill is listings-oriented; skip duplicate events already curated.
  const filled = fill.filter((s) => {
    if (s.kind === "event") {
      return s.event.event_id == null || !usedEvents.has(s.event.event_id);
    }
    return s.listing.id == null || !usedListings.has(s.listing.id);
  });

  return {
    source: filled.length > 0 ? "mixed" : "curated",
    slides: [...curated, ...filled].slice(0, HOME_OPENER_MAX_SLIDES),
    config,
  };
}

export async function getHomeOpenerConfig(): Promise<HomeOpenerConfig> {
  return loadConfigFromDb();
}

export async function saveHomeOpenerConfig(
  config: HomeOpenerConfig,
  updatedBy: string,
): Promise<HomeOpenerConfig> {
  const cleaned = parseHomeOpenerConfig(config);
  const serialized = JSON.stringify(cleaned);

  await query(
    `INSERT INTO public.system_config (config_key, config_value, config_type, description, is_public, updated_by)
     VALUES ($1, $2::jsonb, 'setting', $3, false, $4)
     ON CONFLICT (config_key)
     DO UPDATE SET
       config_value = EXCLUDED.config_value,
       config_type = EXCLUDED.config_type,
       description = EXCLUDED.description,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      HOME_OPENER_CONFIG_KEY,
      serialized,
      "Ordered slides for the mobile Home hero (event/listing refs, max 4).",
      updatedBy,
    ],
  );

  return cleaned;
}
