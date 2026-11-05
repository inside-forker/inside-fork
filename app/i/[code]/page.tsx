import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionFromCookies } from "@/lib/auth/session";
import { getInviteByCode, normalizeInviteCode } from "@/lib/events/invites";
import { InviteNotice } from "@/components/events/invite/InviteNotice";
import { AcceptInviteButton } from "@/components/events/invite/AcceptInviteButton";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Generic on purpose: chat apps fetch the link for a preview card.
export const metadata: Metadata = {
  title: "You're invited - Inside",
  robots: { index: false, follow: false },
};

/**
 * Invite link. Opening it never uses the code (link previews and second opens
 * stay safe); the guest has to log in and tap "Accept invite".
 */
export default async function InviteLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const raw = (await params).code;
  const code = normalizeInviteCode(decodeURIComponent(raw));
  const invite = code ? await getInviteByCode(code) : null;

  if (!invite) {
    return (
      <InviteNotice
        title="This invite link isn't valid"
        body="Check that you opened the full link from your invitation, or ask the host for a new one."
      />
    );
  }

  // Event later made public: no gate needed.
  if (invite.event_status === "published") redirect(`/events/${invite.event_slug}`);

  const session = await getSessionFromCookies();
  const event = {
    name: invite.event_name,
    start_time: invite.start_time,
    location_name: invite.location_name,
    poster: invite.poster,
  };

  if (session && invite.claimed_by === session.userId) {
    redirect(`/invite/${invite.event_slug}`);
  }

  if (invite.claimed_by) {
    return (
      <InviteNotice
        event={event}
        title="This invite has already been used"
        body="Each invite works for one person only. If this is your invite, log in with the account you accepted it on. Otherwise, ask the host for your own link."
        action={
          !session ? (
            <Button asChild size="lg" variant="solid" className="h-12 w-full rounded-control text-body">
              <Link href={`/login?next=${encodeURIComponent(`/i/${invite.code}`)}`}>Log in</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (!session) {
    return (
      <InviteNotice
        event={event}
        title="Accept your invite"
        body="This event is invite only. Log in or sign up, then accept the invite. It locks to your account and can't be used by anyone else."
        action={
          <Button asChild size="lg" className="h-12 w-full rounded-control text-body">
            <Link href={`/login?next=${encodeURIComponent(`/i/${invite.code}`)}`}>Log in to accept</Link>
          </Button>
        }
      />
    );
  }

  return (
    <InviteNotice
      event={event}
      title="Accept your invite"
      body="Accepting locks this invite to your account. You'll then be able to book your ticket."
      action={<AcceptInviteButton code={invite.code} />}
    />
  );
}
