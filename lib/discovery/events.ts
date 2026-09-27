/**
 * A small "happening soon" slice of real upcoming published events, for the
 * discovery intents where events are actually part of the theme (Date
 * Night, Friends Visiting, Something New - see intents.ts's includeEvents).
 *
 * Not mixed into the intent's `data` array: listings and events are
 * different DTO shapes and the mobile card components only know how to
 * render ListingCardDTO today, so this rides in `meta.events` instead.
 * Returns [] rather than inventing anything when nothing is upcoming.
 */
import {
  fetchUpcomingPublishedEvents,
} from "@/lib/events/upcoming-query";
import { toEventCard, type EventCardDTO, type EventCardRow } from "@/lib/mobile/mappers";

export async function getUpcomingEventCards(limit: number): Promise<EventCardDTO[]> {
  const rows = await fetchUpcomingPublishedEvents({ limit });

  return rows.map((row) =>
    toEventCard({
      ...row,
      event_id: row.event_id,
      category_id: row.category_id,
    } as EventCardRow),
  );
}
