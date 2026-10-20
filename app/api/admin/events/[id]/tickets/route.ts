import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// Force dynamic to ensure fresh ticket data
export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

const TICKET_TYPE_COLUMNS =
  "id, event_id, name, description, price, quantity_available, " +
  "to_json(sale_starts_at) #>> '{}' AS sale_starts_at, " +
  "to_json(sale_ends_at) #>> '{}' AS sale_ends_at, " +
  "max_per_person, ticket_url";

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
    return { error: "Access denied", status: 403 } as const;
  }
  return { ok: true } as const;
}

// GET /api/admin/events/[id]/tickets - Get all ticket types for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists and user has access
    const { rows: eventRows } = await query(
      `SELECT id, organizer_id FROM events WHERE id = $1`,
      [eventId]
    );
    if (!eventRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Get ticket types for the event
    let ticketTypes;
    try {
      const { rows } = await query(
        // ORDER BY references the underlying table column explicitly (not
        // the output alias) - Postgres prefers a same-named SELECT-list
        // alias over the input column for simple ORDER BY names, which
        // would otherwise sort by the to_json-rendered text instead of the
        // real timestamptz value.
        `SELECT ${TICKET_TYPE_COLUMNS} FROM ticket_types t WHERE t.event_id = $1 ORDER BY t.sale_starts_at ASC`,
        [eventId]
      );
      ticketTypes = rows.map(toNumericTicketType);
    } catch (error) {
      console.error("Error fetching ticket types:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch ticket types" },
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
    console.error("Error in admin tickets GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/events/[id]/tickets - Create new ticket type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists
    const { rows: eventRows } = await query(
      `SELECT id, organizer_id, start_time, end_time FROM events WHERE id = $1`,
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
      ticket_url,
    } = body;

    // Validation
    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Ticket name is required" },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price < 0) {
      return NextResponse.json(
        { success: false, error: "Valid price is required" },
        { status: 400 }
      );
    }

    if (!sale_starts_at || !sale_ends_at) {
      return NextResponse.json(
        { success: false, error: "Sale start and end dates are required" },
        { status: 400 }
      );
    }

    const saleStart = new Date(sale_starts_at);
    const saleEnd = new Date(sale_ends_at);

    // For new tickets, be more flexible with sale timing
    // Allow sales to continue during the event for last-minute purchases
    // Only prevent obviously invalid scenarios
    if (saleStart >= saleEnd) {
      return NextResponse.json(
        { success: false, error: "Sale end date must be after start date" },
        { status: 400 }
      );
    }

    // Allow sale periods to be flexible - don't enforce strict timing rules
    // Event organizers should have control over their ticket sales strategy

    if (
      quantity_available !== null &&
      quantity_available !== undefined &&
      quantity_available < 0
    ) {
      return NextResponse.json(
        { success: false, error: "Quantity available cannot be negative" },
        { status: 400 }
      );
    }

    if (
      max_per_person !== null &&
      max_per_person !== undefined &&
      max_per_person < 1
    ) {
      return NextResponse.json(
        { success: false, error: "Max per person must be at least 1" },
        { status: 400 }
      );
    }

    // Create ticket type
    // Normalize nullable numeric fields: empty => null, keep 0 as 0
    const normalizedQuantity =
      quantity_available === undefined || quantity_available === ""
        ? null
        : quantity_available;
    const normalizedMaxPerPerson =
      max_per_person === undefined || max_per_person === ""
        ? 10
        : max_per_person;

    let ticketType;
    try {
      const { rows } = await query(
        `INSERT INTO ticket_types (event_id, name, description, price, quantity_available, sale_starts_at, sale_ends_at, max_per_person, ticket_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${TICKET_TYPE_COLUMNS}`,
        [
          eventId,
          name.trim(),
          description?.trim() || null,
          price,
          normalizedQuantity,
          saleStart.toISOString(),
          saleEnd.toISOString(),
          normalizedMaxPerPerson,
          ticket_url ? String(ticket_url).trim() || null : null,
        ]
      );
      ticketType = toNumericTicketType(rows[0]);
    } catch (error) {
      console.error("Error creating ticket type:", error);
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
    console.error("Error in admin tickets POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
