/**
 * Sellable stock for the public site must match /admin/ticket-pdf-inventory.
 *
 * Product rule: unpaid / awaiting_payment bookings do NOT reduce sellable
 * quantity. Only paid assignment (PDF row gets booking_id) does. Never subtract
 * unpaid reservations from this count — that would soft-hold the shelf.
 *
 * Admin "available" = rows in ticket_pdf_inventory with booking_id IS NULL.
 * When a ticket type has any PDF inventory rows, that count is the truth —
 * not ticket_types.quantity_available (which can drift to 0 and false Sold Out).
 *
 * Non-PDF tiers still use ticket_types.quantity_available (null = unlimited).
 *
 * Pricing / Parchi / open-student discount paths are unrelated — do not gate
 * discounts on this helper.
 */
import { query } from "@/lib/db";
import { syncTicketTypeQuantityAvailable } from "@/lib/ticketing/pdf-inventory-upload";

/** SQL expression; `alias` is the ticket_types table/alias in the outer query. */
export function effectiveQuantitySql(alias = "tt"): string {
  // Free PDFs only — intentionally ignores unpaid booking_items.
  return `CASE
    WHEN EXISTS (
      SELECT 1 FROM ticket_pdf_inventory i
      WHERE i.ticket_type_id = ${alias}.id
    ) THEN (
      SELECT COUNT(*)::int FROM ticket_pdf_inventory i
      WHERE i.ticket_type_id = ${alias}.id AND i.booking_id IS NULL
    )
    ELSE ${alias}.quantity_available
  END`;
}

/**
 * Before create_booking_atomic (which still decrements quantity_available on
 * unpaid create), reset quantity_available from free PDFs so an unpaid hold
 * cannot fake Sold Out for the next shopper. Stock drops for real only when
 * payment assigns a PDF (booking_id set). Does not touch prices or discounts.
 */
export async function syncPdfStockForTicketTypes(
  ticketTypeIds: number[],
): Promise<void> {
  const ids = [
    ...new Set(
      ticketTypeIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  if (ids.length === 0) return;

  const { rows } = await query<{ id: number | string }>(
    `SELECT DISTINCT tt.id
     FROM ticket_types tt
     WHERE tt.id = ANY($1::bigint[])
       AND EXISTS (
         SELECT 1 FROM ticket_pdf_inventory i
         WHERE i.ticket_type_id = tt.id
       )`,
    [ids],
  );

  for (const row of rows) {
    await syncTicketTypeQuantityAvailable(Number(row.id));
  }
}
