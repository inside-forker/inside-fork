import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionFromCookies } from "@/lib/auth/session";
import { loadEventDetail } from "@/lib/events/event-detail";
import { hasClaimedInvite, hasPaidInviteBooking } from "@/lib/events/invites";
import { EventDetailView } from "@/components/events/detail/EventDetailView";
import { InviteNotice } from "@/components/events/invite/InviteNotice";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invite only - Inside",
  robots: { index: false, follow: false },
};

/** Event page for guests of an invite-only event who accepted their invite. */
export default async function InviteEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadEventDetail(slug);
  if (!data || data.event.status !== "invite_only") notFound();

  const session = await getSessionFromCookies();
  const allowed = session ? await hasClaimedInvite(session.userId, data.event.id) : false;

  if (!allowed) {
    return (
      <InviteNotice
        title="This event is invite only"
        body="Open the invite link you were sent to get in. If you already accepted it, log in with that account."
        action={
          !session ? (
            <Button asChild size="lg" variant="solid" className="h-12 w-full rounded-control text-body">
              <Link href={`/login?next=${encodeURIComponent(`/invite/${slug}`)}`}>Log in</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  // One ticket per invite: once it's bought, the link only points to the ticket.
  if (await hasPaidInviteBooking(session!.userId, data.event.id)) {
    return (
      <InviteNotice
        event={{
          name: data.event.name,
          start_time: data.event.start_time,
          location_name: data.event.location_name ?? null,
          poster: data.poster,
        }}
        title="You already have your ticket"
        body="Your invite has been used to book your ticket. Each invite works for one ticket only."
        action={
          <Button asChild size="lg" variant="solid" className="h-12 w-full rounded-control text-body">
            <Link href="/dashboard/bookings">View my ticket</Link>
          </Button>
        }
      />
    );
  }

  return <EventDetailView data={data} inviteOnly />;
}
