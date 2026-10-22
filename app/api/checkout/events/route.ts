import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  mergeAttendeeFields,
  normalizeMinPeople,
  normalizePeoplePerTicket,
} from "@/lib/ticketing/attendee-fields";

// Public, read-only lookup of a small set of event fields for the checkout
// page: what its ticket card shows (name, when, where, poster) and whether
// guest details are required. No login required - mirrors the old client-side
// Supabase `.from("events").select("id, require_guest_details").in("id", ids)`
// call, which had no ownership scoping either.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return NextResponse.json({ events: [] });
    }

    const ids = idsParam
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));

    if (ids.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const { rows } = await query(
      `SELECT e.id, e.require_guest_details, e.name, e.slug, e.start_time, e.location_name,
              (SELECT i.url FROM event_images i
               WHERE i.event_id = e.id
               ORDER BY i.is_primary DESC NULLS LAST, i.display_order ASC NULLS LAST
               LIMIT 1) AS image_url
       FROM events e WHERE e.id = ANY($1)`,
      [ids],
    );

    // Group size + checkout questions per ticket type (event-wide fields
    // merged with each tier's own).
    const { rows: ticketRows } = await query(
      `SELECT tt.id, tt.event_id, tt.people_per_ticket, tt.min_people_per_ticket,
              tt.attendee_fields,
              e.attendee_fields AS event_attendee_fields
       FROM ticket_types tt JOIN events e ON e.id = tt.event_id
       WHERE tt.event_id = ANY($1)`,
      [ids],
    );

    const events = rows.map((row) => ({
      id: Number(row.id),
      require_guest_details: row.require_guest_details,
      name: row.name as string,
      slug: (row.slug as string | null) ?? null,
      start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
      location_name: (row.location_name as string | null) ?? null,
      image_url: (row.image_url as string | null) ?? null,
      ticket_types: ticketRows
        .filter((t) => Number(t.event_id) === Number(row.id))
        .map((t) => ({
          id: Number(t.id),
          people_per_ticket: normalizePeoplePerTicket(t.people_per_ticket),
          min_people_per_ticket: normalizeMinPeople(
            t.min_people_per_ticket,
            normalizePeoplePerTicket(t.people_per_ticket),
          ),
          attendee_fields: mergeAttendeeFields(
            t.event_attendee_fields,
            t.attendee_fields,
          ),
        })),
    }));

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Checkout events API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
