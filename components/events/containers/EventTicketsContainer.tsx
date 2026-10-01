
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
    const { rows } = await query(
        `SELECT * FROM ticket_types WHERE event_id = $1 ORDER BY price ASC`,
        [event.id],
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    // node-pg returns bigint/numeric columns as strings; the UI does strict
    // (===) comparisons against parsed numbers, so these must be normalized.
    const ticketTypes = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: Number(row.event_id),
        price: row.price !== null ? Number(row.price) : 0,
        quantity_available:
            row.quantity_available !== null ? Number(row.quantity_available) : null,
        max_per_person:
            row.max_per_person !== null ? Number(row.max_per_person) : null,
    }));

    return (
        <EventTicketSection
            event={event}
            ticketTypes={ticketTypes}
            parchiOffer={parchiOffer}
        />
    );
}
