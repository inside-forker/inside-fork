
import { query } from "@/lib/db";
import { EventTicketSection } from "@/components/events/EventTicketSection";
import { Event } from "@/types/events.types";
import type { ParchiOffer } from "@/lib/parchi/discount";
import { effectiveQuantitySql } from "@/lib/ticketing/sellable-quantity";

interface EventTicketsContainerProps {
    event: Event;
    parchiOffer?: ParchiOffer | null;
}

export async function EventTicketsContainer({
    event,
    parchiOffer,
}: EventTicketsContainerProps) {
    // Same stock source as /admin/ticket-pdf-inventory: free PDF rows when
    // the tier has PDF inventory; otherwise ticket_types.quantity_available.
    const { rows } = await query(
        `SELECT tt.*,
            ${effectiveQuantitySql("tt")} AS effective_quantity_available
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
            ticket_url: row.ticket_url ? String(row.ticket_url).trim() : null,
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
