import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { parsePdfInventoryUploadForm } from "@/lib/ticketing/parse-pdf-inventory-upload";
import { uploadPdfsToInventory } from "@/lib/ticketing/pdf-inventory-upload";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVILEGED_ROLES = ["admin", "super_admin", "lister"];

async function verifyEventAccess(userId: string, eventIdNum: number) {
  const { rows: profileRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [userId],
  );
  const profile = profileRows[0];

  if (!profile) {
    return { error: "Profile not found", status: 404 } as const;
  }

  const { rows: eventRows } = await query(
    `SELECT id, organizer_id FROM events WHERE id = $1`,
    [eventIdNum],
  );
  const event = eventRows[0];

  if (!event) {
    return { error: "Event not found", status: 404 } as const;
  }

  const isOwner = event.organizer_id === userId;
  const isAdmin = PRIVILEGED_ROLES.includes(profile.role);
  let isCoOrg = false;
  if (!isOwner && !isAdmin) {
    const { rows: coRows } = await query(
      `SELECT 1 FROM public.event_co_organizers WHERE event_id = $1 AND organizer_id = $2`,
      [eventIdNum, userId],
    );
    isCoOrg = coRows.length > 0;
  }

  if (!isOwner && !isAdmin && !isCoOrg) {
    return { error: "Access denied", status: 403 } as const;
  }

  return { ok: true } as const;
}

/**
 * POST /api/organizer/events/[eventId]/ticket-pdf-inventory/upload
 * Multipart: ticket_type_id, files (or file), optional external_ticket_id.
 * Organizer of the event only. No download of uploaded pool.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const { eventId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const eventIdNum = parseInt(eventId, 10);
    if (!Number.isInteger(eventIdNum) || eventIdNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    const access = await verifyEventAccess(session.userId, eventIdNum);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      );
    }

    const parsed = await parsePdfInventoryUploadForm(request);
    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const { rows: typeRows } = await query<{
      id: number | string;
      name: string;
      event_id: number | string;
    }>(
      `SELECT id, name, event_id FROM ticket_types
       WHERE id = $1 AND event_id = $2`,
      [parsed.ticketTypeId, eventIdNum],
    );
    if (!typeRows[0]) {
      return NextResponse.json(
        {
          success: false,
          error: "Ticket type not found for this event",
        },
        { status: 404 },
      );
    }

    const outcome = await uploadPdfsToInventory({
      ticketTypeId: parsed.ticketTypeId,
      files: parsed.files,
    });

    return NextResponse.json({
      success: true,
      data: {
        ticket_type_id: parsed.ticketTypeId,
        ticket_type_name: typeRows[0].name,
        event_id: eventIdNum,
        inserted: outcome.inserted,
        skipped: outcome.skipped,
        quantity_available: outcome.quantity_available,
        results: outcome.results,
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/organizer/events/[eventId]/ticket-pdf-inventory/upload",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
