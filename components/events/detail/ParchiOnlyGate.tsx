"use client";

import { useEffect, useState, type ReactNode } from "react";
import { urlSaysParchiChannel } from "@/lib/parchi/prefill";

/**
 * The page of a Parchi-members-only event: the event for visitors who arrive
 * from the Parchi app's link (`?ref=parchi_app` / `?parchiId=`), `locked` for
 * everyone else. This only hides the page. Booking itself needs an approved
 * Parchi verification (checkout, the booking route and a DB trigger).
 */
export function ParchiOnlyGate({
  children,
  locked,
}: {
  children: ReactNode;
  locked: ReactNode;
}) {
  // The query string is read after mount so the page stays statically rendered.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOpen(urlSaysParchiChannel());
  }, []);

  if (open === null) return <div className="min-h-[70vh] bg-background" aria-busy="true" />;
  return <>{open ? children : locked}</>;
}
