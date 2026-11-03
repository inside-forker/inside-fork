"use client";

import { ParchiEventBanner } from "@/components/events/ParchiEventBanner";
import type { ParchiOffer } from "@/lib/parchi/discount";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";

/**
 * Student banner on the event page: shown only to visitors who arrived from
 * the Parchi app. Regular Inside visitors see no banner.
 *
 * `offer` is only set when the event's Parchi toggle is on and a tier has a
 * Parchi price (see getParchiOffer); otherwise nothing renders.
 */
export function EventStudentBanners({
  offer,
}: {
  offer: ParchiOffer | null;
  eventSlug?: string;
}) {
  const fromParchi = useArrivedFromParchi();

  if (!offer || !fromParchi) return null;

  return <ParchiEventBanner offer={offer} />;
}
