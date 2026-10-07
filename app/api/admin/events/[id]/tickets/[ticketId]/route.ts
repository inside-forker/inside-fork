import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

const TICKET_TYPE_COLUMNS =
  "id, event_id, name, description, price, quantity_available, " +
  "to_json(sale_starts_at) #>> '{}' AS sale_starts_at, " +
  "to_json(sale_ends_at) #>> '{}' AS sale_ends_at, " +
  "max_per_person";

function toNumericTicketType(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
    price: row.price !== null ? Number(row.price) : null,
  };
}

async function requireAdminRole(userId: string) {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    return { error: "Profile not found", status: 404 } as const;
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    return { error: "Admin or lister access required", status: 403 } as const;
  }
  return { ok: true } as const;
}

// PUT /api/admin/events/[id]/tickets/[ticketId] - Update ticket type
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id, ticketId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(id);
    const ticketTypeId = parseInt(ticketId);

    if (isNaN(eventId) || isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event or ticket ID" },
        { status: 400 }
      );
    }

    // Verify ticket type exists and belongs to the event
    const { rows: existingRows } = await query(
      `SELECT id, event_id FROM ticket_types WHERE id = $1 AND event_id = $2`,
      [ticketTypeId, eventId]
    );
    if (!existingRows[0]) {
      return NextResponse.json(
        { success: false, error: "Ticket type not found" },
        { status: 404 }
      );
    }

    // Get event details for validation
    const { rows: eventRows } = await query(
      `SELECT id, start_time, end_time FROM events WHERE id = $1`,
      [eventId]
    );
    if (!eventRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
      quantity_available,
      sale_starts_at,
      sale_ends_at,
      max_per_person,
    } = body;

    // Get current ticket data for comparison
    const { rows: currentTicketRows } = await query(
      `SELECT sale_starts_at, sale_ends_at FROM ticket_types WHERE id = $1`,
      [ticketTypeId]
    );
    if (!currentTicketRows[0]) {
      console.error("Error fetching current ticket: not found");
      return NextResponse.json(
        { success: false, error: "Failed to fetch current ticket data" },
        { status: 500 }
      );
    }

    // Validation - More flexible for updates
    if (name !== undefined && !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Ticket name cannot be empty" },
        { status: 400 }
      );
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return NextResponse.json(
        { success: false, error: "Valid price is required" },
        { status: 400 }
      );
    }

    let saleStart: Date | undefined;
    let saleEnd: Date | undefined;

    if (sale_starts_at) {
      saleStart = new Date(sale_starts_at);
    }

    if (sale_ends_at) {
      saleEnd = new Date(sale_ends_at);
    }

    // Only validate date logic if dates are being changed
    if (
      (saleStart || saleEnd) &&
      saleStart &&
      saleEnd &&
      saleStart >= saleEnd
    ) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    // For updates, be more lenient with sale end date validation
    // Only prevent obviously invalid scenarios (like sale ending before sale starts)
    // Allow sale periods to extend beyond event time for flexibility
    if (saleStart && saleEnd && saleStart >= saleEnd) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    if (
      quantity_available !== undefined &&
      quantity_available !== null &&
      quantity_available < 0
    ) {
      return NextResponse.json(
        { success: false, error: "Quantity available cannot be negative" },
        { status: 400 }
      );
    }

    if (
      max_per_person !== undefined &&
      max_per_person !== null &&
      max_per_person < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Max per person must be at least 1" },
        { status: 400 }
      );
    }

    // Build update
    const setClauses: string[] = [];
    const updateParams: unknown[] = [];

    const pushField = (column: string, value: unknown) => {
      updateParams.push(value);
      setClauses.push(`${column} = $${updateParams.length}`);
    };

    if (name !== undefined) pushField("name", name.trim());
    if (description !== undefined)
      pushField("description", description?.trim() || null);
    if (price !== undefined) pushField("price", price);
    if (quantity_available !== undefined) {
      // allow explicit null to mean unlimited; 0 stays as 0; positive numbers allowed
      pushField("quantity_available", quantity_available);
    }
    if (sale_starts_at !== undefined)
      pushField("sale_starts_at", saleStart ? saleStart.toISOString() : null);
    if (sale_ends_at !== undefined)
      pushField("sale_ends_at", saleEnd ? saleEnd.toISOString() : null);
    if (max_per_person !== undefined)
      pushField("max_per_person", max_per_person);

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields provided to update" },
        { status: 400 }
      );
    }

    updateParams.push(ticketTypeId, eventId);
    const idIdx = updateParams.length - 1;
    const eventIdIdx = updateParams.length;

    // Update ticket type
    let ticketType;
    try {
      const { rows } = await query(
        `UPDATE ticket_types SET ${setClauses.join(", ")}
         WHERE id = $${idIdx} AND event_id = $${eventIdIdx}
         RETURNING ${TICKET_TYPE_COLUMNS}`,
        updateParams
      );
      if (!rows[0]) {
        return NextResponse.json(
          { success: false, error: "Ticket type not found" },
          { status: 404 }
        );
      }
      ticketType = toNumericTicketType(rows[0]);
    } catch (error) {
      console.error("Error updating ticket type:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticketType,
    });
  } catch (error) {
    console.error("Error in admin ticket PUT:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/events/[id]/tickets/[ticketId] - Delete ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ticketId: string }> }
) {
  try {
    const { id, ticketId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(id);
    const ticketTypeId = parseInt(ticketId);

    if (isNaN(eventId) || isNaN(ticketTypeId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event or ticket ID" },
        { status: 400 }
      );
    }

    // Delete ticket type (along with any associated passes and booking items)
    try {
      await query(`DELETE FROM ticket_passes WHERE ticket_type_id = $1`, [ticketTypeId]);
      await query(`DELETE FROM booking_items WHERE ticket_type_id = $1`, [ticketTypeId]);
      await query(
        `DELETE FROM ticket_types WHERE id = $1 AND event_id = $2`,
        [ticketTypeId, eventId]
      );
    } catch (error) {
      console.error("Error deleting ticket type:", error);
      const pgError = error as { code?: string; message?: string };
      console.error("Delete error details:", pgError);

      return NextResponse.json(
        { success: false, error: "Failed to delete ticket type" },
        { status: 500 }
      );
    }

    console.log(`Successfully deleted ticket type ${ticketTypeId}`);
    return NextResponse.json({
      success: true,
      message: "Ticket type deleted successfully",
    });
  } catch (error) {
    console.error("Error in admin ticket DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
