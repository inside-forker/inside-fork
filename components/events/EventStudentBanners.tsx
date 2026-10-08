"use client";

import { useEffect, useState } from "react";
import { ParchiEventBanner } from "@/components/events/ParchiEventBanner";
import { InsideStudentBanner } from "@/components/events/InsideStudentBanner";
import type { ParchiOffer } from "@/lib/parchi/discount";
import {
  captureParchiArrivalFromUrl,
  recallParchiChannel,
} from "@/lib/parchi/prefill";
import { isPrismfestSlug } from "@/lib/events/prismfest";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

/**
 * Chooses Parchi vs Inside student branding on the event page.
 * - Parchi channel → Parchi banner only
 * - Logged-in non-Parchi on Prismfest → Inside banner
 * - Otherwise → nothing
 */
export function EventStudentBanners({
  offer,
  eventSlug,
}: {
  offer: ParchiOffer | null;
  eventSlug: string;
}) {
  const { user, isLoading } = useSupabaseUser();
  const [fromParchi, setFromParchi] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    captureParchiArrivalFromUrl();
    setFromParchi(recallParchiChannel());
    setReady(true);
  }, []);

  if (!offer || !ready) return null;

  if (fromParchi) {
    return <ParchiEventBanner offer={offer} />;
  }

  if (!isLoading && user && isPrismfestSlug(eventSlug)) {
    return <InsideStudentBanner offer={offer} />;
  }

  return null;
}
