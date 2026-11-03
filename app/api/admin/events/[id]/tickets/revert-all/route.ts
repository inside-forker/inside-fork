import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

/**
 * POST /api/admin/events/[id]/tickets/revert-all
 * Deletes all ticket types and inventory PDFs for this event, providing a clean slate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId) || eventId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const isAdmin = ADMIN_ROLES.includes(profileRows[0]?.role);

    const { rows: eventRows } = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [eventId]
    );
    if (!eventRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    if (!isAdmin && eventRows[0].organizer_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // 1. Delete all ticket_pdf_inventory for ticket types of this event
    const { rowCount: pdfCount } = await query(
      `DELETE FROM ticket_pdf_inventory WHERE ticket_type_id IN (SELECT id FROM ticket_types WHERE event_id = $1)`,
      [eventId]
    );

    // 2. Delete all ticket_types for this event
    const { rowCount: ticketCount } = await query(
      `DELETE FROM ticket_types WHERE event_id = $1`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      deletedTickets: ticketCount ?? 0,
      deletedPdfs: pdfCount ?? 0,
      message: `Successfully deleted ${ticketCount ?? 0} ticket tiers and ${pdfCount ?? 0} PDF passes.`,
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/events/[id]/tickets/revert-all",
      method: "POST",
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revert tickets",
      },
      { status: 500 }
    );
  }
}

