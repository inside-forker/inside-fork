import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Force dynamic to ensure fresh ticket data
export const dynamic = "force-dynamic";

const PRIVILEGED_ROLES = ["admin", "super_admin", "lister"];

const TICKET_TYPE_COLUMNS =
  "id, event_id, name, description, price, quantity_available, " +
  "to_json(sale_starts_at) #>> '{}' AS sale_starts_at, " +
  "to_json(sale_ends_at) #>> '{}' AS sale_ends_at, " +
  "max_per_person";

function toNumericTicketType<T extends { id: unknown; event_id: unknown; price: unknown }>(
  row: T
) {
  return {
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
    price: row.price !== null ? Number(row.price) : null,
  };
}

async function verifyEventAccess(userId: string, eventIdNum: number) {
  const { rows: profileRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [userId]
  );
  const profile = profileRows[0];

  if (!profile) {
    return { error: "Profile not found", status: 404 } as const;
  }

  const { rows: eventRows } = await query(
    `SELECT id, organizer_id FROM events WHERE id = $1`,
    [eventIdNum]
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
      [eventIdNum, userId]
    );
    isCoOrg = coRows.length > 0;
  }

  if (!isOwner && !isAdmin && !isCoOrg) {
    return { error: "Access denied", status: 403 } as const;
  }

  return { ok: true } as const;
}

// GET /api/organizer/events/[eventId]/tickets - Get tickets for an event owned by the organizer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);

    const access = await verifyEventAccess(session.userId, eventIdNum);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Fetch ticket types
    let ticketTypes;
    try {
      const { rows } = await query(
        `SELECT ${TICKET_TYPE_COLUMNS} FROM ticket_types WHERE event_id = $1 ORDER BY id ASC`,
        [eventIdNum]
      );
      ticketTypes = rows.map(toNumericTicketType);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket_types: ticketTypes || [],
      },
    });
  } catch (error) {
    console.error("Error in organizer tickets GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizer/events/[eventId]/tickets - Create a new ticket type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const eventIdNum = parseInt(eventId, 10);

    const access = await verifyEventAccess(session.userId, eventIdNum);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Validate required fields
    if (
      !body.name ||
      body.price === undefined ||
      body.quantity_available === undefined
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const price = parseFloat(body.price);
    const quantityAvailable = parseInt(body.quantity_available, 10);
    const maxPerPerson = body.max_per_person
      ? parseInt(body.max_per_person, 10)
      : 10;

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(quantityAvailable) ||
      !Number.isFinite(maxPerPerson)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid numeric field value" },
        { status: 400 }
      );
    }

    // Create ticket type
    let ticketType;
    try {
      const { rows } = await query(
        `INSERT INTO ticket_types (event_id, name, description, price, quantity_available, sale_starts_at, sale_ends_at, max_per_person)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${TICKET_TYPE_COLUMNS}`,
        [
          eventIdNum,
          body.name,
          body.description || null,
          price,
          quantityAvailable,
          body.sale_starts_at || null,
          body.sale_ends_at || null,
          maxPerPerson,
        ]
      );
      ticketType = toNumericTicketType(rows[0]);
    } catch (error) {
      console.error("Error creating ticket:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: ticketType,
    });
  } catch (error) {
    console.error("Error in organizer tickets POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizer/events/[eventId]/tickets - Update a ticket type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");
    const body = await request.json();

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "Ticket ID is required" },
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

    const eventIdNum = parseInt(eventId, 10);
    const ticketIdNum = parseInt(ticketId, 10);

    const access = await verifyEventAccess(session.userId, eventIdNum);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Build update
    const setClauses: string[] = [];
    const updateParams: unknown[] = [];

    if (body.name !== undefined) {
      updateParams.push(body.name);
      setClauses.push(`name = $${updateParams.length}`);
    }
    if (body.description !== undefined) {
      updateParams.push(body.description || null);
      setClauses.push(`description = $${updateParams.length}`);
    }
    if (body.price !== undefined) {
      const price = parseFloat(body.price);
      if (!Number.isFinite(price)) {
        return NextResponse.json(
          { success: false, error: "Invalid numeric field value" },
          { status: 400 }
        );
      }
      updateParams.push(price);
      setClauses.push(`price = $${updateParams.length}`);
    }
    if (body.quantity_available !== undefined) {
      const quantityAvailable = parseInt(body.quantity_available, 10);
      if (!Number.isFinite(quantityAvailable)) {
        return NextResponse.json(
          { success: false, error: "Invalid numeric field value" },
          { status: 400 }
        );
      }
      updateParams.push(quantityAvailable);
      setClauses.push(`quantity_available = $${updateParams.length}`);
    }
    if (body.sale_starts_at !== undefined) {
      updateParams.push(body.sale_starts_at || null);
      setClauses.push(`sale_starts_at = $${updateParams.length}`);
    }
    if (body.sale_ends_at !== undefined) {
      updateParams.push(body.sale_ends_at || null);
      setClauses.push(`sale_ends_at = $${updateParams.length}`);
    }
    if (body.max_per_person !== undefined) {
      const maxPerPerson = parseInt(body.max_per_person, 10);
      if (!Number.isFinite(maxPerPerson)) {
        return NextResponse.json(
          { success: false, error: "Invalid numeric field value" },
          { status: 400 }
        );
      }
      updateParams.push(maxPerPerson);
      setClauses.push(`max_per_person = $${updateParams.length}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields provided to update" },
        { status: 400 }
      );
    }

    updateParams.push(ticketIdNum, eventIdNum);
    const idIdx = updateParams.length - 1;
    const eventIdIdx = updateParams.length;

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
          { success: false, error: "Ticket type not found for this event" },
          { status: 404 }
        );
      }
      ticketType = toNumericTicketType(rows[0]);
    } catch (error) {
      console.error("Error updating ticket:", error);
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
    console.error("Error in organizer tickets PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizer/events/[eventId]/tickets - Delete a ticket type
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "Ticket ID is required" },
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

    const eventIdNum = parseInt(eventId, 10);
    const ticketIdNum = parseInt(ticketId, 10);

    const access = await verifyEventAccess(session.userId, eventIdNum);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Check if ticket has any bookings
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM booking_items WHERE ticket_type_id = $1`,
      [ticketIdNum]
    );
    const bookingCount = parseInt(countRows[0].count, 10);

    if (bookingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete ticket type with existing bookings",
        },
        { status: 400 }
      );
    }

    try {
      await query(
        `DELETE FROM ticket_types WHERE id = $1 AND event_id = $2`,
        [ticketIdNum, eventIdNum]
      );
    } catch (error) {
      console.error("Error deleting ticket:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete ticket type" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ticket type deleted successfully",
    });
  } catch (error) {
    console.error("Error in organizer tickets DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
