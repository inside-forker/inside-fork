import {
  fetchPrimaryEventImagesByEventIds,
  fetchUpcomingPublishedEvents,
  type PrimaryEventImageRow,
} from "@/lib/events/upcoming-query";
import { TrendingEventsSection } from "@/components/homepage/TrendingEventsSection";
import type { Event, EventImage } from "@/types/events.types";

export async function TrendingEventsContainer() {
  let upcomingRows: Awaited<ReturnType<typeof fetchUpcomingPublishedEvents>>;
  try {
    upcomingRows = await fetchUpcomingPublishedEvents({ limit: 6 });
  } catch (eventsError) {
    console.error("Error fetching trending events", eventsError);
    return null;
  }

  if (upcomingRows.length === 0) {
    return null;
  }

  const eventIds = upcomingRows.map((row) => row.event_id);

  let primaryImageByEvent = new Map<number, PrimaryEventImageRow>();
  try {
    primaryImageByEvent = await fetchPrimaryEventImagesByEventIds(eventIds);
  } catch (imageErr) {
    console.warn("Error fetching images for trending events", imageErr);
  }

  const formattedEvents: Event[] = upcomingRows.map((row) => {
    const primary = primaryImageByEvent.get(row.event_id);
    const images: EventImage[] = primary
      ? [
          {
            id: primary.id,
            event_id: primary.event_id,
            url: primary.url,
            alt_text: primary.alt_text,
            is_primary: primary.is_primary,
            display_order: primary.display_order,
          },
        ]
      : [];

    return {
      id: row.event_id,
      name: row.event_name,
      slug: row.event_slug,
      description: row.event_description,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.event_status,
      organizer_id: row.organizer_id,
      organizer_name: row.organizer_name,
      organizer_avatar: row.organizer_avatar,
      location_name: row.location_name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      is_featured: row.is_featured,
      images,
    };
  });

  return <TrendingEventsSection events={formattedEvents} />;
}
