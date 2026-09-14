import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/events/[id]/attendance/export";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

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
      `SELECT name, slug FROM public.events WHERE id = $1 LIMIT 1`,
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
        p_op.full_name AS operator_name,
        b.customer_name,
        b.customer_email,
        b.customer_phone,
        tt.name AS ticket_type_name,
        (
          SELECT COUNT(*)::int 
          FROM public.scan_audit_log sal 
          WHERE sal.ticket_code = tp.code AND sal.event_id = $1 AND sal.is_duplicate = true
        ) AS duplicate_scans
       FROM public.ticket_passes tp
       INNER JOIN public.bookings b ON b.id = tp.booking_id
       LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
       LEFT JOIN public.profiles p_op ON p_op.id = tp.checked_in_by
       WHERE tp.event_id = $1
       ORDER BY tp.checked_in_at DESC NULLS LAST, tp.id ASC`,
      [eventIdNum],
    );

    const headers = [
      "Attendee Name",
      "Customer Email",
      "Customer Phone",
      "Ticket Code",
      "Ticket Type",
      "Status",
      "Present",
      "Check-In Device Time",
      "Check-In Server Time",
      "Checked-In By Operator",
      "Device ID",
      "Duplicate Scan Attempts",
    ];

    const rows = attendees.map((a) => {
      const isPresent = a.status === "checked_in" || !!a.checked_in_at;
      return [
        escapeCsvField(a.guest_name || a.customer_name),
        escapeCsvField(a.customer_email),
        escapeCsvField(a.customer_phone),
        escapeCsvField(a.code),
        escapeCsvField(a.ticket_type_name || "General Admission"),
        escapeCsvField(a.status),
        escapeCsvField(isPresent ? "YES" : "NO"),
        escapeCsvField(a.checked_in_device_time || ""),
        escapeCsvField(a.checked_in_at || ""),
        escapeCsvField(a.operator_name || ""),
        escapeCsvField(a.checked_in_device_id || ""),
        escapeCsvField(Number(a.duplicate_scans) || 0),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const sanitizedSlug = event.slug || `event-${eventIdNum}`;
    const filename = `attendance-${sanitizedSlug}-${new Date().toISOString().split("T")[0]}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Admin event attendance CSV export error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
