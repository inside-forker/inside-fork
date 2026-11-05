import { query } from "@/lib/db";
import type { TicketType } from "@/types/events.types";
import { studentPriceSql } from "@/lib/parchi/discount";
import { effectiveQuantitySql } from "@/lib/ticketing/sellable-quantity";

/** An event's ticket tiers, in display order, with numbers normalised. */
export async function getEventTicketTypes(eventId: number): Promise<TicketType[]> {
  // Same stock source as /admin/ticket-pdf-inventory: free PDF rows when
  // the tier has PDF inventory; otherwise ticket_types.quantity_available.
  const { rows } = await query(
    `SELECT tt.*,
        ${effectiveQuantitySql("tt")} AS effective_quantity_available,
        ${studentPriceSql()} AS student_price
     FROM ticket_types tt
     JOIN events e ON e.id = tt.event_id
     WHERE tt.event_id = $1
     ORDER BY tt.group_order ASC NULLS LAST, tt.group_name ASC NULLS LAST, tt.price ASC`,
    [eventId],
  );

  // node-pg returns bigint/numeric columns as strings; the UI does strict
  // (===) comparisons against parsed numbers, so these must be normalized.
  return (rows || []).map((row) => {
    const effective =
      row.effective_quantity_available !== undefined
        ? row.effective_quantity_available
        : row.quantity_available;
    return {
      ...row,
      id: Number(row.id),
      event_id: Number(row.event_id),
      price: row.price !== null ? Number(row.price) : 0,
      quantity_available:
        effective !== null && effective !== undefined ? Number(effective) : null,
      max_per_person: row.max_per_person !== null ? Number(row.max_per_person) : null,
      ticket_url: row.ticket_url ? String(row.ticket_url).trim() : null,
      group_name: row.group_name ? String(row.group_name).trim() : null,
      group_order:
        row.group_order !== null && row.group_order !== undefined ? Number(row.group_order) : 0,
      original_price: row.original_price != null ? Number(row.original_price) : null,
      // Effective student price (event % or the tier's own); null when the
      // event's Parchi toggle is off.
      parchi_price: row.student_price != null ? Number(row.student_price) : null,
      parchi_original_price:
        row.parchi_original_price != null ? Number(row.parchi_original_price) : null,
    } as TicketType;
  });
}
