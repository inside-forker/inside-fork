import { Suspense } from "react";
import { EventFacts, EventPoster, EventTitle } from "@/components/events/EventHero";
import { EventDescription } from "@/components/events/EventDescription";
import { ReportIssueButton } from "@/components/shared/ReportIssueButton";
import { EventBookingProvider } from "@/components/events/detail/EventBookingProvider";
import { EventTicketsPanel } from "@/components/events/detail/EventTicketsPanel";
import { EventBookingBar } from "@/components/events/detail/EventBookingBar";
import { EventLineup, type EventLineupArtist } from "@/components/events/detail/EventLineup";
import { EventGoodToKnow, type EventInfoLists } from "@/components/events/detail/EventGoodToKnow";
import { EventVenueMap } from "@/components/events/EventVenueMap";
import { SECTION_TITLE } from "@/components/events/detail/styles";
import { SimilarEventsContainer } from "@/components/events/containers/SimilarEventsContainer";
import { MoreEventsSkeleton } from "@/components/events/detail/MoreEvents";
import type { EventDetailData } from "@/lib/events/event-detail";
import { cn } from "@/lib/utils";

/**
 * The event detail page body. `inviteOnly` (guest page of an invite-only
 * event): one ticket in total and no "more events" rail.
 */
export function EventDetailView({
  data,
  inviteOnly = false,
}: {
  data: EventDetailData;
  inviteOnly?: boolean;
}) {
  const { event, poster, venueMapUrl, parchiOffer } = data;
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

              {venueMapUrl && (
                <section aria-labelledby="venue-map-title" className="mt-10 lg:mt-[72px]">
                  <h2 id="venue-map-title" className={cn(SECTION_TITLE, "mb-4 lg:mb-5")}>
                    Venue map
                  </h2>
                  <EventVenueMap src={venueMapUrl} alt={`${event.name} venue map`} />
                </section>
              )}
            </div>
          </div>

          {!inviteOnly && (
            <Suspense fallback={<MoreEventsSkeleton className="mt-11 lg:mt-24" />}>
              <SimilarEventsContainer eventId={event.id} className="mt-11 lg:mt-24" />
            </Suspense>
          )}

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
