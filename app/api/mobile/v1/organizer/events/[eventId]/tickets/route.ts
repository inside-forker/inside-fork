import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError, MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Matches web's local PRIVILEGED_ROLES in
// app/api/organizer/events/[eventId]/tickets/route.ts: listers can manage
// ticket types on ANY event, not just their own - broader than
// requireMobileOrganizer's built-in admin bypass (admin/super_admin only),
// so ownership is checked manually here instead of via the `eventId` option.
// Mirrors the same pattern used by ../images/route.ts.
const PRIVILEGED_ROLES = ["admin", "super_admin", "lister"];

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

async function loadEventAndAuthorize(eventIdNum: number, userId: string, role: string) {
  const { rows: eventRows } = await query(
    `SELECT id, organizer_id FROM events WHERE id = $1`,
    [eventIdNum],
  );
  const event = eventRows[0];
  if (!event) {
    throw MobileErrors.notFound("Event not found.");
  }
  const isOwner = event.organizer_id === userId;
  const isAdmin = PRIVILEGED_ROLES.includes(role);
  let isCoOrg = false;
  if (!isOwner && !isAdmin) {
    const { rows: coRows } = await query(
      `SELECT 1 FROM public.event_co_organizers WHERE event_id = $1 AND organizer_id = $2`,
      [eventIdNum, userId]
    );
    isCoOrg = coRows.length > 0;
  }
  if (!isOwner && !isAdmin && !isCoOrg) {
    throw new MobileApiError("forbidden", "Access denied.", 403);
  }
  return event;
}

function parseEventId(eventId: string): number {
  const eventIdNum = parseInt(eventId, 10);
  if (Number.isNaN(eventIdNum)) throw MobileErrors.badRequest("Invalid event ID.");
  return eventIdNum;
}

/** GET /api/mobile/v1/organizer/events/[eventId]/tickets */
export const GET = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);
  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const { rows } = await query(
    `SELECT ${TICKET_TYPE_COLUMNS} FROM ticket_types WHERE event_id = $1 ORDER BY id ASC`,
    [eventIdNum],
  );
  return ok({ ticket_types: rows.map(toNumericTicketType) });
});

/** POST /api/mobile/v1/organizer/events/[eventId]/tickets */
export const POST = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);
  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const body = await request.json().catch(() => null);
  if (!body?.name || body.price === undefined || body.quantity_available === undefined) {
    throw MobileErrors.badRequest("name, price, and quantity_available are required.");
  }

  const price = parseFloat(body.price);
  const quantityAvailable = parseInt(body.quantity_available, 10);
  const maxPerPerson = body.max_per_person ? parseInt(body.max_per_person, 10) : 10;

  if (!Number.isFinite(price) || !Number.isFinite(quantityAvailable) || !Number.isFinite(maxPerPerson)) {
    throw MobileErrors.badRequest("Invalid numeric field value.");
  }

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
    ],
  );
  return ok(toNumericTicketType(rows[0]));
});

/** PATCH /api/mobile/v1/organizer/events/[eventId]/tickets?ticketId= */
export const PATCH = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);
  const { searchParams } = new URL(request.url);
  const ticketIdParam = searchParams.get("ticketId");
  if (!ticketIdParam) throw MobileErrors.badRequest("ticketId is required.", "ticketId");
  const ticketIdNum = parseInt(ticketIdParam, 10);
  if (Number.isNaN(ticketIdNum)) throw MobileErrors.badRequest("Invalid ticketId.", "ticketId");

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const body = await request.json().catch(() => null);
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (body?.name !== undefined) {
    params.push(body.name);
    setClauses.push(`name = $${params.length}`);
  }
  if (body?.description !== undefined) {
    params.push(body.description || null);
    setClauses.push(`description = $${params.length}`);
  }
  if (body?.price !== undefined) {
    const price = parseFloat(body.price);
    if (!Number.isFinite(price)) throw MobileErrors.badRequest("Invalid numeric field value.");
    params.push(price);
    setClauses.push(`price = $${params.length}`);
  }
  if (body?.quantity_available !== undefined) {
    const quantityAvailable = parseInt(body.quantity_available, 10);
    if (!Number.isFinite(quantityAvailable)) throw MobileErrors.badRequest("Invalid numeric field value.");
    params.push(quantityAvailable);
    setClauses.push(`quantity_available = $${params.length}`);
  }
  if (body?.sale_starts_at !== undefined) {
    params.push(body.sale_starts_at || null);
    setClauses.push(`sale_starts_at = $${params.length}`);
  }
  if (body?.sale_ends_at !== undefined) {
    params.push(body.sale_ends_at || null);
    setClauses.push(`sale_ends_at = $${params.length}`);
  }
  if (body?.max_per_person !== undefined) {
    const maxPerPerson = parseInt(body.max_per_person, 10);
    if (!Number.isFinite(maxPerPerson)) throw MobileErrors.badRequest("Invalid numeric field value.");
    params.push(maxPerPerson);
    setClauses.push(`max_per_person = $${params.length}`);
  }

  if (setClauses.length === 0) {
    throw MobileErrors.badRequest("No fields provided to update.");
  }

  params.push(ticketIdNum, eventIdNum);
  const idIdx = params.length - 1;
  const eventIdIdx = params.length;

  const { rows } = await query(
    `UPDATE ticket_types SET ${setClauses.join(", ")}
     WHERE id = $${idIdx} AND event_id = $${eventIdIdx}
     RETURNING ${TICKET_TYPE_COLUMNS}`,
    params,
  );
  if (!rows[0]) throw MobileErrors.notFound("Ticket type not found for this event.");
  return ok(toNumericTicketType(rows[0]));
});

/** DELETE /api/mobile/v1/organizer/events/[eventId]/tickets?ticketId= */
export const DELETE = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);
  const { searchParams } = new URL(request.url);
  const ticketIdParam = searchParams.get("ticketId");
  if (!ticketIdParam) throw MobileErrors.badRequest("ticketId is required.", "ticketId");
  const ticketIdNum = parseInt(ticketIdParam, 10);
  if (Number.isNaN(ticketIdNum)) throw MobileErrors.badRequest("Invalid ticketId.", "ticketId");

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  await query(`DELETE FROM ticket_passes WHERE ticket_type_id = $1`, [ticketIdNum]);
  await query(`DELETE FROM booking_items WHERE ticket_type_id = $1`, [ticketIdNum]);
  await query(`DELETE FROM ticket_types WHERE id = $1 AND event_id = $2`, [ticketIdNum, eventIdNum]);
  return ok({ message: "Ticket type deleted successfully" });
});
