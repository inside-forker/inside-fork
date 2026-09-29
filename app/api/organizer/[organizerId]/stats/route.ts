import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

// GET /api/organizer/[organizerId]/stats - Get organizer stats and recent events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizerId: string }> },
) {
  try {
    const { organizerId } = await params;

    // Fetch organizer profile. The old Supabase call surfaced any query
    // error (including a malformed id) as data, uniformly mapped to a 404
    // below - a malformed organizerId here would otherwise throw an
    // "invalid input syntax for type uuid" that reaches the outer catch
    // and returns a 500 on this fully public, unauthenticated route.
    let organizer;
    try {
      const { rows: organizerRows } = await query(
        `SELECT id, full_name, avatar_url, username, phone, role, is_verified_organizer, organizer_bio, organizer_company, organizer_website
         FROM profiles WHERE id = $1`,
        [organizerId]
      );
      organizer = organizerRows[0];
    } catch (error) {
      console.error("Error fetching organizer profile:", error);
      organizer = undefined;
    }

    if (!organizer) {
      return NextResponse.json(
        { success: false, error: "Organizer not found" },
        { status: 404 },
      );
    }

    // Get all events by organizer
    let allEvents: {
      id: number;
      name: string;
      slug: string;
      start_time: string;
      end_time: string;
      status: string;
    }[] = [];
    try {
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
        [organizerId]
      );
      allEvents = eventRows.map((row) => ({ ...row, id: Number(row.id) }));
    } catch (error) {
      console.error("Error fetching events:", error);
    }

    const eventsOrganized = allEvents.length;

    // Get recent 3 events (already sorted by start_time descending)
    // This includes both ongoing and past events
    const recentEvents = allEvents.slice(0, 3);

    // Get total attendees (sum of booking item quantities). The old
    // Supabase version filtered bookings by a bookings.organizer_id column
    // that doesn't exist (only events.organizer_id does), so it always
    // silently failed and showed 0 - fixed here to join through events.
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
        [organizerId]
      );
      totalAttendees = parseInt(attendeeRows[0].total_attendees, 10);
    } catch (error) {
      console.error("Error fetching attendee count:", error);
    }

    // Events are self-contained and carry no reviews, so there is no organizer
    // rating. Surface a real metric instead: count of upcoming events.
    const now = new Date();
    const upcomingEvents = allEvents.filter(
      (e) => new Date(e.start_time) > now,
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        organizer: {
          id: organizer.id,
          full_name: organizer.full_name,
          avatar_url: organizer.avatar_url,
          username: organizer.username,
          phone: organizer.phone,
          role: organizer.role,
          isVerified: organizer.is_verified_organizer || false,
          bio: organizer.organizer_bio,
          company: organizer.organizer_company,
          website: organizer.organizer_website,
        },
        stats: {
          eventsOrganized,
          totalAttendees,
          upcomingEvents,
        },
        recentEvents: recentEvents.map((e) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          start_time: e.start_time,
          end_time: e.end_time,
        })),
      },
    });
  } catch (error) {
    console.error("Error in organizer stats GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
