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
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";
import { fetchPriceRangeByEventId, type EventPriceRange } from "@/lib/mobile/event-pricing";

export const dynamic = "force-dynamic";

// Lean direct-table joins on `events e` instead of double-joining `events_with_details` + `events e`.
const EVENT_CARD_SQL_COLUMNS =
  "e.id AS event_id, e.name AS event_name, e.slug AS event_slug, e.description AS event_description, e.status AS event_status, " +
  "to_json(e.start_time) #>> '{}' AS start_time, " +
  "to_json(e.end_time) #>> '{}' AS end_time, " +
  "e.is_featured, p.full_name AS organizer_name, p.avatar_url AS organizer_avatar, " +
  "e.location_name, e.address, " +
  "e.latitude, e.longitude, " +
  "e.category_id, c.name AS category_name, c.slug AS category_slug, c.icon_name AS category_icon_name, " +
  "e.venue_id, v.name AS venue_name, v.rating AS venue_rating";

/** Direct joins for maximum index utilization and zero redundant scans. */
const EVENTS_FROM_SQL =
  "events e " +
  "LEFT JOIN profiles p ON p.id = e.organizer_id " +
  "LEFT JOIN categories c ON c.id = e.category_id " +
  "LEFT JOIN venues v ON v.id = e.venue_id";

/** Kilometres, when `?lat`/`?lng` are given without an explicit `?radiusKm`. */
const DEFAULT_NEARBY_RADIUS_KM = 15;

const eventsRouteCache = new Map<string, { data: unknown; expiresAt: number }>();
const EVENTS_CACHE_TTL_MS = 20_000;

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

  // Check in-memory cache for common default feed requests
  const isDefaultQuery =
    !search && !location && !date && !priceMin && !priceMax && !freeOnly && !nearby;
  const cacheKey = isDefaultQuery
    ? `events:${featured}:${categoryId ?? "all"}:${limit}:${offset}`
    : null;

  if (cacheKey) {
    const cached = eventsRouteCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return ok(
        (cached.data as { events: unknown }).events,
        { pagination: (cached.data as { pagination: unknown }).pagination },
        {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
            "X-Cache": "HIT",
          },
        },
      );
    }
  }

  const whereClauses: string[] = [
    "e.status = 'published'",
    "e.end_time >= NOW()",
  ];
  const params: unknown[] = [];

  if (featured) {
    whereClauses.push("e.is_featured = true");
  }

  if (categoryId != null) {
    params.push(categoryId);
    whereClauses.push(`e.category_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`e.name ILIKE $${params.length}`);
  }

  if (location) {
    params.push(`%${location}%`);
    const i = params.length;
    whereClauses.push(
      `(e.address ILIKE $${i} OR e.location_name ILIKE $${i})`,
    );
  }

  const MIN_PRICE_SUBQUERY =
    "(SELECT MIN(price) FROM ticket_types tt WHERE tt.event_id = e.id)";
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
    const haversineExpr =
      `(6371 * acos(least(1, greatest(-1, ` +
      `cos(radians($${latIdx})) * cos(radians(e.latitude)) * cos(radians(e.longitude) - radians($${lngIdx})) + ` +
      `sin(radians($${latIdx})) * sin(radians(e.latitude))` +
      `))))`;
    distanceSelectSql = `${haversineExpr} AS distance_km`;
    whereClauses.push(
      `e.latitude IS NOT NULL AND e.longitude IS NOT NULL AND ${haversineExpr} <= ${radiusKm}`,
    );
  }

  if (date) {
    const filterDate = new Date(`${date}T00:00:00+05:00`);
    if (!Number.isNaN(filterDate.getTime())) {
      const nextDay = new Date(filterDate.getTime() + 24 * 60 * 60 * 1000);
      params.push(filterDate.toISOString());
      const startIdx = params.length;
      params.push(nextDay.toISOString());
      const endIdx = params.length;
      whereClauses.push(
        `e.start_time >= $${startIdx} AND e.start_time < $${endIdx}`,
      );
    }
  }

  const orderBy = nearby
    ? "distance_km ASC, e.id ASC"
    : featured
      ? "e.featured_rank DESC NULLS LAST, e.start_time ASC, e.id ASC"
      : "e.start_time ASC, e.id ASC";

  const whereSql = whereClauses.join(" AND ");

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const countParams = params.slice(0, params.length - 2);

  let rows: Record<string, unknown>[];
  let count: number;
  try {
    const rowsRes = await query(
      `SELECT ${EVENT_CARD_SQL_COLUMNS}, ${distanceSelectSql}, COUNT(*) OVER() AS total_count
       FROM ${EVENTS_FROM_SQL}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    rows = rowsRes.rows;
    if (rows.length > 0) {
      count = Number(rows[0].total_count ?? 0);
    } else if (offset === 0) {
      count = 0;
    } else {
      const countRes = await query(
        `SELECT COUNT(*) AS count FROM events e WHERE ${whereSql}`,
        countParams,
      );
      count = Number(countRes.rows[0]?.count ?? 0);
    }
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
  let priceRangeByEvent = new Map<number, EventPriceRange>();
  try {
    if (eventIds.length > 0) {
      const [attendeesResult, imagesByEvent, pricesByEvent] = await Promise.all([
        getAttendeesPreviewByEvent(eventIds),
        fetchPrimaryImagesByEventId(eventIds),
        fetchPriceRangeByEventId(eventIds),
      ]);
      attendeesPreviewByEvent = attendeesResult;
      primaryImageByEvent = imagesByEvent;
      priceRangeByEvent = pricesByEvent;
    }
  } catch (error) {
    console.error(
      "[mobile-api] attendees preview / image / price query failed:",
      error,
    );
  }

  const events = eventCardRows.map((row) =>
    toEventCard(
      row,
      row.event_id != null ? attendeesPreviewByEvent.get(row.event_id) : undefined,
      row.event_id != null ? (primaryImageByEvent.get(row.event_id) ?? null) : null,
      row.event_id != null
        ? (priceRangeByEvent.get(row.event_id) ?? { from: null, to: null })
        : { from: null, to: null },
    ),
  );

  const pagination = buildPaginationMeta(page, limit, count);

  if (cacheKey) {
    eventsRouteCache.set(cacheKey, {
      data: { events, pagination },
      expiresAt: Date.now() + EVENTS_CACHE_TTL_MS,
    });
  }

  return ok(
    events,
    { pagination },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
});
