import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { toEventCard, type EventCardRow } from "@/lib/mobile/mappers";
import { getAttendeesPreviewByEvent } from "@/lib/mobile/attendees";

export const dynamic = "force-dynamic";

const VENUE_SQL_COLUMNS =
  "id, name, slug, description, address, latitude, longitude, phone, website, rating, facilities, cover_image_url";

/** Same base columns as the events list route's card, minus category/price/
 * distance (not needed here) - just enough for `EventListCard` on the client.
 * This route joins `events e` (below) to filter by venue_id, and
 * `events_with_details`/`events` share many column names - every shared
 * column must be qualified with `events_with_details.` or Postgres rejects
 * the query as ambiguous. Same concern as the events list/detail routes. */
const EVENT_CARD_SQL_COLUMNS =
  "events_with_details.event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(events_with_details.start_time) #>> '{}' AS start_time, " +
  "to_json(events_with_details.end_time) #>> '{}' AS end_time, " +
  "events_with_details.is_featured, organizer_name, organizer_avatar, " +
  "events_with_details.location_name, events_with_details.address, " +
  "events_with_details.latitude, events_with_details.longitude, " +
  "events_with_details.category_id";

/**
 * GET /api/mobile/v1/venues/{id}
 *
 * Public venue detail plus its upcoming published events. `venue_id` isn't on
 * the (untracked) `events_with_details` view, so events are looked up by
 * joining back to the base `events` table by id, same approach the events
 * list/detail routes use to reach it.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);

  const { id } = await params;
  const venueId = Number(id);
  if (!Number.isInteger(venueId) || venueId <= 0) {
    throw new MobileApiError("validation_error", "Invalid venue id.", 400, "id");
  }

  const { rows: venueRows } = await query(
    `SELECT ${VENUE_SQL_COLUMNS} FROM venues WHERE id = $1`,
    [venueId],
  );
  const venueRow = venueRows[0];
  if (!venueRow) {
    throw new MobileApiError("not_found", "Venue not found.", 404);
  }

  const { rows: eventRows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS}
     FROM events_with_details
     JOIN events e ON e.id = events_with_details.event_id
     WHERE e.venue_id = $1 AND event_status = 'published' AND events_with_details.end_time >= NOW()
     ORDER BY events_with_details.start_time ASC, event_id ASC
     LIMIT 20`,
    [venueId],
  );

  const eventCardRows = eventRows.map(
    (row) =>
      ({
        ...row,
        event_id: Number(row.event_id),
        // category_id is `bigint` - pg returns it as a string, not a number.
        category_id: row.category_id != null ? Number(row.category_id) : null,
      }) as unknown as EventCardRow,
  );
  const eventIds = eventCardRows
    .map((r) => r.event_id)
    .filter((eventId): eventId is number => eventId != null);

  let attendeesPreviewByEvent: Awaited<ReturnType<typeof getAttendeesPreviewByEvent>> = new Map();
  let primaryImageByEvent = new Map<number, string>();
  try {
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
    primaryImageByEvent = new Map(imagesResult.rows.map((r) => [Number(r.event_id), r.url as string]));
  } catch (error) {
    console.error("[mobile-api] venue events attendees/image query failed:", error);
  }

  const events = eventCardRows.map((row) =>
    toEventCard(
      row,
      row.event_id != null ? attendeesPreviewByEvent.get(row.event_id) : undefined,
      row.event_id != null ? (primaryImageByEvent.get(row.event_id) ?? null) : null,
    ),
  );

  return ok({
    venue: {
      id: Number(venueRow.id),
      name: venueRow.name,
      slug: venueRow.slug,
      description: venueRow.description,
      address: venueRow.address,
      latitude: venueRow.latitude,
      longitude: venueRow.longitude,
      phone: venueRow.phone,
      website: venueRow.website,
      rating: venueRow.rating != null ? Number(venueRow.rating) : null,
      facilities: (venueRow.facilities ?? []) as string[],
      cover_image_url: venueRow.cover_image_url,
    },
    events,
  });
});
