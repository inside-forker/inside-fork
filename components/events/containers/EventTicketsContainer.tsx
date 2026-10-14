
import { query } from "@/lib/db";
import { EventTicketSection } from "@/components/events/EventTicketSection";
import { Event } from "@/types/events.types";
import type { ParchiOffer } from "@/lib/parchi/discount";

interface EventTicketsContainerProps {
    event: Event;
    parchiOffer?: ParchiOffer | null;
}

export async function EventTicketsContainer({
    event,
    parchiOffer,
}: EventTicketsContainerProps) {
    // Prefer unassigned PDF inventory count when a tier has PDF rows, so the
    // public page cannot show Sold Out while Ticketwala PDFs remain free.
    const { rows } = await query(
        `SELECT tt.*,
            CASE
              WHEN EXISTS (
                SELECT 1 FROM ticket_pdf_inventory i
                WHERE i.ticket_type_id = tt.id
              ) THEN (
                SELECT COUNT(*)::int FROM ticket_pdf_inventory i
                WHERE i.ticket_type_id = tt.id AND i.booking_id IS NULL
              )
              ELSE tt.quantity_available
            END AS effective_quantity_available
         FROM ticket_types tt
         WHERE tt.event_id = $1
         ORDER BY tt.price ASC`,
        [event.id],
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    // node-pg returns bigint/numeric columns as strings; the UI does strict
    // (===) comparisons against parsed numbers, so these must be normalized.
    const ticketTypes = rows.map((row) => {
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
                effective !== null && effective !== undefined
                    ? Number(effective)
                    : null,
            max_per_person:
                row.max_per_person !== null ? Number(row.max_per_person) : null,
        };
    });

    return (
        <EventTicketSection
            event={event}
            ticketTypes={ticketTypes}
            parchiOffer={parchiOffer}
        />
    );
}
