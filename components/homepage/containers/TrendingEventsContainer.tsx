import { query } from "@/lib/db";
import { TrendingEventsSection } from "@/components/homepage/TrendingEventsSection";
import { formatEventDate } from "@/lib/utils/date-utils";

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
         location_name,
         address
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

  let ticketTypesByEvent = new Map<number, { name: string; price: number }[]>();

  if (eventIds.length > 0) {
    try {
      const resTickets = await query(
        `SELECT event_id, name, price FROM ticket_types WHERE event_id = ANY($1) ORDER BY price ASC`,
        [eventIds],
      );
      const ticketTypes = resTickets.rows;

      ticketTypesByEvent = ticketTypes.reduce((acc, ticketType) => {
        const eventId = toId(ticketType.event_id);
        if (eventId == null) return acc;
        const existing = acc.get(eventId) || [];
        existing.push({
          name: String(ticketType.name),
          price: Number(ticketType.price),
        });
        acc.set(eventId, existing);
        return acc;
      }, new Map<number, { name: string; price: number }[]>());
    } catch (ticketTypesError) {
      console.warn(
        "Error fetching ticket types for trending events",
        ticketTypesError,
      );
    }
  }

  // Pre-format dates on server side to prevent hydration mismatches
  const formattedEvents =
    uniqueUpcomingEventRows
      .map((event) => {
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
          listing_name: (event.location_name as string | null) ?? null,
          listing_address: (event.address as string | null) ?? null,
          ticket_types: ticketTypesByEvent.get(eventId) || [],
          formatted_date: formatEventDate(startTime),
        };
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)
      .slice(0, 6);

  return <TrendingEventsSection events={formattedEvents} />;
}
