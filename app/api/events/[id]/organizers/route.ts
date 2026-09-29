import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const eventIdParam = params.id;
    const eventIdNum = parseInt(eventIdParam, 10);

    let eventRow: { id: number; organizer_id: string | null } | undefined;

    if (!isNaN(eventIdNum)) {
      const { rows } = await query(
        `SELECT id, organizer_id FROM events WHERE id = $1 LIMIT 1`,
        [eventIdNum]
      );
      eventRow = rows[0] ? { id: Number(rows[0].id), organizer_id: rows[0].organizer_id } : undefined;
    } else {
      const { rows } = await query(
        `SELECT id, organizer_id FROM events WHERE slug = $1 LIMIT 1`,
        [eventIdParam]
      );
      eventRow = rows[0] ? { id: Number(rows[0].id), organizer_id: rows[0].organizer_id } : undefined;
    }

    if (!eventRow) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const eventId = eventRow.id;
    const organizerIds: string[] = [];
    if (eventRow.organizer_id) {
      organizerIds.push(String(eventRow.organizer_id));
    }

    // Fetch co-organizers from junction table
    const { rows: coOrgRows } = await query(
      `SELECT organizer_id FROM public.event_co_organizers WHERE event_id = $1`,
      [eventId]
    );

    for (const row of coOrgRows) {
      const orgId = String(row.organizer_id);
      if (!organizerIds.includes(orgId)) {
        organizerIds.push(orgId);
      }
    }

    if (organizerIds.length === 0) {
      return NextResponse.json({ success: true, organizers: [] });
    }

    // Fetch all organizer profiles
    const { rows: profileRows } = await query(
      `SELECT id, full_name, avatar_url, username, phone, role, is_verified_organizer,
              organizer_bio, organizer_company, organizer_website
       FROM profiles WHERE id = ANY($1::uuid[])`,
      [organizerIds]
    );

    const now = new Date();

    // Fetch stats and recent events for each organizer in parallel
    const organizers = await Promise.all(
      profileRows.map(async (organizer) => {
        const orgId = organizer.id;

        // Fetch events for stats
        const { rows: eventRows } = await query(
          `SELECT id, name, slug,
             to_json(start_time) #>> '{}' AS start_time,
             to_json(end_time) #>> '{}' AS end_time,
             status
           FROM events
           WHERE (organizer_id = $1 OR EXISTS (
             SELECT 1 FROM public.event_co_organizers eco
             WHERE eco.event_id = events.id AND eco.organizer_id = $1
           )) AND status = 'published'
           ORDER BY start_time DESC`,
          [orgId]
        );

        const allEvents = eventRows.map((r) => ({
          id: Number(r.id),
          name: r.name,
          slug: r.slug,
          start_time: r.start_time,
          end_time: r.end_time,
          status: r.status,
        }));

        const eventsOrganized = allEvents.length;
        const recentEvents = allEvents.slice(0, 3);
        const upcomingEvents = allEvents.filter((e) => new Date(e.start_time) > now).length;

        // Fetch total attendees
        let totalAttendees = 0;
        try {
          const { rows: attendeeRows } = await query(
            `SELECT COALESCE(SUM(bi.quantity), 0) AS total_attendees
             FROM bookings b
             JOIN booking_items bi ON bi.booking_id = b.id
             JOIN events e ON e.id = b.event_id
             WHERE (e.organizer_id = $1 OR EXISTS (
               SELECT 1 FROM public.event_co_organizers eco
               WHERE eco.event_id = e.id AND eco.organizer_id = $1
             )) AND b.status = 'completed'`,
            [orgId]
          );
          totalAttendees = parseInt(attendeeRows[0]?.total_attendees || "0", 10);
        } catch {
          totalAttendees = 0;
        }

        return {
          id: organizer.id,
          full_name: organizer.full_name,
          avatar_url: organizer.avatar_url,
          username: organizer.username,
          phone: organizer.phone,
          role: organizer.role,
          isVerified: organizer.is_verified_organizer,
          bio: organizer.organizer_bio,
          company: organizer.organizer_company,
          website: organizer.organizer_website,
          stats: {
            eventsOrganized,
            totalAttendees,
            upcomingEvents,
          },
          recentEvents,
        };
      })
    );

    return NextResponse.json({
      success: true,
      organizers,
    });
  } catch (error) {
    console.error("Error fetching event organizers:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
