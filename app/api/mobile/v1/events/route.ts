import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { toEventCard, type EventCardRow } from "@/lib/mobile/mappers";
import { getAttendeesPreviewByEvent } from "@/lib/mobile/attendees";

export const dynamic = "force-dynamic";

const EVENT_CARD_SQL_COLUMNS =
  "events_with_details.event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_name, organizer_avatar, location_name, address, latitude, longitude, " +
  "events_with_details.category_id, c.name AS category_name, c.slug AS category_slug, c.icon_name AS category_icon_name, " +
  "mp.min_price, e.venue_id, v.name AS venue_name, v.rating AS venue_rating";

/** Joined so the row select can surface category display fields, the
 * cheapest ticket price, and the linked venue's display fields. Price
 * *filtering* (below) deliberately uses a standalone correlated subquery
 * instead of referencing `mp.min_price`, so the same WHERE clause also works
 * unmodified against the count query, which selects from `events_with_details`
 * alone without this join. `venue_id` isn't on the (untracked) view, so it's
 * reached by joining back to `events` by id rather than editing the view. */
const EVENTS_FROM_SQL =
  "events_with_details " +
  "LEFT JOIN categories c ON c.id = events_with_details.category_id " +
  "LEFT JOIN LATERAL (" +
  "SELECT MIN(price) AS min_price FROM ticket_types tt WHERE tt.event_id = events_with_details.event_id" +
  ") mp ON true " +
  "LEFT JOIN events e ON e.id = events_with_details.event_id " +
  "LEFT JOIN venues v ON v.id = e.venue_id";

/** Kilometres, when `?lat`/`?lng` are given without an explicit `?radiusKm`. */
const DEFAULT_NEARBY_RADIUS_KM = 15;

function toEventCardRow(row: Record<string, unknown>): EventCardRow {
  return {
    ...row,
    event_id: Number(row.event_id),
    // category_id is `bigint` - pg returns it as a string, not a number.
    category_id: row.category_id != null ? Number(row.category_id) : null,
    // min_price is `numeric` (aggregated from ticket_types.price) - pg
    // returns it as a string, not a number, same as category_id above.
    min_price: row.min_price != null ? Number(row.min_price) : null,
    // venue_id is `bigint`, venue_rating is `numeric(2,1)` - both come back
    // as strings from pg, same reasoning as category_id/min_price above.
    venue_id: row.venue_id != null ? Number(row.venue_id) : null,
    venue_rating: row.venue_rating != null ? Number(row.venue_rating) : null,
  } as unknown as EventCardRow;
}

