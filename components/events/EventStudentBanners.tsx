"use client";

import { ParchiEventBanner } from "@/components/events/ParchiEventBanner";
import { InsideStudentBanner } from "@/components/events/InsideStudentBanner";
import type { ParchiOffer } from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

/**
 * Chooses Parchi vs Inside student branding on the event page.
 * - Parchi channel → Parchi banner only
 * - Everyone else → Inside banner
 *
 * `offer` is only set when the event's Parchi toggle is on and a tier has a
 * Parchi price (see getParchiOffer); otherwise nothing renders.
 */
export function EventStudentBanners({
  offer,
  eventSlug,
}: {
  offer: ParchiOffer | null;
  eventSlug: string;
}) {
  const { user, isLoading } = useSupabaseUser();
  const fromParchi = useArrivedFromParchi();

  if (!offer) return null;

  if (fromParchi) {
    return <ParchiEventBanner offer={offer} />;
  }

  if (!isLoading) {
    return (
      <InsideStudentBanner
        offer={offer}
        signedIn={!!user}
        eventSlug={eventSlug}
      />
    );
  }

  return null;
}
