import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { EventHero } from "@/components/events/EventHero";
import { EventOrganizer } from "@/components/events/EventOrganizer";
import { EventLocation } from "@/components/events/EventLocation";
import { AnimatedSection } from "@/components/events/AnimatedSection";
import { PremiumGallery } from "@/components/listing/PremiumGallery";
import { ExternalLink } from "lucide-react";
import { Event, EventImage } from "@/types/events.types";
import { PremiumHeading } from "@/components/brand/Typography";
import { getEventGalleryImages } from "@/lib/utils/listing-images";
import { EventSidebarButton } from "@/components/events/EventSidebarButton";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { Suspense } from "react";
import { EventStudentBanners } from "@/components/events/EventStudentBanners";
import { getParchiOffer, type ParchiOffer } from "@/lib/parchi/service";

// Containers
import { EventTicketsContainer } from "@/components/events/containers/EventTicketsContainer";
import { SimilarEventsContainer } from "@/components/events/containers/SimilarEventsContainer";

// Skeletons
import {
  TicketSkeleton,
  SimilarEventsSkeleton,
} from "@/components/events/skeletons";

// Enable ISR with 60 second revalidation for event pages
export const revalidate = 60;

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

  // Fetch images for THIS event immediately as they are part of the critical hero/gallery
  const { rows: eventImagesData } = await query(
    `SELECT * FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
    [event.id],
  );

  const eventImages = (eventImagesData || []) as EventImage[];

  // Parchi student discount for this event, if one is switched on. Never let
  // it break the page.
  let parchiOffer: ParchiOffer | null = null;
  try {
    parchiOffer = await getParchiOffer(event.id);
  } catch (err) {
    console.error("[event page] Parchi offer lookup failed:", err);
  }
  // TEMP PREVIEW ONLY - revert before commit
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

  // Get hero images from event_images table
  const heroImages =
    eventImages && eventImages.length > 0
      ? eventImages.map((img) => img.url)
      : [
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center&auto=format&q=80",
        ];

  return (
    <div className="min-h-screen bg-background">
      {/* Event Hero Section */}
      <EventHero event={event} images={heroImages} withTopMargin={false} />

      {/* MainContent */}
      <div className="container mx-auto px-4 md:px-6 lg:px-8 pt-6 sm:pt-8 md:pt-10 pb-28 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10 lg:gap-12">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8 md:space-y-10">
            <EventStudentBanners offer={parchiOffer} eventSlug={event.slug} />

            {/* Event Description */}
            {event.description && (
              <AnimatedSection className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                    <ExternalLink className="w-4 h-4 text-primary" />
                  </div>
                  <PremiumHeading level={2} dense className="text-foreground">
                    About This{" "}
                    <span className="text-primary">Event</span>
                  </PremiumHeading>
                </div>
                <div className="prose prose-gray dark:prose-invert max-w-none">
                  <p className="text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                </div>
              </AnimatedSection>
            )}

            {/* Event Gallery - Show all uploaded images */}
            {eventImages && eventImages.length > 0 && (
              <AnimatedSection>
                <PremiumGallery
                  images={getEventGalleryImages(eventImages)}
                  title="Event Photos"
                />
              </AnimatedSection>
            )}

            {/* Ticket Section */}
            <Suspense fallback={<TicketSkeleton />}>
              <EventTicketsContainer event={event} parchiOffer={parchiOffer} />
            </Suspense>

            {/* Event Location */}
            <EventLocation event={event} />

            {/* Event Organizer */}
            <AnimatedSection>
              <EventOrganizer event={event} />
            </AnimatedSection>

            {/* Similar Events */}
            <Suspense fallback={<SimilarEventsSkeleton />}>
              <SimilarEventsContainer eventId={event.id} />
            </Suspense>
          </div>

          {/* Right Column - Sidebar */}
          <AnimatedSection className="space-y-8 md:space-y-12">
            <div className="sticky lg:top-20 lg:self-start space-y-8 md:space-y-10 lg:space-y-12">
              <div className="group relative overflow-hidden bg-card border rounded-2xl p-6 md:p-8 hover:border-primary/40 transition-all duration-300 space-y-6">
                <h3 className="text-xl font-semibold">Event Information</h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Date & Time</h4>
                    <p className="text-muted-foreground">
                      {new Date(event.start_time).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(event.start_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}{" "}
                      -{" "}
                      {new Date(event.end_time).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                  </div>

                  {event.location_name && (
                    <div>
                      <h4 className="font-medium mb-2">Location</h4>
                      <p className="text-muted-foreground">
                        {event.location_name}
                      </p>
                      {event.address && (
                        <p className="text-sm text-muted-foreground">
                          {event.address}
                        </p>
                      )}
                    </div>
                  )}

                  {event.organizer_name && (
                    <div>
                      <h4 className="font-medium mb-2">Organizer</h4>
                      <p className="text-muted-foreground">
                        {event.organizer_name}
                      </p>
                    </div>
                  )}
                </div>

                <EventSidebarButton />
              </div>

              <div className="flex justify-center">
                <ReportIssueButton
                  reportType="event"
                  itemId={event.id}
                  itemName={event.name}
                  itemSlug={event.slug}
                />
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
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
