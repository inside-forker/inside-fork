"use client";

import { ParchiEventBanner } from "@/components/events/ParchiEventBanner";
import { InsideStudentBanner } from "@/components/events/InsideStudentBanner";
import {
  resolveStudentOffer,
  type ParchiOffer,
} from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import { isPrismfestSlug } from "@/lib/events/prismfest";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

/**
 * Chooses Parchi vs Inside student branding on the event page.
 * - Parchi channel → Parchi banner only
 * - Non-Parchi on Prismfest → Inside banner
 * - Otherwise → nothing
 *
 * Prismfest always has a resolvable offer (live coupon or 20% fallback) so the
 * banner never disappears when the coupon row is briefly unreadable.
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
  const isPrismfest = isPrismfestSlug(eventSlug);
  if (isPrismfest) return null;

  const resolved = offer;
  if (!resolved) return null;

  if (fromParchi) {
    return <ParchiEventBanner offer={resolved} />;
  }

  if (!isLoading && isPrismfest) {
    return (
      <InsideStudentBanner
        offer={resolved}
        signedIn={!!user}
        eventSlug={eventSlug}
      />
    );
  }

  return null;
}
