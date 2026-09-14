import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/events/[id]/attendance";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const eventIdNum = parseInt(id, 10);
    if (Number.isNaN(eventIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // 1. Fetch Event Header
    const { rows: eventRows } = await query(
      `SELECT e.id, e.name, e.slug, e.start_time, e.end_time, e.location_name,
              p.full_name AS organizer_name, p.organizer_company
       FROM public.events e
       LEFT JOIN public.profiles p ON p.id = e.organizer_id
       WHERE e.id = $1 LIMIT 1`,
      [eventIdNum],
    );
    const event = eventRows[0];
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    // 2. Fetch Attendees Roster & Check-In History
    const { rows: attendees } = await query(
      `SELECT 
        tp.id,
        tp.code,
        tp.status,
        tp.guest_name,
        tp.checked_in_at,
        tp.checked_in_device_id,
        tp.checked_in_device_time,
        p_op.full_name AS checked_in_by_operator_name,
        p_op.username AS checked_in_by_operator_username,
        b.id AS booking_id,
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        tt.name AS ticket_type_name,
        (
          SELECT COUNT(*)::int 
          FROM public.scan_audit_log sal 
          WHERE sal.ticket_code = tp.code AND sal.event_id = $1 AND sal.is_duplicate = true
        ) AS duplicate_scan_attempts
       FROM public.ticket_passes tp
       INNER JOIN public.bookings b ON b.id = tp.booking_id
       LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
       LEFT JOIN public.profiles p_op ON p_op.id = tp.checked_in_by
       WHERE tp.event_id = $1
       ORDER BY tp.checked_in_at DESC NULLS LAST, tp.id ASC`,
      [eventIdNum],
    );

    // 3. Fetch Raw Scan Audit Log summary
    const { rows: auditLogs } = await query(
      `SELECT 
        sal.id,
        sal.ticket_code,
        sal.device_id,
        sal.scanned_at,
        sal.synced_at,
        sal.is_duplicate,
        sal.status,
        p.full_name AS operator_name
       FROM public.scan_audit_log sal
       LEFT JOIN public.profiles p ON p.id = sal.scanned_by
       WHERE sal.event_id = $1
       ORDER BY sal.scanned_at DESC
       LIMIT 100`,
      [eventIdNum],
    );

    const totalTickets = attendees.length;
    const presentCount = attendees.filter(
      (a) => a.status === "checked_in" || !!a.checked_in_at,
    ).length;
    const expectedCount = totalTickets - presentCount;
    const totalDuplicateScans = attendees.reduce(
      (sum, a) => sum + (Number(a.duplicate_scan_attempts) || 0),
      0,
    );

    return NextResponse.json({
      success: true,
      data: {
        event: {
          id: Number(event.id),
          name: event.name,
          slug: event.slug,
          startTime: event.start_time,
          endTime: event.end_time,
          locationName: event.location_name,
          organizerName: event.organizer_name,
          organizerCompany: event.organizer_company,
        },
        stats: {
          totalTickets,
          presentCount,
          expectedCount,
          attendanceRate: totalTickets > 0 ? Math.round((presentCount / totalTickets) * 100) : 0,
          totalDuplicateScans,
        },
        attendees: attendees.map((a) => ({
          id: Number(a.id),
          code: a.code,
          status: a.status,
          guestName: a.guest_name || a.customer_name,
          customerEmail: a.customer_email,
          customerPhone: a.customer_phone,
          ticketType: a.ticket_type_name || "General Admission",
          isPresent: a.status === "checked_in" || !!a.checked_in_at,
          checkedInAt: a.checked_in_at,
          checkedInDeviceTime: a.checked_in_device_time,
          checkedInDeviceId: a.checked_in_device_id,
          operatorName: a.checked_in_by_operator_name || a.checked_in_by_operator_username || null,
          duplicateScanAttempts: Number(a.duplicate_scan_attempts) || 0,
        })),
        recentAuditLogs: auditLogs,
      },
    });
  } catch (error) {
    console.error("Admin event attendance API error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
