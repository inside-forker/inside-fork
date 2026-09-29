import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

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
  is_commission_based: boolean;
  commission_rate?: number | null;
  created_at: string;
  location_name?: string | null;
  address?: string | null;
}

interface BookingRecord {
  id: number;
  event_id: number | null;
  total_amount: number | string;
  status: string;
  created_at: string;
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
  checked_in_at?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's events with stats
    const eventParams: unknown[] = [session.userId];
    let eventsSql = `SELECT id, name, slug, description,
        to_json(start_time) #>> '{}' AS start_time,
        to_json(end_time) #>> '{}' AS end_time,
        max_capacity, status, is_commission_based, commission_rate,
        to_json(created_at) #>> '{}' AS created_at,
        location_name, address
      FROM events
      WHERE (organizer_id = $1 OR EXISTS (
        SELECT 1 FROM public.event_co_organizers eco
        WHERE eco.event_id = events.id AND eco.organizer_id = $1
      ))`;

    if (eventId) {
      eventParams.push(parseInt(eventId, 10));
      eventsSql += ` AND id = $${eventParams.length}`;
    }
    eventsSql += ` ORDER BY start_time DESC`;

    let events: EventRecord[];
    try {
      const { rows } = await query(eventsSql, eventParams);
      events = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        // commission_rate is a numeric column; node-pg returns it as a
        // string by default (no custom type parser configured), unlike the
        // old PostgREST path which serialized it as a JSON number.
        commission_rate:
          row.commission_rate !== null ? Number(row.commission_rate) : null,
      }));
    } catch (error) {
      console.error("Events fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 },
      );
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        events: [],
        summary: {
          totalEvents: 0,
          totalRevenue: 0,
          totalTicketsSold: 0,
          totalCheckIns: 0,
          upcomingEvents: 0,
          pastEvents: 0,
        },
      });
    }

    const eventIds = events.map((e) => e.id);

    // Get bookings for these events - filter by payment_status = 'paid' for accurate revenue
    let bookings: BookingRecord[] = [];
    try {
      const { rows } = await query(
        `SELECT id, event_id, total_amount, status,
           to_json(created_at) #>> '{}' AS created_at
         FROM bookings WHERE event_id = ANY($1::bigint[]) AND payment_status = 'paid'`,
        [eventIds]
      );
      bookings = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: row.event_id !== null ? Number(row.event_id) : null,
      }));
    } catch (error) {
      console.error("Bookings fetch error:", error);
    }

    // Get ticket types for capacity info
    let ticketTypes: TicketTypeRecord[] = [];
    try {
      const { rows } = await query(
        `SELECT id, event_id, name, price, quantity_available
         FROM ticket_types WHERE event_id = ANY($1::bigint[])`,
        [eventIds]
      );
      ticketTypes = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: Number(row.event_id),
      }));
    } catch (error) {
      console.error("Ticket types fetch error:", error);
    }

    // Get check-in counts (from ticket_passes)
    let ticketPasses: TicketPassRecord[] = [];
    try {
      const { rows } = await query(
        `SELECT id, event_id, status,
           to_json(checked_in_at) #>> '{}' AS checked_in_at
         FROM ticket_passes WHERE event_id = ANY($1::bigint[])`,
        [eventIds]
      );
      ticketPasses = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: Number(row.event_id),
      }));
    } catch (error) {
      console.error("Ticket passes fetch error:", error);
    }

    // Calculate tickets sold from booking_items
    const ticketTypeIds = ticketTypes.map((t) => t.id);
    let bookingItems: { booking_id: number; ticket_type_id: number; quantity: number }[] = [];
    if (ticketTypeIds.length > 0) {
      try {
        const { rows } = await query(
          `SELECT booking_id, ticket_type_id, quantity
           FROM booking_items WHERE ticket_type_id = ANY($1::bigint[])`,
          [ticketTypeIds]
        );
        bookingItems = rows.map((row) => ({
          booking_id: Number(row.booking_id),
          ticket_type_id: Number(row.ticket_type_id),
          quantity: row.quantity,
        }));
      } catch (error) {
        console.error("Booking items fetch error:", error);
      }
    }

    // Build a map of ticket_type_id -> quantity sold
    const ticketsSoldByType: Record<number, number> = {};
    const confirmedBookingIds = bookings.map((b) => b.id);
    bookingItems.forEach((item) => {
      if (confirmedBookingIds.includes(item.booking_id)) {
        ticketsSoldByType[item.ticket_type_id] =
          (ticketsSoldByType[item.ticket_type_id] || 0) + item.quantity;
      }
    });

    // Calculate per-event stats
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

      const now = new Date();
      const startTime = new Date(event.start_time);
      const endTime = new Date(event.end_time);
      const isUpcoming = startTime > now;
      const isLive = startTime <= now && endTime >= now;

      return {
        ...event,
        stats: {
          ticketsSold,
          totalCapacity: totalCapacity || event.max_capacity || 0,
          revenue,
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

    // Calculate summary
    const now = new Date();
    const summary = {
      totalEvents: events.length,
      totalRevenue: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.revenue,
        0,
      ),
      totalTicketsSold: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.ticketsSold,
        0,
      ),
      totalCheckIns: eventsWithStats.reduce(
        (sum, e) => sum + e.stats.checkIns,
        0,
      ),
      upcomingEvents: events.filter((e) => new Date(e.start_time) > now)
        .length,
      pastEvents: events.filter((e) => new Date(e.end_time) < now).length,
      liveEvents: events.filter(
        (e) => new Date(e.start_time) <= now && new Date(e.end_time) >= now,
      ).length,
    };

    return NextResponse.json({
      events: eventsWithStats,
      summary,
    });
  } catch (error) {
    console.error("Organizer events error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
