import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

async function verifyAccess(request: NextRequest, eventId: number) {
  const session = await getSession(request);
  if (!session) {
    return { error: "Authentication required", status: 401 };
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
    return { error: "Event not found", status: 404 };
  }

  if (!isAdmin && eventRows[0].organizer_id !== session.userId) {
    return { error: "Access denied", status: 403 };
  }

  return { ok: true, session };
}

/**
 * PATCH /api/admin/events/[id]/tickets/headers
 * Rename a section header and/or update its order across all tickets for this event.
 */
export async function PATCH(
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

    const auth = await verifyAccess(request, eventId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const oldName = typeof body.oldName === "string" ? body.oldName.trim() : "";
    const newName = typeof body.newName === "string" ? body.newName.trim() : "";
    const order =
      body.order !== undefined && body.order !== null && body.order !== "" && !isNaN(Number(body.order))
        ? Number(body.order)
        : null;

    if (!oldName) {
      return NextResponse.json(
        { success: false, error: "Current section header name (oldName) is required" },
        { status: 400 }
      );
    }

    if (!newName) {
      return NextResponse.json(
        { success: false, error: "New section header name (newName) is required" },
        { status: 400 }
      );
    }

    const { rows } = await query(
      `UPDATE ticket_types
       SET group_name = $1,
           group_order = COALESCE($2, group_order)
       WHERE event_id = $3
         AND LOWER(TRIM(group_name)) = LOWER(TRIM($4))
       RETURNING id, name, group_name, group_order`,
      [newName, order, eventId, oldName]
    );

    return NextResponse.json({
      success: true,
      updatedCount: rows.length,
      oldName,
      newName,
      order: order ?? (rows[0]?.group_order ?? 0),
      tickets: rows,
    });
  } catch (error) {
    captureRouteError(error, {
      route: "PATCH /api/admin/events/[id]/tickets/headers",
    });
    console.error("Error updating ticket section header:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]/tickets/headers
 * Dissolves a section header by unsetting group_name across its tickets.
 */
export async function DELETE(
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

    const auth = await verifyAccess(request, eventId);
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Section header name is required" },
        { status: 400 }
      );
    }

    const { rows } = await query(
      `UPDATE ticket_types
       SET group_name = NULL,
           group_order = 0
       WHERE event_id = $1
         AND LOWER(TRIM(group_name)) = LOWER(TRIM($2))
       RETURNING id`,
      [eventId, name]
    );

    return NextResponse.json({
      success: true,
      ungroupedCount: rows.length,
      name,
    });
  } catch (error) {
    captureRouteError(error, {
      route: "DELETE /api/admin/events/[id]/tickets/headers",
    });
    console.error("Error deleting ticket section header:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