/**
 * GET /api/mobile/v1/events
 *
 * Public, paginated list of upcoming/ongoing published events (those whose
 * `end_time >= now`), ordered by `start_time` (featured first when `?featured`).
 * Mirrors the website's `app/api/events` handler, normalized into the mobile
 * envelope. Published-only - `event_status` is enforced here.
 *
 * `?category=<id>` filters on `events.category_id`. Category display fields
 * (`category_name`/`category_slug`/`category_icon_name`) are always joined in
 * regardless of whether this filter is used, for the home screen's chips/grid.
 * `min_price` (cheapest ticket type) is always included for display.
 *
 * `?priceMin=`/`?priceMax=` filter on `min_price`; `?freeOnly=true` is
 * shorthand for `min_price = 0` (and overrides priceMin/priceMax if both are
 * given). Events with no ticket types match none of these.
 *
 * `?lat=`/`?lng=` (with optional `?radiusKm=`, default 15) filter to events
 * within that radius and switch the sort to nearest-first; events with no
 * coordinates never match. `distance_km` is included on every row (null
 * unless this filter is active).
 *
 * `venue_id`/`venue_name`/`venue_rating` are included when the event has a
 * linked venue (events.venue_id), for the card to link through to it.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 12,
    maxLimit: 100,
  });

  const rawSearch = searchParams.get("search");
  const search =
    rawSearch && rawSearch.trim() ? sanitizeSearchTerm(rawSearch) : "";
  const rawLocation = searchParams.get("location");
  const location =
    rawLocation && rawLocation.trim() ? sanitizeSearchTerm(rawLocation) : "";
  const date = searchParams.get("date");
  const featured = searchParams.get("featured") === "true";
  const rawCategory = searchParams.get("category");
  const categoryId =
    rawCategory && /^\d+$/.test(rawCategory) ? Number(rawCategory) : null;

  const parseFiniteNumber = (raw: string | null): number | null => {
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const priceMin = parseFiniteNumber(searchParams.get("priceMin"));
  const priceMax = parseFiniteNumber(searchParams.get("priceMax"));
  const freeOnly = searchParams.get("freeOnly") === "true";
  const lat = parseFiniteNumber(searchParams.get("lat"));
  const lng = parseFiniteNumber(searchParams.get("lng"));
  const radiusKm = parseFiniteNumber(searchParams.get("radiusKm")) ?? DEFAULT_NEARBY_RADIUS_KM;
  const nearby = lat != null && lng != null;

  const whereClauses: string[] = [
    "event_status = 'published'",
    "end_time >= NOW()",
  ];
  const params: unknown[] = [];

  if (featured) {
    whereClauses.push("is_featured = true");
  }

  if (categoryId != null) {
    params.push(categoryId);
    whereClauses.push(`category_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`event_name ILIKE $${params.length}`);
  }

  if (location) {
    params.push(`%${location}%`);
    const i = params.length;
    whereClauses.push(
      `(address ILIKE $${i} OR location_name ILIKE $${i})`,
    );
  }

  // A standalone correlated subquery (not the `mp` join used for display)
  // so this clause is identical whether it runs against the row query or the
  // join-free count query. Events with no ticket types never match - there's
  // nothing truthful to say about "is it free" or "is it in this price range"
  // for an event that has no priced tickets yet.
  const MIN_PRICE_SUBQUERY =
    "(SELECT MIN(price) FROM ticket_types tt WHERE tt.event_id = events_with_details.event_id)";
  if (freeOnly) {
    whereClauses.push(`${MIN_PRICE_SUBQUERY} = 0`);
  } else {
    if (priceMin != null) {
      params.push(priceMin);
      whereClauses.push(`${MIN_PRICE_SUBQUERY} >= $${params.length}`);
    }
    if (priceMax != null) {
      params.push(priceMax);
      whereClauses.push(`${MIN_PRICE_SUBQUERY} <= $${params.length}`);
    }
  }

  let distanceSelectSql = "NULL::double precision AS distance_km";
  if (nearby) {
    params.push(lat);
    const latIdx = params.length;
    params.push(lng);
    const lngIdx = params.length;
    // Great-circle (Haversine) distance in km. `least(1, greatest(-1, ...))`
    // clamps the acos argument against floating-point drift pushing it just
    // outside [-1, 1] for near-antipodal/identical points.
    const haversineExpr =
      `(6371 * acos(least(1, greatest(-1, ` +
      `cos(radians($${latIdx})) * cos(radians(events_with_details.latitude)) * cos(radians(events_with_details.longitude) - radians($${lngIdx})) + ` +
      `sin(radians($${latIdx})) * sin(radians(events_with_details.latitude))` +
      `))))`;
    distanceSelectSql = `${haversineExpr} AS distance_km`;
    whereClauses.push(
      `events_with_details.latitude IS NOT NULL AND events_with_details.longitude IS NOT NULL AND ${haversineExpr} <= ${radiusKm}`,
    );
  }

  if (date) {
    // Day boundaries are Asia/Karachi (UTC+5) per the v1 contract, not UTC -
    // anchor the parsed YYYY-MM-DD to Karachi midnight before forming the range.
    const filterDate = new Date(`${date}T00:00:00+05:00`);
    if (!Number.isNaN(filterDate.getTime())) {
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      params.push(filterDate.toISOString());
      const startIdx = params.length;
      params.push(nextDay.toISOString());
      const endIdx = params.length;
      whereClauses.push(
        `start_time >= $${startIdx} AND start_time < $${endIdx}`,
      );
    }
  }

  const orderBy = nearby
    ? "distance_km ASC, event_id ASC"
    : featured
      ? "featured_rank DESC NULLS LAST, start_time ASC, event_id ASC"
      : "start_time ASC, event_id ASC";

  const whereSql = whereClauses.join(" AND ");

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const countParams = params.slice(0, params.length - 2);

  let rows: Record<string, unknown>[];
  let count: number;
  try {
    // Sequential, NOT Promise.all. The production pool is capped at `max: 1`
    // connection per serverless instance (see lib/db.ts), so these two can
    // never actually overlap - firing them together only makes the second one
    // sit in the pool's queue racing `connectionTimeoutMillis` (10s) while the
    // first holds the sole connection. That queue timeout is what intermittently
    // turned this route into a 500 ("Failed to load events.") while unrelated
    // screens loaded fine. Awaiting in order costs no extra wall-clock time and
    // removes the failure mode entirely.
    const rowsRes = await query(
      `SELECT ${EVENT_CARD_SQL_COLUMNS}, ${distanceSelectSql}
       FROM ${EVENTS_FROM_SQL}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    const countRes = await query(
      `SELECT COUNT(*) AS count FROM events_with_details WHERE ${whereSql}`,
      countParams,
    );
    rows = rowsRes.rows;
    count = Number(countRes.rows[0]?.count ?? 0);
  } catch (error) {
    console.error("[mobile-api] events query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load events.", 500);
  }

  const eventCardRows = rows.map(toEventCardRow);
  const eventIds = eventCardRows.map((r) => r.event_id).filter((id): id is number => id != null);

  let attendeesPreviewByEvent: Awaited<
    ReturnType<typeof getAttendeesPreviewByEvent>
  > = new Map();
  let primaryImageByEvent = new Map<number, string>();
  try {
    // Sequential for the same reason as the count query above - a `max: 1`
    // pool turns concurrent queries into queued ones racing a 10s acquisition
    // timeout. This block already fails soft (the catch below only logs), so a
    // timeout here silently stripped attendee avatars and cover images off
    // every card rather than 500ing - the same root cause showing up as
    // "sometimes the events have images, sometimes they don't".
    const attendeesResult = await getAttendeesPreviewByEvent(eventIds);
    const imagesResult =
      eventIds.length > 0
        ? await query(
            `SELECT DISTINCT ON (event_id) event_id, url
             FROM event_images
             WHERE event_id = ANY($1) AND (is_primary = true OR display_order = 1)
             ORDER BY event_id, is_primary DESC NULLS LAST, display_order ASC`,
            [eventIds],
          )
        : { rows: [] as { event_id: number; url: string }[] };
    attendeesPreviewByEvent = attendeesResult;
    primaryImageByEvent = new Map(
      imagesResult.rows.map((r) => [Number(r.event_id), r.url as string]),
    );
  } catch (error) {
    console.error("[mobile-api] attendees preview / image query failed:", error);
  }

  const events = eventCardRows.map((row) =>
    toEventCard(
      row,
      row.event_id != null ? attendeesPreviewByEvent.get(row.event_id) : undefined,
      row.event_id != null ? (primaryImageByEvent.get(row.event_id) ?? null) : null,
    ),
  );

  return ok(events, {
    pagination: buildPaginationMeta(page, limit, count),
  });
});
