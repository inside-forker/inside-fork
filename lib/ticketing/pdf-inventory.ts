import { pool, query } from "@/lib/db";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export type AssignedPdfTicket = {
  id: number;
  ticket_type_id: number;
  ticket_type_name: string | null;
  external_ticket_id: string;
  storage_key: string;
  original_filename: string | null;
  booking_id: number;
  assigned_at: string;
};

/**
 * Ticket types that have at least one inventory row (assigned or not).
 * Used to skip IK pass generation for those line items.
 */
export async function getPdfInventoryTicketTypeIds(
  ticketTypeIds: number[],
): Promise<Set<number>> {
  const ids = [
    ...new Set(
      ticketTypeIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (ids.length === 0) return new Set();

  const { rows } = await query<{ ticket_type_id: number | string }>(
    `SELECT DISTINCT ticket_type_id
     FROM ticket_pdf_inventory
     WHERE ticket_type_id = ANY($1::bigint[])`,
    [ids],
  );
  return new Set(rows.map((r) => Number(r.ticket_type_id)));
}

export async function listAssignedPdfTickets(
  bookingId: number,
): Promise<AssignedPdfTicket[]> {
  const { rows } = await query(
    `SELECT i.id, i.ticket_type_id, tt.name AS ticket_type_name,
            i.external_ticket_id, i.storage_key, i.original_filename,
            i.booking_id, i.assigned_at
     FROM ticket_pdf_inventory i
     LEFT JOIN ticket_types tt ON tt.id = i.ticket_type_id
     WHERE i.booking_id = $1
     ORDER BY i.assigned_at ASC, i.id ASC`,
    [bookingId],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    ticket_type_id: Number(row.ticket_type_id),
    ticket_type_name: (row.ticket_type_name as string | null) ?? null,
    external_ticket_id: String(row.external_ticket_id),
    storage_key: String(row.storage_key),
    original_filename: (row.original_filename as string | null) ?? null,
    booking_id: Number(row.booking_id),
    assigned_at: new Date(row.assigned_at as string | Date).toISOString(),
  }));
}

export async function listAssignedPdfTicketsForBookings(
  bookingIds: number[],
): Promise<Map<number, AssignedPdfTicket[]>> {
  const map = new Map<number, AssignedPdfTicket[]>();
  const ids = bookingIds.filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return map;

  const { rows } = await query(
    `SELECT i.id, i.ticket_type_id, tt.name AS ticket_type_name,
            i.external_ticket_id, i.storage_key, i.original_filename,
            i.booking_id, i.assigned_at
     FROM ticket_pdf_inventory i
     LEFT JOIN ticket_types tt ON tt.id = i.ticket_type_id
     WHERE i.booking_id = ANY($1::bigint[])
     ORDER BY i.assigned_at ASC, i.id ASC`,
    [ids],
  );

  for (const row of rows) {
    const bookingId = Number(row.booking_id);
    const list = map.get(bookingId) ?? [];
    list.push({
      id: Number(row.id),
      ticket_type_id: Number(row.ticket_type_id),
      ticket_type_name: (row.ticket_type_name as string | null) ?? null,
      external_ticket_id: String(row.external_ticket_id),
      storage_key: String(row.storage_key),
      original_filename: (row.original_filename as string | null) ?? null,
      booking_id: bookingId,
      assigned_at: new Date(row.assigned_at as string | Date).toISOString(),
    });
    map.set(bookingId, list);
  }
  return map;
}

/**
 * Atomically assign one unassigned PDF per seat for booking line items that
 * use PDF inventory. Removes any IK ticket_passes for those ticket types so
 * buyers only receive the organizer PDF.
 *
 * Idempotent: already-assigned rows for the booking are counted toward qty.
 */
export async function assignPdfInventoryForBooking(
  bookingId: number,
  route = "pdf-inventory",
): Promise<number> {
  const client = await pool.connect();
  let assignedNow = 0;

  try {
    await client.query("BEGIN");

    const { rows: items } = await client.query<{
      ticket_type_id: number | string;
      quantity: number | string;
    }>(
      `SELECT bi.ticket_type_id, bi.quantity
       FROM booking_items bi
       WHERE bi.booking_id = $1
         AND EXISTS (
           SELECT 1 FROM ticket_pdf_inventory i
           WHERE i.ticket_type_id = bi.ticket_type_id
         )
       ORDER BY bi.ticket_type_id ASC
       FOR UPDATE OF bi`,
      [bookingId],
    );

    if (items.length === 0) {
      await client.query("COMMIT");
      return 0;
    }

    const pdfTypeIds = items.map((item) => Number(item.ticket_type_id));

    for (const item of items) {
      const ticketTypeId = Number(item.ticket_type_id);
      const quantity = Number(item.quantity);

      const { rows: alreadyRows } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM ticket_pdf_inventory
         WHERE booking_id = $1 AND ticket_type_id = $2`,
        [bookingId, ticketTypeId],
      );
      const already = Number(alreadyRows[0]?.count ?? 0);
      const need = Math.max(0, quantity - already);

      for (let i = 0; i < need; i++) {
        const { rows: claimed } = await client.query(
          `UPDATE ticket_pdf_inventory
           SET booking_id = $1,
               assigned_at = now()
           WHERE id = (
             SELECT id FROM ticket_pdf_inventory
             WHERE ticket_type_id = $2
               AND booking_id IS NULL
             ORDER BY id ASC
             FOR UPDATE SKIP LOCKED
             LIMIT 1
           )
           RETURNING id, external_ticket_id`,
          [bookingId, ticketTypeId],
        );

        if (!claimed[0]) {
          throw new Error(
            `PDF inventory exhausted for ticket_type_id=${ticketTypeId} on booking=${bookingId}`,
          );
        }
        assignedNow += 1;
      }
    }

    // Drop IK passes for PDF-inventory tiers (early create / admin RPC may have made them).
    await client.query(
      `DELETE FROM ticket_passes
       WHERE booking_id = $1
         AND ticket_type_id = ANY($2::bigint[])`,
      [bookingId, pdfTypeIds],
    );

    await client.query("COMMIT");
    return assignedNow;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    captureRouteError(error, {
      route,
      method: "POST",
      extra: { stage: "assign_pdf_inventory", bookingId },
    });
    throw error;
  } finally {
    client.release();
  }
}

/** Public DTO for APIs / dashboard (no storage_key). */
export function toPublicPdfTicket(row: AssignedPdfTicket) {
  return {
    id: row.id,
    booking_id: row.booking_id,
    ticket_type_id: row.ticket_type_id,
    ticket_type_name: row.ticket_type_name,
    external_ticket_id: row.external_ticket_id,
    original_filename: row.original_filename,
    assigned_at: row.assigned_at,
    download_path: `/api/bookings/${row.booking_id}/ticket-pdfs/${row.id}`,
  };
}
