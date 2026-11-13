import { query } from "@/lib/db";
import { MoreEvents, type MoreEventItem } from "@/components/events/detail/MoreEvents";
import { fetchPriceRangeByEventId } from "@/lib/mobile/event-pricing";
import { eventPriceLabel, toEventBanner } from "@/lib/events/list";
import { formatEventDateLine } from "@/lib/events/datetime";

/** pg returns timestamptz as Date objects. */
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));

interface SimilarEventsContainerProps {
  eventId: number;
  className?: string;
}

/** "More events": the next two published events coming up, other than this one. */
export async function SimilarEventsContainer({
  eventId,
  className,
}: SimilarEventsContainerProps) {
  const { rows } = await query(
    `SELECT event_id, event_name, event_slug, start_time, end_time FROM events_with_details
     WHERE event_id != $1 AND event_status = 'published' AND end_time >= $2
     ORDER BY start_time ASC, event_id ASC LIMIT 2`,
    [eventId, new Date().toISOString()],
  );
  const events = rows.filter((r) => r.event_id && r.event_name && r.event_slug && r.start_time);
  if (events.length === 0) return null;

  const ids = events.map((r) => Number(r.event_id));
  const [{ rows: images }, prices] = await Promise.all([
    query(
      `SELECT DISTINCT ON (event_id) event_id, url FROM event_images
       WHERE event_id = ANY($1)
       ORDER BY event_id, is_primary DESC NULLS LAST, display_order ASC NULLS LAST, id ASC`,
      [ids],
    ),
    fetchPriceRangeByEventId(ids),
  ]);
  const imageByEvent = new Map<number, string>(images.map((r) => [Number(r.event_id), r.url]));
  const banners = await Promise.all(ids.map((id) => toEventBanner(imageByEvent.get(id))));

  const items: MoreEventItem[] = events.map((r, i) => ({
    id: ids[i],
    slug: r.event_slug,
    name: r.event_name,
    dateLabel: formatEventDateLine(iso(r.start_time), iso(r.end_time ?? r.start_time)),
    priceLabel: eventPriceLabel(prices.get(ids[i])),
    banner: banners[i],
  }));

  return <MoreEvents events={items} className={className} />;
}
