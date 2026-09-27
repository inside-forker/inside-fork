import { query } from "@/lib/db";
import { TrendingEventsSection } from "@/components/homepage/TrendingEventsSection";
import type { Event, EventImage } from "@/types/events.types";

function toId(value: unknown): number | null {
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

export async function TrendingEventsContainer() {
  let upcomingEventRows: Record<string, unknown>[] | undefined;
  try {
    // Match mobile/discovery: published and not yet ended (includes ongoing).
    const res = await query(
      `SELECT
         event_id,
         event_name,
         event_slug,
         event_description,
         to_json(start_time) #>> '{}' AS start_time,
         to_json(end_time) #>> '{}' AS end_time,
         event_status,
         organizer_id,
         organizer_name,
         organizer_avatar,
         location_name,
         address,
         latitude,
         longitude,
         is_featured
       FROM events_with_details
       WHERE event_status = 'published' AND end_time >= now()
       ORDER BY start_time ASC, event_id ASC
       LIMIT 6`,
    );
    upcomingEventRows = res.rows;
  } catch (eventsError) {
    console.error("Error fetching trending events", eventsError);
    return null;
  }

  const uniqueUpcomingEventRows =
    upcomingEventRows?.reduce(
      (acc, event) => {
        const eventId = toId(event.event_id);
        if (eventId == null) return acc;
        if (acc.some((existing) => toId(existing.event_id) === eventId)) {
          return acc;
        }
        acc.push({ ...event, event_id: eventId });
        return acc;
      },
      [] as Record<string, unknown>[],
    ) || [];

  const eventIds = uniqueUpcomingEventRows
    .map((event) => toId(event.event_id))
    .filter((eventId): eventId is number => eventId != null);

  let allEventImages: EventImage[] = [];
  if (eventIds.length > 0) {
    try {
      const { rows: imageRows } = await query(
        `SELECT * FROM event_images
         WHERE event_id = ANY($1) AND (is_primary = true OR display_order = 1)
         ORDER BY display_order ASC`,
        [eventIds],
      );
      allEventImages = imageRows as EventImage[];
    } catch (imageErr) {
      console.warn("Error fetching images for trending events", imageErr);
    }
  }

  const primaryImageByEvent = new Map<number, EventImage>();
  for (const img of allEventImages) {
    const imgEventId = Number(img.event_id);
    if (!primaryImageByEvent.has(imgEventId)) {
      primaryImageByEvent.set(imgEventId, img);
    }
  }

  // TEMP PREVIEW ONLY (for Paaltu FarmHouse event 85 if it exists in DB, matching app/events/page.tsx line 130)
  if (!primaryImageByEvent.has(85)) {
    primaryImageByEvent.set(85, {
      id: -1,
      event_id: 85,
      url: "/tmp-preview-farmhouse.jpg",
      alt_text: "Paaltu FarmHouse preview",
      is_primary: true,
      display_order: 1,
    } as EventImage);
  }

  const formattedEvents: Event[] = uniqueUpcomingEventRows
    .map((event): Event | null => {
      const eventId = toId(event.event_id);
      const startTime = toIsoString(event.start_time);
      const endTime = toIsoString(event.end_time);

      if (
        eventId == null ||
        typeof event.event_name !== "string" ||
        typeof event.event_slug !== "string" ||
        !startTime ||
        !endTime
      ) {
        return null;
      }

      return {
        id: eventId,
        name: event.event_name,
        slug: event.event_slug,
        description: (event.event_description as string | null) ?? null,
        start_time: startTime,
        end_time: endTime,
        status: (event.event_status as string) || "published",
        organizer_id: (event.organizer_id as string) || "",
        organizer_name: (event.organizer_name as string | null) ?? null,
        organizer_avatar: (event.organizer_avatar as string | null) ?? null,
        location_name: (event.location_name as string | null) ?? null,
        address: (event.address as string | null) ?? null,
        latitude: typeof event.latitude === "number" ? event.latitude : null,
        longitude: typeof event.longitude === "number" ? event.longitude : null,
        is_featured: Boolean(event.is_featured),
        images: primaryImageByEvent.get(eventId)
          ? [primaryImageByEvent.get(eventId)!]
          : [],
      };
    })
    .filter((event): event is Event => event !== null)
    .slice(0, 6);

  return <TrendingEventsSection events={formattedEvents} />;
}
