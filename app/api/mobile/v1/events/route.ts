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
  "event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_name, organizer_avatar, location_name, address, latitude, longitude";

function toEventCardRow(row: Record<string, unknown>): EventCardRow {
  return { ...row, event_id: Number(row.event_id) } as unknown as EventCardRow;
}

/**
 * GET /api/mobile/v1/events
 *
 * Public, paginated list of upcoming/ongoing published events (those whose
 * `end_time >= now`), ordered by `start_time` (featured first when `?featured`).
 * Mirrors the website's `app/api/events` handler, normalized into the mobile
 * envelope. Published-only - `event_status` is enforced here.
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

  const whereClauses: string[] = [
    "event_status = 'published'",
    "end_time >= NOW()",
  ];
  const params: unknown[] = [];

  if (featured) {
    whereClauses.push("is_featured = true");
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

  const orderBy = featured
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
      `SELECT ${EVENT_CARD_SQL_COLUMNS}
       FROM events_with_details
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
