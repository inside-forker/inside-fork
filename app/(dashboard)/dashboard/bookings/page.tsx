import { query } from "@/lib/db";
import {
  BookingsDashboard,
  DashboardBooking,
} from "@/components/dashboard/BookingsDashboard";
import { Database } from "@/types/database";
import { requireSessionUser } from "@/lib/auth/require-session";

export const dynamic = "force-dynamic";

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"] & {
  ticket_passes?: Array<
    Pick<
      Database["public"]["Tables"]["ticket_passes"]["Row"],
      | "id"
      | "booking_id"
      | "code"
      | "status"
      | "quantity_index"
      | "issued_at"
      | "ticket_type_id"
      | "guest_name"
      | "cnic_last4"
    >
  >;
};

type EventDetails = {
  event_id: number;
  event_name: string | null;
  event_slug: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
};

type EventsWithDetailsRow = {
  event_id: number | null;
  event_name: string | null;
  event_slug: string | null;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
};

export default async function DashboardBookingsPage() {
  const { user } = await requireSessionUser({ withProfile: false });

  let bookings: BookingRow[];
  try {
    const { rows: bookingRows } = await query(
      `SELECT id, booking_reference, payment_status, status, total_amount, created_at, event_id
       FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.id],
    );

    const bookingIds = bookingRows.map((b) => Number(b.id));
    let passesByBooking = new Map<number, BookingRow["ticket_passes"]>();

    if (bookingIds.length > 0) {
      const { rows: passRows } = await query(
        `SELECT 
          tp.id, 
          tp.booking_id, 
          tp.code, 
          tp.status, 
          tp.quantity_index, 
          tp.issued_at, 
          tp.ticket_type_id, 
          tp.guest_name, 
          tp.cnic_last4,
          tp.assigned_gate_index,
          COALESCE(edo.device_label, CASE WHEN tp.assigned_gate_index IS NOT NULL THEN 'Gate ' || (tp.assigned_gate_index + 1) ELSE NULL END) AS gate_label
         FROM ticket_passes tp
         LEFT JOIN event_device_operators edo ON edo.event_id = tp.event_id AND edo.device_index = tp.assigned_gate_index
         WHERE tp.booking_id = ANY($1)`,
        [bookingIds],
      );
      passesByBooking = new Map();
      for (const pass of passRows) {
        const bookingId = Number(pass.booking_id);
        const list = passesByBooking.get(bookingId) ?? [];
        list.push({
          ...pass,
          id: Number(pass.id),
          booking_id: bookingId,
          quantity_index: Number(pass.quantity_index),
          ticket_type_id: Number(pass.ticket_type_id),
          assigned_gate_index: pass.assigned_gate_index !== null && pass.assigned_gate_index !== undefined ? Number(pass.assigned_gate_index) : null,
          gate_label: pass.gate_label || null,
        });
        passesByBooking.set(bookingId, list);
      }
    }

    bookings = bookingRows.map((b) => ({
      ...b,
      id: Number(b.id),
      event_id: b.event_id !== null ? Number(b.event_id) : null,
      total_amount: Number(b.total_amount),
      ticket_passes: passesByBooking.get(Number(b.id)) ?? [],
    })) as BookingRow[];
  } catch (bookingsError) {
    console.error("Failed to load bookings for dashboard", bookingsError);
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center px-4">
        <p className="text-lg font-medium">Unable to load bookings</p>
        <p className="text-sm text-muted-foreground">
          Something went wrong fetching your bookings. Please try refreshing the
          page.
        </p>
      </div>
    );
  }

  const eventIds = Array.from(
    new Set(
      bookings
        .map((booking) => booking.event_id)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  let eventsMap = new Map<number, EventDetails>();

  if (eventIds.length > 0) {
    try {
      const { rows: eventsRows } = await query(
        `SELECT event_id, event_name, event_slug, start_time, end_time, location_name
         FROM events_with_details WHERE event_id = ANY($1)`,
        [eventIds],
      );
      eventsMap = new Map(
        (eventsRows as EventsWithDetailsRow[])
          .filter((row) => row?.event_id)
          .map((row) => [
            Number(row.event_id),
            {
              event_id: Number(row.event_id),
              event_name: row.event_name,
              event_slug: row.event_slug,
              start_time: row.start_time,
              end_time: row.end_time,
              location_name: row.location_name,
            },
          ]),
      );
    } catch (eventsError) {
      console.error("Failed to load event details for bookings", eventsError);
    }
  }

  const normalizedBookings: DashboardBooking[] = bookings.map((booking) => {
    const event = booking.event_id
      ? (eventsMap.get(booking.event_id) ?? null)
      : null;
    const passes = [...(booking.ticket_passes ?? [])].sort(
      (a, b) => a.quantity_index - b.quantity_index,
    );

    return {
      id: booking.id,
      booking_reference: booking.booking_reference,
      payment_status: booking.payment_status,
      status: booking.status,
      total_amount: booking.total_amount,
      created_at: booking.created_at,
      passes: passes.map((pass) => ({
        id: pass.id,
        booking_id: pass.booking_id,
        code: pass.code,
        status: pass.status,
        quantity_index: pass.quantity_index,
        issued_at: pass.issued_at,
        ticket_type_id: pass.ticket_type_id,
        guest_name: pass.guest_name,
        cnic_last4: pass.cnic_last4,
      })),
      event: event
        ? {
            id: event.event_id,
            name: event.event_name ?? "",
            slug: event.event_slug ?? "",
            start_time: event.start_time ?? "",
            end_time: event.end_time,
            venue_name: event.location_name,
          }
        : null,
    };
  });

  return <BookingsDashboard bookings={normalizedBookings} />;
}
