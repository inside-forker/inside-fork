import { type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { MobileApiError } from "@/lib/mobile/errors";
import { mobileRoute } from "@/lib/mobile/handler";
import { toEventCard, type EventCardRow } from "@/lib/mobile/mappers";
import {
  buildPaginationMeta,
  parsePagination,
} from "@/lib/mobile/pagination";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { ok } from "@/lib/mobile/response";

export const dynamic = "force-dynamic";

/** Recently announced means created within this rolling window. */
const RECENT_ANNOUNCEMENT_WINDOW = "5 days";

const EVENT_CARD_SQL_COLUMNS =
  "event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_name, organizer_avatar, location_name, address, latitude, longitude, category_id";

type RecentlyAnnouncedEventRow = Record<string, unknown> & {
  event_id: number | string;
  announced_at: string | null;
};

function toEventCardRow(row: RecentlyAnnouncedEventRow): EventCardRow {
  return {
    ...row,
    event_id: Number(row.event_id),
    // category_id is `bigint` - pg returns it as a string, not a number.
    category_id: row.category_id != null ? Number(row.category_id) : null,
  } as unknown as EventCardRow;
}

/**
 * GET /api/mobile/v1/events/recently-announced
 *
 * Public, paginated home-feed section for recently announced events. An event
 * must be published, still ongoing/upcoming (`end_time >= now()`), and have
 * been created in the last five rolling days. Events are ordered by their
 * immutable platform `created_at` timestamp instead of `updated_at`, so
 * editing an older event never makes it appear newly announced. The events
 * schema does not currently store `published_at`, so `created_at` is the
 * available announcement-time source of truth.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  try {
    const [eventsResult, countResult] = await Promise.all([
      query(
        `SELECT ${EVENT_CARD_SQL_COLUMNS},
                to_json(created_at) #>> '{}' AS announced_at
         FROM events_with_details
         WHERE event_status = 'published'
           AND end_time >= NOW()
           AND created_at >= NOW() - $1::interval
         ORDER BY created_at DESC NULLS LAST, event_id DESC
         LIMIT $2 OFFSET $3`,
        [RECENT_ANNOUNCEMENT_WINDOW, limit, offset],
      ),
      query(
        `SELECT COUNT(*)::integer AS total
         FROM events_with_details
         WHERE event_status = 'published'
           AND end_time >= NOW()
           AND created_at >= NOW() - $1::interval`,
        [RECENT_ANNOUNCEMENT_WINDOW],
      ),
    ]);

    const events = (eventsResult.rows as RecentlyAnnouncedEventRow[]).map(
      (row) => ({
        ...toEventCard(toEventCardRow(row)),
        announced_at: row.announced_at,
      }),
    );

    return ok(events, {
      pagination: buildPaginationMeta(
        page,
        limit,
        Number(countResult.rows[0]?.total ?? 0),
      ),
    });
  } catch (error) {
    console.error(
      "[mobile-api] recently announced events query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load recently announced events.",
      500,
    );
  }
});
