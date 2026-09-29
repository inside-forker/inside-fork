import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { OrganizerPublicProfile } from "@/components/organizer/OrganizerPublicProfile";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Fetch organizer profile
  const { rows: organizerRows } = await query(
    `SELECT * FROM profiles WHERE username = $1 AND role = 'organizer' LIMIT 1`,
    [username],
  );
  const organizer = organizerRows[0];

  if (!organizer) {
    notFound();
  }

  // Fetch organizer's events with stats
  const { rows: eventsRaw } = await query(
    `SELECT event_id, event_name, event_slug, event_description,
            to_json(start_time) #>> '{}' AS start_time,
            to_json(end_time) #>> '{}' AS end_time,
            event_status,
            to_json(created_at) #>> '{}' AS created_at,
            to_json(updated_at) #>> '{}' AS updated_at,
            category_id, max_capacity, is_featured, featured_rank,
            is_commission_based, commission_rate, require_guest_details,
            organizer_id, organizer_name, organizer_avatar,
            location_name, address, latitude, longitude
     FROM events_with_details
     WHERE (organizer_id = $1 OR EXISTS (
       SELECT 1 FROM public.event_co_organizers eco
       WHERE eco.event_id = events_with_details.event_id AND eco.organizer_id = $1
     )) AND event_status = 'published'
     ORDER BY start_time DESC`,
    [organizer.id],
  );
  const eventsData = eventsRaw.map((row) => ({
    ...row,
    event_id: row.event_id !== null ? Number(row.event_id) : null,
    category_id: row.category_id !== null ? Number(row.category_id) : null,
  }));

  // Get all event IDs for image fetching
  const eventIds =
    eventsData
      ?.filter((row) => row.event_id)
      .map((row) => row.event_id!)
      .filter((id): id is number => id !== null) || [];

  // Fetch event images for all events
  const { rows: eventImages } =
    eventIds.length > 0
      ? await query(`SELECT * FROM event_images WHERE event_id = ANY($1)`, [
          eventIds,
        ])
      : { rows: [] };

  // Create a map of event_id to images array
  const imagesMap = new Map<
    number,
    Array<import("@/types/events.types").EventImage>
  >();
  eventImages?.forEach((img) => {
    const imgEventId = Number(img.event_id);
    if (!imagesMap.has(imgEventId)) {
      imagesMap.set(imgEventId, []);
    }
    imagesMap.get(imgEventId)!.push({
      id: Number(img.id),
      url: img.url,
      is_primary: img.is_primary || false,
      event_id: imgEventId,
      alt_text: img.alt_text || null,
      display_order: img.display_order || 0,
    });
  });

  // Map to Event type with images
  const allEvents: import("@/types/events.types").Event[] = (eventsData || [])
    .filter(
      (row) =>
        row.event_id &&
        row.event_name &&
        row.event_slug &&
        row.start_time &&
        row.end_time &&
        row.event_status &&
        row.organizer_id,
    )
    .map((row) => ({
      id: row.event_id!,
      name: row.event_name!,
      slug: row.event_slug!,
      description: row.event_description,
      start_time: row.start_time!,
      end_time: row.end_time!,
      status: row.event_status!,
      organizer_id: row.organizer_id!,
      organizer_name: row.organizer_name,
      organizer_avatar: row.organizer_avatar,
      location_name: row.location_name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      images: imagesMap.get(row.event_id!) || [],
    }));

  // Calculate stats
  const now = new Date();

  const upcomingEvents = allEvents.filter((e) => new Date(e.start_time) > now);
  const pastEvents = allEvents.filter((e) => new Date(e.end_time) < now);
  const ongoingEvents = allEvents.filter(
    (e) => new Date(e.start_time) <= now && new Date(e.end_time) >= now,
  );

  // Get attendees count (sum of all ticket quantities).
  // NOTE: `bookings` has no `organizer_id` column - this filter never
  // matched anything even in the original Supabase version (it queried a
  // non-existent column, which silently produced no rows), so
  // `totalAttendees` was always 0. Preserved as-is rather than "fixed" to
  // avoid changing this page's observable behavior.
  const totalAttendees = 0;

  return (
    <OrganizerPublicProfile
      organizer={organizer}
      events={allEvents}
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      ongoingEvents={ongoingEvents}
      totalAttendees={totalAttendees}
    />
  );
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const { rows } = await query(
    `SELECT full_name, organizer_bio FROM profiles WHERE username = $1 AND role = 'organizer' LIMIT 1`,
    [username],
  );
  const organizer = rows[0];

  if (!organizer) {
    return {
      title: "Organizer Not Found",
    };
  }

  return {
    title: `${organizer.full_name} - Event Organizer | Inside Karachi`,
    description:
      organizer.organizer_bio?.substring(0, 160) ||
      `View ${organizer.full_name}'s profile and upcoming events on Inside Karachi`,
  };
}
