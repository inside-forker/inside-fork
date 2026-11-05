import { query } from "@/lib/db";
import { MoreEvents } from "@/components/events/detail/MoreEvents";
import { Event, EventImage } from "@/types/events.types";
import { fetchPriceRangeByEventId } from "@/lib/mobile/event-pricing";

interface SimilarEventsContainerProps {
  eventId: number;
  className?: string;
}

/** "More events": the next published event coming up, other than this one. */
export async function SimilarEventsContainer({
  eventId,
  className,
}: SimilarEventsContainerProps) {
  const { rows } = await query(
    `SELECT * FROM events_with_details
     WHERE event_id != $1 AND event_status = 'published' AND start_time >= $2
     ORDER BY start_time ASC LIMIT 1`,
    [eventId, new Date().toISOString()],
  );
  const row = rows[0];

  if (
    !row?.event_id ||
    !row.event_name ||
    !row.event_slug ||
    !row.start_time ||
    !row.end_time ||
    !row.event_status ||
    !row.organizer_id
  ) {
    return null;
  }

  const id = Number(row.event_id);
  const [{ rows: images }, prices] = await Promise.all([
    query(`SELECT * FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`, [id]),
    fetchPriceRangeByEventId([id]),
  ]);

  const event: Event = {
    id,
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
    images: (images || []) as EventImage[],
  };

  return <MoreEvents event={event} fromPrice={prices.get(id)?.from ?? null} className={className} />;
}
