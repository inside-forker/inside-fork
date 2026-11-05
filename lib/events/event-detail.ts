import { query } from "@/lib/db";
import type { Event, EventImage, TicketType } from "@/types/events.types";
import { isPrismfestSlug, PRISMFEST_VENUE_MAP } from "@/lib/events/prismfest";
import { getEventTicketTypes } from "@/lib/events/ticket-types";
import { getParchiOffer, type ParchiOffer } from "@/lib/parchi/service";

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center&auto=format&q=80";

export interface EventDetailData {
  event: Event;
  poster: string;
  venueMapUrl: string | null;
  parchiOffer: ParchiOffer | null;
  ticketTypes: TicketType[];
}

/**
 * Everything the event detail page shows, by slug, whatever the status.
 * Callers decide who may see it (public page: not invite-only).
 */
export async function loadEventDetail(slug: string): Promise<EventDetailData | null> {
  const { rows: eventRows } = await query(
    `SELECT * FROM events_with_details WHERE event_slug = $1 LIMIT 1`,
    [slug],
  );
  const eventRow = eventRows[0];
  if (!eventRow) return null;

  const event: Event = {
    id: Number(eventRow.event_id),
    name: eventRow.event_name!,
    slug: eventRow.event_slug!,
    description: eventRow.event_description,
    start_time: eventRow.start_time!,
    end_time: eventRow.end_time!,
    status: eventRow.event_status!,
    organizer_id: eventRow.organizer_id!,
    organizer_name: eventRow.organizer_name,
    organizer_avatar: eventRow.organizer_avatar,
    location_name: eventRow.location_name,
    address: eventRow.address,
    latitude: eventRow.latitude,
    longitude: eventRow.longitude,
  };

  const { rows: eventImagesData } = await query(
    `SELECT * FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
    [event.id],
  );
  const eventImages = (eventImagesData || []) as EventImage[];

  // TEMP PREVIEW ONLY - revert before commit (tracked as INSID-238)
  if (eventImages.length === 0 && event.id === 85) {
    eventImages.push({
      id: -1,
      event_id: 85,
      url: "/tmp-preview-farmhouse.jpg",
      alt_text: "Paaltu FarmHouse preview",
      is_primary: true,
      display_order: 1,
    } as EventImage);
  }

  const poster = eventImages[0]?.url || FALLBACK_POSTER;

  // Venue map isn't on the (untracked) events_with_details view. Prismfest's
  // bundled image covers it until the layout_image_url migration has run.
  let venueMapUrl: string | null = null;
  try {
    const { rows } = await query(
      `SELECT layout_image_url FROM events WHERE id = $1`,
      [event.id],
    );
    venueMapUrl = rows[0]?.layout_image_url ?? null;
  } catch (error) {
    console.error("Event venue map lookup failed:", error);
  }
  if (!venueMapUrl && isPrismfestSlug(event.slug)) venueMapUrl = PRISMFEST_VENUE_MAP;

  // Parchi student discount for this event, if one is switched on. Never let
  // it break the page.
  let parchiOffer: ParchiOffer | null = null;
  try {
    parchiOffer = await getParchiOffer(event.id);
  } catch (err) {
    console.error("[event page] Parchi offer lookup failed:", err);
  }

  let ticketTypes: TicketType[] = [];
  try {
    ticketTypes = await getEventTicketTypes(event.id);
  } catch (err) {
    console.error("[event page] Ticket lookup failed:", err);
  }

  return { event, poster, venueMapUrl, parchiOffer, ticketTypes };
}
