import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";
import { MobileApiError } from "@/lib/mobile/errors";
import { toEventCard, type EventCardRow } from "@/lib/mobile/mappers";
import { getAttendeesPreviewByEvent } from "@/lib/mobile/attendees";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";
import { fetchPriceRangeByEventId, type EventPriceRange } from "@/lib/mobile/event-pricing";
import { getEventCategoryAffinity } from "@/lib/recommendations/affinity";
import { getTimeIntentBoostsByCategoryId } from "@/lib/recommendations/time-intent";
import { scoreEventCandidates, type ScoredEventCandidate } from "@/lib/recommendations/event-scoring";

export const dynamic = "force-dynamic";

// Same Karachi bounding box the listings recommendations route uses.
const LAT_BOUNDS = { min: 24.7, max: 25.0 };
const LNG_BOUNDS = { min: 66.9, max: 67.4 };

/** How many soonest upcoming events to pull before scoring - small inventory,
 * this only ever needs to feed a top handful, not a full paginated list. */
const CANDIDATE_POOL_SIZE = 30;

const EVENT_CARD_SQL_COLUMNS =
  "events_with_details.event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(events_with_details.start_time) #>> '{}' AS start_time, " +
  "to_json(events_with_details.end_time) #>> '{}' AS end_time, " +
  "events_with_details.is_featured, organizer_name, organizer_avatar, " +
  "events_with_details.location_name, events_with_details.address, " +
  "events_with_details.latitude, events_with_details.longitude, " +
  "events_with_details.category_id, c.name AS category_name";

const EVENTS_FROM_SQL =
  "events_with_details LEFT JOIN categories c ON c.id = events_with_details.category_id";

type ForYouEventRow = Record<string, unknown> & {
  event_id: number | string;
  category_id: number | string | null;
  category_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

/** `EventCardRow.event_id` is typed `number | null` (Supabase-generated,
 * nullable view column), but every row here always has one - `toEventCardRow`
 * always produces a real number, this alias just lets that flow through the
 * type system without repeating `row.event_id != null` inline everywhere, the
 * way the generic events list route does. */
type ScorableEventRow = EventCardRow & { event_id: number };

function toEventCardRow(row: ForYouEventRow): ScorableEventRow {
  return {
    ...row,
    event_id: Number(row.event_id),
    category_id: row.category_id != null ? Number(row.category_id) : null,
  } as unknown as ScorableEventRow;
}

function parseCoord(raw: string | null, bounds: { min: number; max: number }): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) return null;
  return n;
}

