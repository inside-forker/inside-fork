import { Suspense } from "react";
import { EventDescription } from "@/components/events/EventDescription";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { EventBookingProvider } from "@/components/events/detail/EventBookingProvider";
import { EventBookingBar } from "@/components/events/detail/EventBookingBar";
import { EventHeroBanner, EventSideDetails } from "@/components/events/detail/EventHeader";
import { EventTicketsDesktop, EventTicketsPhone } from "@/components/events/detail/EventTickets";
import { EventLineup, type EventLineupArtist } from "@/components/events/detail/EventLineup";
import { EventGoodToKnow, type EventInfoLists } from "@/components/events/detail/EventGoodToKnow";
import { EventVenueMap } from "@/components/events/EventVenueMap";
import { SECTION_TITLE } from "@/components/events/detail/styles";
import { SimilarEventsContainer } from "@/components/events/containers/SimilarEventsContainer";
import { MoreEventsSkeleton } from "@/components/events/detail/MoreEvents";
import type { EventDetailData } from "@/lib/events/event-detail";
import { cn } from "@/lib/utils";

/**
 * The event detail page body. Phones: the banner on an ink strip with the
 * details, then day tabs with steppers. Desktop: the banner and About on the
 * left; title, venue, fold-open day sections and Checkout in the
 * sidebar. `inviteOnly` (guest page of an invite-only event): one ticket in
 * total and no "More events".
 */
export function EventDetailView({
  data,
  inviteOnly = false,
}: {
  data: EventDetailData;
  inviteOnly?: boolean;
}) {
  const { event, poster, posterSize, venueMapUrl, parchiOffer } = data;
  const ticketTypes = inviteOnly
    ? data.ticketTypes.map((t) => ({ ...t, max_per_person: 1 }))
    : data.ticketTypes;

  // Lineup and "Good to know" aren't stored yet (same as the app's
  // event_info); their sections hide until they are.
  const lineup: EventLineupArtist[] = [];
  const info: EventInfoLists = { setting_tags: [], amenities: [], restrictions: [] };

  const hasTickets = ticketTypes.length > 0;

  return (
    <div className="bg-background">
      <EventBookingProvider
        event={event}
        ticketTypes={ticketTypes}
        parchiOffer={parchiOffer}
        maxTotal={inviteOnly ? 1 : undefined}
      >
        <div className="mx-auto w-full max-w-3xl px-5 pt-3 md:px-8 lg:max-w-[1200px] lg:pt-7">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-10">
            <div className="min-w-0">
              <EventHeroBanner event={event} poster={poster} posterSize={posterSize} />

              {hasTickets && <EventTicketsPhone className="mt-4 lg:hidden" />}

              {event.description?.trim() && (
                <section aria-labelledby="about-title" className="mt-6 lg:mt-5">
                  <h2 id="about-title" className={SECTION_TITLE}>
                    About
                  </h2>
                  <EventDescription text={event.description} className="mt-1.5" />
                </section>
              )}

              <EventLineup artists={lineup} className="mt-8" />
              <EventGoodToKnow info={info} className="mt-8" />

              {venueMapUrl && (
                <section aria-labelledby="venue-map-title" className="mt-6">
                  <h2 id="venue-map-title" className={cn(SECTION_TITLE, "mb-3")}>
                    Venue map
                  </h2>
                  <EventVenueMap src={venueMapUrl} alt={`${event.name} venue map`} />
                </section>
              )}

              {!inviteOnly && (
                <Suspense fallback={<MoreEventsSkeleton className="mt-6" />}>
                  <SimilarEventsContainer eventId={event.id} className="mt-6" />
                </Suspense>
              )}
            </div>

            <aside className="hidden lg:block">
              <EventSideDetails event={event} />
              {hasTickets && <EventTicketsDesktop className="mt-5" />}
            </aside>
          </div>

          <div className="flex justify-center pb-7 pt-8 lg:pb-12 lg:pt-12">
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
