import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface EventRecord {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  max_capacity?: number | null;
  status: string;
  location_name?: string | null;
  address?: string | null;
  scanning_mode?: "single" | "multi_gate";
  total_gates?: number;
  assigned_device_index?: number | null;
  assigned_device_label?: string | null;
}

interface BookingRecord {
  id: number;
  event_id: number | null;
  total_amount: number | string;
}

interface TicketTypeRecord {
  id: number;
  event_id: number;
  name: string;
  price: number | string;
  quantity_available: number | null;
}

interface TicketPassRecord {
  id: number;
  event_id: number;
  status: string;
}

/**
 * GET /api/mobile/v1/organizer/events
 *
 * Own-events list with per-event live stats (ticketsSold, capacity, revenue,
 * checkIns, occupancy, eventStatus) and an overall summary. Mirrors
 * `app/api/organizer/events/route.ts` (web), swapped to Bearer auth via
 * `requireMobileOrganizer`. Optional `?eventId=` narrows to one event.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user, isGatePass, linkedOrganizerId } = await requireMobileOrganizer(
    request,
    { allowGatePass: true },
  );
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const eventIdNum = eventId ? parseInt(eventId, 10) : null;

  // Gate pass operators see events they're assigned to via event_device_operators
  // (primary). Also include linked-organizer events so they see the EO roster
  // when not yet slotted onto a lane.
  let eventsSql: string;
  const eventParams: unknown[] = [];

  if (isGatePass) {
    eventParams.push(user.id);
    const linkedParam = linkedOrganizerId
      ? (eventParams.push(linkedOrganizerId), `$${eventParams.length}`)
      : null;
    const eventFilterParam = eventIdNum
      ? (eventParams.push(eventIdNum), `$${eventParams.length}`)
      : null;

    eventsSql = `
      SELECT
        e.id, e.name, e.slug, e.description,
        to_json(e.start_time) #>> '{}' AS start_time,
        to_json(e.end_time) #>> '{}' AS end_time,
        e.max_capacity, e.status, e.location_name, e.address,
        e.scanning_mode, e.total_gates,
        edo.device_index AS assigned_device_index,
        COALESCE(edo.device_label, 'Gate ' || (edo.device_index + 1)) AS assigned_device_label
      FROM events e
      INNER JOIN event_device_operators edo
        ON edo.event_id = e.id AND edo.operator_id = $1
      WHERE 1=1
        ${eventFilterParam ? `AND e.id = ${eventFilterParam}` : ""}
    `;

    if (linkedParam) {
      eventsSql += `
      UNION
      SELECT
        e.id, e.name, e.slug, e.description,
        to_json(e.start_time) #>> '{}' AS start_time,
        to_json(e.end_time) #>> '{}' AS end_time,
        e.max_capacity, e.status, e.location_name, e.address,
        e.scanning_mode, e.total_gates,
        NULL::smallint AS assigned_device_index,
        NULL::text AS assigned_device_label
      FROM events e
      WHERE e.organizer_id = ${linkedParam}
        AND NOT EXISTS (
          SELECT 1 FROM event_device_operators edo2
          WHERE edo2.event_id = e.id AND edo2.operator_id = $1
        )
        ${eventFilterParam ? `AND e.id = ${eventFilterParam}` : ""}
      `;
    }

    eventsSql = `SELECT * FROM (${eventsSql}) gate_events ORDER BY start_time DESC`;
  } else {
    eventParams.push(user.id);
    eventsSql = `SELECT id, name, slug, description,
        to_json(start_time) #>> '{}' AS start_time,
        to_json(end_time) #>> '{}' AS end_time,
        max_capacity, status, location_name, address,
        scanning_mode, total_gates,
        NULL::smallint AS assigned_device_index,
        NULL::text AS assigned_device_label
      FROM events WHERE organizer_id = $1`;
    if (eventIdNum) {
      eventParams.push(eventIdNum);
      eventsSql += ` AND id = $${eventParams.length}`;
    }
    eventsSql += ` ORDER BY start_time DESC`;
  }

  const { rows: eventRows } = await query(eventsSql, eventParams);
  const events: EventRecord[] = eventRows.map((row) => ({
    ...row,
    id: Number(row.id),
    total_gates:
      row.total_gates !== null && row.total_gates !== undefined
        ? Number(row.total_gates)
        : 1,
    scanning_mode: row.scanning_mode || "single",
    assigned_device_index:
      row.assigned_device_index !== null && row.assigned_device_index !== undefined
        ? Number(row.assigned_device_index)
        : null,
    assigned_device_label: row.assigned_device_label || null,
  }));

  if (events.length === 0) {
    return ok({
      events: [],
      summary: {
        totalEvents: 0,
        totalRevenue: 0,
        totalTicketsSold: 0,
        totalCheckIns: 0,
        upcomingEvents: 0,
        pastEvents: 0,
        liveEvents: 0,
      },
    });
  }

  const eventIds = events.map((e) => e.id);

  const { rows: bookingRows } = await query(
    `SELECT id, event_id, total_amount FROM bookings
     WHERE event_id = ANY($1::bigint[]) AND payment_status = 'paid'`,
    [eventIds],
  );
  const bookings: BookingRecord[] = bookingRows.map((row) => ({
    id: Number(row.id),
    event_id: row.event_id !== null ? Number(row.event_id) : null,
    total_amount: row.total_amount,
  }));

  const { rows: ticketTypeRows } = await query(
    `SELECT id, event_id, name, price, quantity_available
     FROM ticket_types WHERE event_id = ANY($1::bigint[])`,
    [eventIds],
  );
  const ticketTypes: TicketTypeRecord[] = ticketTypeRows.map((row) => ({
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
  }));

  const { rows: passRows } = await query(
    `SELECT id, event_id, status FROM ticket_passes
     WHERE event_id = ANY($1::bigint[])`,
    [eventIds],
  );
  const ticketPasses: TicketPassRecord[] = passRows.map((row) => ({
    id: Number(row.id),
    event_id: Number(row.event_id),
    status: row.status,
  }));

  const ticketTypeIds = ticketTypes.map((t) => t.id);
  let bookingItems: {
    booking_id: number;
    ticket_type_id: number;
    quantity: number;
  }[] = [];
  if (ticketTypeIds.length > 0) {
    const { rows } = await query(
      `SELECT booking_id, ticket_type_id, quantity
       FROM booking_items WHERE ticket_type_id = ANY($1::bigint[])`,
      [ticketTypeIds],
    );
    bookingItems = rows.map((row) => ({
      booking_id: Number(row.booking_id),
      ticket_type_id: Number(row.ticket_type_id),
      quantity: row.quantity,
    }));
  }

  const ticketsSoldByType: Record<number, number> = {};
  const confirmedBookingIds = bookings.map((b) => b.id);
  bookingItems.forEach((item) => {
    if (confirmedBookingIds.includes(item.booking_id)) {
      ticketsSoldByType[item.ticket_type_id] =
        (ticketsSoldByType[item.ticket_type_id] || 0) + item.quantity;
    }
  });

  const now = new Date();
  const eventsWithStats = events.map((event) => {
    const eventBookings = bookings.filter((b) => b.event_id === event.id);
    const eventTicketTypes = ticketTypes.filter(
      (t) => t.event_id === event.id,
    );
    const eventPasses = ticketPasses.filter((p) => p.event_id === event.id);

    const ticketsSold = eventTicketTypes.reduce(
      (sum, t) => sum + (ticketsSoldByType[t.id] || 0),
      0,
    );
    const totalCapacity = eventTicketTypes.reduce(
      (sum, t) => sum + (t.quantity_available || 0),
      0,
    );
    const revenue = eventBookings.reduce(
      (sum, b) => sum + Number(b.total_amount || 0),
      0,
    );
    const checkIns = eventPasses.filter(
      (p) => p.status === "checked_in",
    ).length;

    const startTime = new Date(event.start_time);
    const endTime = new Date(event.end_time);
    const isUpcoming = startTime > now;
    const isLive = startTime <= now && endTime >= now;

    return {
      ...event,
      stats: {
        ticketsSold,
        totalCapacity: totalCapacity || event.max_capacity || 0,
        revenue: isGatePass ? 0 : revenue,
        checkIns,
        totalPasses: eventPasses.length,
        occupancyRate:
          totalCapacity > 0
            ? Math.round((ticketsSold / totalCapacity) * 100)
            : 0,
      },
      ticketTypes: eventTicketTypes.map((t) => ({
        id: t.id,
        name: t.name,
        price: Number(t.price),
        sold: ticketsSoldByType[t.id] || 0,
        available: t.quantity_available || 0,
      })),
      eventStatus: isLive ? "live" : isUpcoming ? "upcoming" : "past",
    };
  });

  const summary = {
    totalEvents: events.length,
    totalRevenue: isGatePass
      ? 0
      : eventsWithStats.reduce((sum, e) => sum + e.stats.revenue, 0),
    totalTicketsSold: eventsWithStats.reduce(
      (sum, e) => sum + e.stats.ticketsSold,
      0,
    ),
    totalCheckIns: eventsWithStats.reduce(
      (sum, e) => sum + e.stats.checkIns,
      0,
    ),
    upcomingEvents: events.filter((e) => new Date(e.start_time) > now).length,
    pastEvents: events.filter((e) => new Date(e.end_time) < now).length,
    liveEvents: events.filter(
      (e) => new Date(e.start_time) <= now && new Date(e.end_time) >= now,
    ).length,
  };

  return ok({ events: eventsWithStats, summary });
});