/** Great-circle distance in meters - same formula as the events list route's Haversine, just evaluated in JS over an already-fetched small pool instead of in SQL. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function buildReasonText(
  candidate: ScoredEventCandidate,
  categoryNameById: Map<number, string>,
  learnedAffinityByCategoryId: Map<number, number>,
): string {
  if (candidate.categoryId != null) {
    const learned = learnedAffinityByCategoryId.get(candidate.categoryId) ?? 0;
    const categoryName = categoryNameById.get(candidate.categoryId);
    if (learned >= 0.4 && categoryName) return `Because you like ${categoryName}`;
  }
  return "Starting soon";
}

/**
 * GET /api/mobile/v1/events/for-you?limit=&lat=&lng=
 *
 * Personalized "What's on" feed for Home's EventSpine only - the generic
 * `/events` list endpoint, Events tab, and venue "similar events" rail are
 * untouched and keep their plain chronological order.
 *
 * Blends a learned category-taste signal (from user_listing_events +
 * user_event_events, see getEventCategoryAffinity) with how soon the event
 * starts, cold-start-safe via a time-of-day prior so a brand-new actor still
 * gets a sensible order rather than either raw chronological or nothing. See
 * lib/recommendations/event-scoring.ts for the scoring model.
 *
 * Auth is optional - signed-out callers are identified by `X-Anon-Id` for
 * affinity purposes, same convention as `/user/recommendations`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await getOptionalMobileUser(request);
  await enforceMobileRateLimit(request, user?.id);

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 12 ? limitRaw : 3;
  const anonId = request.headers.get("x-anon-id");

  const lat = parseCoord(searchParams.get("lat"), LAT_BOUNDS);
  const lng = parseCoord(searchParams.get("lng"), LNG_BOUNDS);

  const now = new Date();
  const actor = { userId: user?.id ?? null, anonId: user ? null : anonId };

  let rows: ForYouEventRow[];
  let timeIntentByCategoryId: Map<number, number>;
  let affinity: Awaited<ReturnType<typeof getEventCategoryAffinity>>;
  try {
    const [rowsRes, timeIntent, aff] = await Promise.all([
      query(
        `SELECT ${EVENT_CARD_SQL_COLUMNS}
         FROM ${EVENTS_FROM_SQL}
         WHERE event_status = 'published'
           AND events_with_details.end_time >= NOW()
           AND events_with_details.is_featured IS NOT TRUE
         ORDER BY events_with_details.start_time ASC
         LIMIT $1`,
        [CANDIDATE_POOL_SIZE],
      ),
      getTimeIntentBoostsByCategoryId(now),
      getEventCategoryAffinity(actor),
    ]);
    rows = rowsRes.rows as ForYouEventRow[];
    timeIntentByCategoryId = timeIntent;
    affinity = aff;
  } catch (error) {
    console.error("[mobile-api] events/for-you query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load events.", 500);
  }

  if (rows.length === 0) {
    return ok([], { reason: "No events available right now.", signals: {} });
  }

  const eventCardRows = rows.map(toEventCardRow);
  const categoryNameById = new Map<number, string>();
  for (const row of rows) {
    if (row.category_id != null && row.category_name) {
      categoryNameById.set(Number(row.category_id), row.category_name);
    }
  }

  const scored = scoreEventCandidates(
    eventCardRows.map((row) => ({
      id: row.event_id,
      categoryId: row.category_id,
      startTime: new Date(row.start_time as string),
      distanceMeters:
        lat != null && lng != null && row.latitude != null && row.longitude != null
          ? distanceMeters({ lat, lng }, { lat: Number(row.latitude), lng: Number(row.longitude) })
          : null,
    })),
    {
      timeIntentByCategoryId,
      learnedAffinityByCategoryId: affinity.byCategoryId,
      eventCount: affinity.eventCount,
      now,
      actorKey: user?.id ?? anonId ?? "anon",
    },
  );

  const ranked = [...scored].sort((a, b) => b.score - a.score).slice(0, limit);
  const orderedIds = ranked.map((c) => c.id);
  const rowById = new Map(eventCardRows.map((row) => [row.event_id, row]));

  let attendeesPreviewByEvent: Awaited<ReturnType<typeof getAttendeesPreviewByEvent>> = new Map();
  let primaryImageByEvent = new Map<number, string>();
  let priceRangeByEvent = new Map<number, EventPriceRange>();
  try {
    // Sequential, not Promise.all - same max:1 connection-pool reasoning as
    // the generic events list route, and this only enriches the final
    // (already-ranked, already-sliced) handful, not the whole candidate pool.
    attendeesPreviewByEvent = await getAttendeesPreviewByEvent(orderedIds);
    primaryImageByEvent = await fetchPrimaryImagesByEventId(orderedIds);
    priceRangeByEvent = await fetchPriceRangeByEventId(orderedIds);
  } catch (error) {
    console.error("[mobile-api] events/for-you attendees / image / price query failed:", error);
  }

  const events = orderedIds
    .map((id) => rowById.get(id))
    .filter((row): row is ScorableEventRow => row !== undefined)
    .map((row) =>
      toEventCard(
        row,
        attendeesPreviewByEvent.get(row.event_id),
        primaryImageByEvent.get(row.event_id) ?? null,
        priceRangeByEvent.get(row.event_id) ?? { from: null, to: null },
      ),
    );

  const signals: Record<number, { categoryAffinity: number; reason: string }> = {};
  for (const candidate of ranked) {
    signals[candidate.id] = {
      categoryAffinity: candidate.breakdown.category,
      reason: buildReasonText(candidate, categoryNameById, affinity.byCategoryId),
    };
  }

  return ok(events, {
    reason: affinity.eventCount > 0 ? "Based on what you've been into" : "Based on time of day",
    signals,
  });
});
