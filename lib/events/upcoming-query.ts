/**
 * Shared lean event list SQL — direct `events e` joins instead of the
 * `events_with_details` view (which re-joins profiles and blocks index use).
 *
 * Used by the homepage trending section, discovery intents, and mobile
 * `/events` + `/events/for-you` list routes.
 */
import { query } from "@/lib/db";

/** Lean joins for index-friendly event feeds. */
export const EVENTS_FROM_SQL =
  "events e " +
  "LEFT JOIN profiles p ON p.id = e.organizer_id " +
  "LEFT JOIN categories c ON c.id = e.category_id " +
  "LEFT JOIN venues v ON v.id = e.venue_id";

/**
 * Card columns for mobile event feeds. Aliases match `EventCardRow` /
 * `toEventCard` expectations (`event_id`, `event_name`, …).
 */
export const EVENT_CARD_SQL_COLUMNS =
  "e.id AS event_id, e.name AS event_name, e.slug AS event_slug, e.description AS event_description, e.status AS event_status, " +
  "to_json(e.start_time) #>> '{}' AS start_time, " +
  "to_json(e.end_time) #>> '{}' AS end_time, " +
  "e.is_featured, e.organizer_id, p.full_name AS organizer_name, p.avatar_url AS organizer_avatar, " +
  "e.location_name, e.address, " +
  "e.latitude, e.longitude, " +
  "e.category_id, c.name AS category_name, c.slug AS category_slug, c.icon_name AS category_icon_name, " +
  "e.venue_id, v.name AS venue_name, v.rating AS venue_rating";

export type UpcomingPublishedEventRow = {
  event_id: number;
  event_name: string;
  event_slug: string;
  event_description: string | null;
  start_time: string;
  end_time: string;
  event_status: string;
  organizer_id: string;
  organizer_name: string | null;
  organizer_avatar: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  is_featured: boolean;
  category_id: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toIsoString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function coerceUpcomingRow(
  row: Record<string, unknown>,
): UpcomingPublishedEventRow | null {
  const eventId = toFiniteNumber(row.event_id);
  const startTime = toIsoString(row.start_time);
  const endTime = toIsoString(row.end_time);
  if (
    eventId == null ||
    typeof row.event_name !== "string" ||
    typeof row.event_slug !== "string" ||
    !startTime ||
    !endTime
  ) {
    return null;
  }

  return {
    event_id: eventId,
    event_name: row.event_name,
    event_slug: row.event_slug,
    event_description: (row.event_description as string | null) ?? null,
    start_time: startTime,
    end_time: endTime,
    event_status:
      typeof row.event_status === "string" ? row.event_status : "published",
    organizer_id:
      typeof row.organizer_id === "string" ? row.organizer_id : "",
    organizer_name: (row.organizer_name as string | null) ?? null,
    organizer_avatar: (row.organizer_avatar as string | null) ?? null,
    location_name: (row.location_name as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    latitude: toFiniteNumber(row.latitude),
    longitude: toFiniteNumber(row.longitude),
    is_featured: Boolean(row.is_featured),
    category_id: toFiniteNumber(row.category_id),
  };
}

/**
 * Soonest published events that have not ended yet (includes ongoing).
 */
export async function fetchUpcomingPublishedEvents(options: {
  limit: number;
  featured?: boolean;
}): Promise<UpcomingPublishedEventRow[]> {
  const limit = Math.max(1, Math.min(options.limit, 50));
  const params: unknown[] = [];
  const where = ["e.status = 'published'", "e.end_time >= now()"];

  if (options.featured) {
    where.push("e.is_featured = true");
  }

  params.push(limit);
  const { rows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS}
     FROM ${EVENTS_FROM_SQL}
     WHERE ${where.join(" AND ")}
     ORDER BY e.start_time ASC, e.id ASC
     LIMIT $${params.length}`,
    params,
  );

  return (rows as Record<string, unknown>[])
    .map(coerceUpcomingRow)
    .filter((row): row is UpcomingPublishedEventRow => row !== null);
}

export type PrimaryEventImageRow = {
  id: number;
  event_id: number;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
};

/** One primary (or first-ordered) image per event — slim column list. */
export async function fetchPrimaryEventImagesByEventIds(
  eventIds: number[],
): Promise<Map<number, PrimaryEventImageRow>> {
  const byEvent = new Map<number, PrimaryEventImageRow>();
  if (eventIds.length === 0) return byEvent;

  const { rows } = await query(
    `SELECT id, event_id, url, alt_text, is_primary, display_order
     FROM event_images
     WHERE event_id = ANY($1::bigint[])
       AND (is_primary = true OR display_order = 1)
     ORDER BY display_order ASC, id ASC`,
    [eventIds],
  );

  for (const row of rows as Record<string, unknown>[]) {
    const eventId = toFiniteNumber(row.event_id);
    const id = toFiniteNumber(row.id);
    if (eventId == null || id == null || typeof row.url !== "string") continue;
    if (byEvent.has(eventId)) continue;
    byEvent.set(eventId, {
      id,
      event_id: eventId,
      url: row.url,
      alt_text: (row.alt_text as string | null) ?? null,
      is_primary: Boolean(row.is_primary),
      display_order: toFiniteNumber(row.display_order) ?? 1,
    });
  }

  return byEvent;
}
