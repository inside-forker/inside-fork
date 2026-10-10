import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

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
 * GET /api/organizer/events/[eventId]/ticket-pdf-inventory
 * Tier summaries + inventory rows (metadata only — no download URLs / storage keys).
 */
export async function GET(
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

    const { rows: tickets } = await query(
      `SELECT
         i.id,
         i.external_ticket_id,
         i.original_filename,
         i.ticket_type_id,
         i.booking_id,
         i.assigned_at,
         i.created_at,
         tt.name AS ticket_type_name,
         tt.price AS ticket_type_price
       FROM ticket_pdf_inventory i
       INNER JOIN ticket_types tt ON tt.id = i.ticket_type_id
       WHERE tt.event_id = $1
       ORDER BY i.ticket_type_id ASC, i.id ASC`,
      [eventIdNum],
    );

    type TierAgg = {
      ticket_type_id: number;
      ticket_type_name: string;
      price: number;
      total: number;
      sold: number;
      available: number;
    };

    const tierMap = new Map<number, TierAgg>();
    const mappedTickets = tickets.map((row) => {
      const ticketTypeId = Number(row.ticket_type_id);
      const sold = row.booking_id != null;
      const existing = tierMap.get(ticketTypeId);
      if (existing) {
        existing.total += 1;
        if (sold) existing.sold += 1;
        else existing.available += 1;
      } else {
        tierMap.set(ticketTypeId, {
          ticket_type_id: ticketTypeId,
          ticket_type_name: String(row.ticket_type_name ?? ""),
          price: Number(row.ticket_type_price ?? 0),
          total: 1,
          sold: sold ? 1 : 0,
          available: sold ? 0 : 1,
        });
      }

      return {
        id: Number(row.id),
        external_ticket_id: String(row.external_ticket_id),
        original_filename: (row.original_filename as string | null) ?? null,
        ticket_type_id: ticketTypeId,
        ticket_type_name: String(row.ticket_type_name ?? ""),
        status: sold ? ("sold" as const) : ("available" as const),
        booking_id: row.booking_id != null ? Number(row.booking_id) : null,
        assigned_at: row.assigned_at
          ? new Date(row.assigned_at as string | Date).toISOString()
          : null,
        created_at: new Date(row.created_at as string | Date).toISOString(),
      };
    });

    const tiers = [...tierMap.values()];
    const summary = {
      total: mappedTickets.length,
      sold: mappedTickets.filter((t) => t.status === "sold").length,
      available: mappedTickets.filter((t) => t.status === "available").length,
    };

    return NextResponse.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        summary,
        tiers,
        tickets: mappedTickets,
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/organizer/events/[eventId]/ticket-pdf-inventory",
      method: "GET",
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
