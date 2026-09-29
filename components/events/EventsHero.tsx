"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EventsHeroProps {
  /** Kept for the page's call site; the header no longer shows a count. */
  totalEvents?: number;
}

/**
 * Events page header, flat to match the mobile app: an eyebrow, one display
 * title, a line of context and the two actions. No stats: the old grid showed
 * hardcoded organizer/venue numbers.
 */
export function EventsHero(_props: EventsHeroProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="container mx-auto px-5 py-10 sm:px-6 sm:py-14 lg:px-8">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          What&apos;s on
        </span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Events in Karachi
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          From cultural festivals to tech meetups, comedy shows to food events.
          Find your next night out and get tickets in a few taps.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={() => {
              const el = document.getElementById("events-list");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
            className="rounded-xl font-semibold active:opacity-80"
          >
            Find events
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-xl font-semibold active:opacity-80"
            asChild
          >
            <Link href="/contact">Host an event</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
