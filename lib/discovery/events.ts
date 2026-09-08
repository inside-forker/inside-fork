/**
 * A small "happening soon" slice of real upcoming published events, for the
 * discovery intents where events are actually part of the theme (Date
 * Night, Friends Visiting, Something New - see intents.ts's includeEvents).
 * Same eligibility rule and timestamp casting as
 * GET /api/mobile/v1/events - published, end_time >= now, ISO strings via
 * to_json()#>>'{}' rather than pg's default timestamp serialization.
 *
 * Not mixed into the intent's `data` array: listings and events are
 * different DTO shapes and the mobile card components only know how to
 * render ListingCardDTO today, so this rides in `meta.events` instead.
 * Returns [] rather than inventing anything when nothing is upcoming - true
 * for most of the catalog today (3 published events total as of
 * 2026-08-05), by design never backfilled with fake data.
 */
import { query } from "@/lib/db";
import { toEventCard, type EventCardDTO, type EventCardRow } from "@/lib/mobile/mappers";

const EVENT_CARD_SQL_COLUMNS =
  "event_id, event_name, event_slug, event_description, event_status, " +
  "to_json(start_time) #>> '{}' AS start_time, " +
  "to_json(end_time) #>> '{}' AS end_time, " +
  "is_featured, organizer_name, organizer_avatar, location_name, address, latitude, longitude, category_id";

export async function getUpcomingEventCards(limit: number): Promise<EventCardDTO[]> {
  const { rows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS}
     FROM events_with_details
     WHERE event_status = 'published' AND end_time >= now()
     ORDER BY start_time ASC, event_id ASC
     LIMIT $1`,
    [limit],
  );

  return (rows as Array<Record<string, unknown>>).map((row) =>
    toEventCard({
      ...row,
      event_id: Number(row.event_id),
      // category_id is `bigint` - pg returns it as a string, not a number.
      category_id: row.category_id != null ? Number(row.category_id) : null,
    } as EventCardRow),
  );
}
