import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventDetailView } from "@/components/events/detail/EventDetailView";
import { ParchiOnlyGate } from "@/components/events/detail/ParchiOnlyGate";
import { InviteNotice } from "@/components/events/invite/InviteNotice";
import { Button } from "@/components/ui/button";
import { loadEventDetail } from "@/lib/events/event-detail";

// Enable ISR with 60 second revalidation for event pages
export const revalidate = 60;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const data = await loadEventDetail(slug);
  // Invite-only events open only through an invite link (/i/[code]).
  if (!data || data.event.status === "invite_only") notFound();

  // Parchi-members-only events open only from the Parchi app's link.
  if (data.event.status === "parchi_only") {
    return (
      <ParchiOnlyGate
        locked={
          <InviteNotice
            title="Only for Parchi members"
            body="Tickets for this event are only sold through the Parchi app. Open the event in Parchi to get yours."
            action={
              <Button asChild size="lg" className="h-12 w-full rounded-control text-body">
                <Link href="https://parchi.io">Get the Parchi app</Link>
              </Button>
            }
          />
        }
      >
        <EventDetailView data={data} />
      </ParchiOnlyGate>
    );
  }

  return <EventDetailView data={data} />;
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { rows } = await query(
    `SELECT event_name, event_description FROM events_with_details
     WHERE event_slug = $1 AND event_status::text <> 'invite_only' LIMIT 1`,
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
