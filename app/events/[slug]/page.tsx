import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Event, EventImage, TicketType } from "@/types/events.types";
import { EventFacts, EventPoster, EventTitle } from "@/components/events/EventHero";
import { EventDescription } from "@/components/events/EventDescription";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { EventBookingProvider } from "@/components/events/detail/EventBookingProvider";
import { EventTicketsPanel } from "@/components/events/detail/EventTicketsPanel";
import { EventBookingBar } from "@/components/events/detail/EventBookingBar";
import { EventLineup, type EventLineupArtist } from "@/components/events/detail/EventLineup";
import { EventGoodToKnow, type EventInfoLists } from "@/components/events/detail/EventGoodToKnow";
import { EventLocation } from "@/components/events/detail/EventLocation";
import { SECTION_TITLE } from "@/components/events/detail/styles";
import { SimilarEventsContainer } from "@/components/events/containers/SimilarEventsContainer";
import { MoreEventsSkeleton } from "@/components/events/detail/MoreEvents";
import { isPrismfestSlug, PRISMFEST_VENUE_MAP } from "@/lib/events/prismfest";
import { getEventTicketTypes } from "@/lib/events/ticket-types";
import { getParchiOffer, type ParchiOffer } from "@/lib/parchi/service";
import { cn } from "@/lib/utils";

// Enable ISR with 60 second revalidation for event pages
export const revalidate = 60;

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center&auto=format&q=80";

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Query the events view - Critical Data
  const { rows: eventRows } = await query(
    `SELECT * FROM events_with_details WHERE event_slug = $1 LIMIT 1`,
    [slug],
  );
  const eventRow = eventRows[0];

  if (!eventRow) notFound();

  // Map event row to our Event type
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

  // Lineup and "Good to know" aren't stored yet (same as the app's
  // event_info); their sections hide until they are.
  const lineup: EventLineupArtist[] = [];
  const info: EventInfoLists = { setting_tags: [], amenities: [], restrictions: [] };

  const hasTickets = ticketTypes.length > 0;
  const hasVenue = Boolean(event.location_name || event.address);

  return (
    <div className="bg-background">
      <EventBookingProvider event={event} ticketTypes={ticketTypes} parchiOffer={parchiOffer}>
        <div className="mx-auto w-full max-w-3xl px-5 pt-3 md:px-8 lg:max-w-[1200px] lg:pt-12">
          {/* Phones stack poster → title → facts → tickets → the rest. From
              lg the title spans both columns and Tickets is a sticky card. */}
          <div
            className={cn(
              "lg:grid lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-14",
              hasTickets ? "lg:grid-cols-[minmax(0,1fr)_minmax(360px,400px)]" : "lg:grid-cols-[minmax(0,800px)]",
            )}
          >
            <EventPoster src={poster} alt={event.name} className="lg:col-start-1 lg:row-start-2 lg:mt-8" />
            <EventTitle event={event} className="mt-5 lg:col-span-full lg:row-start-1 lg:mt-0" />
            <EventFacts event={event} className="mt-7 lg:col-start-1 lg:row-start-3 lg:mt-9" />

            {hasTickets && (
              <EventTicketsPanel className="mt-11 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-3 lg:row-start-2 lg:mt-8 lg:self-start" />
            )}

            <div className="lg:col-start-1 lg:row-start-4">
              <EventLineup artists={lineup} className="mt-10 lg:mt-14" />

              {event.description?.trim() && (
                <section aria-labelledby="about-title" className="mt-11 lg:mt-[72px]">
                  <h2 id="about-title" className={cn(SECTION_TITLE, "mb-3 lg:mb-4")}>
                    About
                  </h2>
                  <EventDescription text={event.description} />
                </section>
              )}

              <EventGoodToKnow info={info} className="mt-9 lg:mt-14" />

              {hasVenue && (
                <EventLocation event={event} layoutImageUrl={venueMapUrl} className="mt-10 lg:mt-[72px]" />
              )}
            </div>
          </div>

          <Suspense fallback={<MoreEventsSkeleton className="mt-11 lg:mt-24" />}>
            <SimilarEventsContainer eventId={event.id} className="mt-11 lg:mt-24" />
          </Suspense>

          <div className="flex justify-center pb-7 pt-9 lg:pb-12 lg:pt-16">
            <ReportIssueButton
              reportType="event"
              itemId={event.id}
              itemName={event.name}
              itemSlug={event.slug}
            />
          </div>
        </div>

        {hasTickets && <EventBookingBar />}
      </EventBookingProvider>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { rows } = await query(
    `SELECT event_name, event_description FROM events_with_details WHERE event_slug = $1 LIMIT 1`,
    [slug],
  );
  const eventRow = rows[0];

  if (!eventRow) {
    return {
      title: "Event Not Found",
    };
  }

  return {
    title: `${eventRow.event_name} - Inside Karachi Events`,
    description:
      eventRow.event_description?.substring(0, 160) ||
      `Join us for ${eventRow.event_name} - an amazing event in Karachi`,
  };
}
