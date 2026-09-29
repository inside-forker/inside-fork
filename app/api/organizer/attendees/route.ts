import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns this event
    const { rows: eventRows } = await query(
      `SELECT e.id, e.name, e.slug, to_json(e.start_time) #>> '{}' AS start_time,
              to_json(e.end_time) #>> '{}' AS end_time, e.location_name, e.address, e.organizer_id,
              COALESCE(p.organizer_company, p.full_name, 'Inside Karachi') AS organizer_name
       FROM events e
       LEFT JOIN profiles p ON p.id = e.organizer_id
       WHERE e.id = $1`,
      [parseInt(eventId, 10)]
    );
    const event = eventRows[0];

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Check if user is organizer or admin
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const role = profileRows[0]?.role;

    const isAdmin = role === "admin" || role === "super_admin";
    const isOwner = event.organizer_id === session.userId;
    let isCoOrg = false;
    if (!isOwner && !isAdmin) {
      const { rows: coRows } = await query(
        `SELECT 1 FROM public.event_co_organizers WHERE event_id = $1 AND organizer_id = $2`,
        [parseInt(eventId, 10), session.userId]
      );
      isCoOrg = coRows.length > 0;
    }

    if (!isOwner && !isAdmin && !isCoOrg) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get all ticket passes for this event
    let passes;
    try {
      const { rows } = await query(
        `SELECT
           tp.id, tp.code, tp.status, tp.guest_name, tp.cnic_last4,
           to_json(tp.checked_in_at) #>> '{}' AS checked_in_at,
           to_json(tp.issued_at) #>> '{}' AS issued_at,
           tp.quantity_index, tp.assigned_gate_index AS assigned_device_index,
           b.id AS booking_id, b.user_id AS booking_user_id,
           COALESCE(b.booking_reference, b.id::text) AS booking_code,
           b.customer_name, b.customer_email, b.customer_phone,
           p.full_name AS buyer_full_name, p.phone AS buyer_phone,
           tt.name AS ticket_type_name, tt.price AS ticket_type_price
         FROM ticket_passes tp
         INNER JOIN bookings b ON b.id = tp.booking_id
         LEFT JOIN profiles p ON p.id = b.user_id
         LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.event_id = $1
           AND b.payment_status = 'paid'
           AND tp.status != 'revoked'
         ORDER BY tp.issued_at DESC`,
        [parseInt(eventId, 10)]
      );
      passes = rows;
    } catch (error) {
      console.error("Passes fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch attendees" },
        { status: 500 }
      );
    }

    // Format attendees - use customer_email from booking, fallback to profile data
    const attendees = passes.map((pass) => ({
      id: Number(pass.id),
      code: pass.code,
      status: pass.status,
      guestName:
        pass.guest_name || pass.customer_name || pass.buyer_full_name || "Guest",
      buyerName: pass.customer_name || pass.buyer_full_name || "Customer",
      guestCnic: pass.cnic_last4 || null,
      guestCnicFormatted: pass.cnic_last4
        ? `*****-*******-${pass.cnic_last4.slice(0, 1)}`
        : null,
      ticketType: pass.ticket_type_name || "Standard",
      price: pass.ticket_type_price !== null ? Number(pass.ticket_type_price) : 0,
      assignedDeviceIndex: pass.assigned_device_index,
      checkedInAt: pass.checked_in_at,
      issuedAt: pass.issued_at,
      bookingId: Number(pass.booking_id),
      bookingCode: pass.booking_code,
      quantityIndex: pass.quantity_index !== null ? Number(pass.quantity_index) : 0,
      buyerEmail: pass.customer_email,
      buyerPhone: pass.customer_phone || pass.buyer_phone,
    }));

    // Calculate stats
    const stats = {
      total: attendees.length,
      checkedIn: attendees.filter((a) => a.status === "checked_in").length,
      pending: attendees.filter((a) => a.status === "issued" || a.status === "active").length,
    };

    return NextResponse.json({
      success: true,
      event: {
        id: Number(event.id),
        name: event.name,
        slug: event.slug,
        start_time: event.start_time,
        end_time: event.end_time,
        location_name: event.location_name,
        address: event.address,
        organizer_name: event.organizer_name,
      },
      attendees,
      stats,
    });
  } catch (error) {
    console.error("Attendees fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
