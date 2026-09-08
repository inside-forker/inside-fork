import { query } from "@/lib/db";

export type EventPriceRange = { from: number | null; to: number | null };

/**
 * Batch-loads the cheapest and dearest ticket price for each event, keyed by
 * event_id. Used by event list endpoints so an EventCard can show "From PKR X"
 * without pulling every event's full ticket list. Mirrors the detail route's
 * ticket query: every `ticket_types` row counts, with no sale-window or
 * availability filter. Events with no ticket types simply don't appear in the
 * map (the caller renders no price).
 */
export async function fetchPriceRangeByEventId(
  eventIds: number[],
): Promise<Map<number, EventPriceRange>> {
  if (eventIds.length === 0) return new Map();

  const { rows } = await query(
    `SELECT event_id, MIN(price) AS from_price, MAX(price) AS to_price
     FROM ticket_types
     WHERE event_id = ANY($1)
     GROUP BY event_id`,
    [eventIds],
  );

  return new Map(
    rows.map((row) => [
      Number(row.event_id),
      {
        from: row.from_price !== null ? Number(row.from_price) : null,
        to: row.to_price !== null ? Number(row.to_price) : null,
      },
    ]),
  );
}
