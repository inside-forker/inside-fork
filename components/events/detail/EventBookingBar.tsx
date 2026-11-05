"use client";

import { cn } from "@/lib/utils";
import { useBookingSummary, useEventBooking } from "./EventBookingProvider";

/**
 * Phone and tablet booking bar, pinned to the bottom edge. While it is on
 * screen the floating BottomNav steps aside (see `data-event-buy-bar` in
 * globals.css). Desktop uses the sticky Tickets card instead.
 */
export function EventBookingBar() {
  const { checkout, showTickets } = useEventBooking();
  const { label, value, hasSelection, canBuy } = useBookingSummary();

  return (
    <div
      data-event-buy-bar=""
      className="fixed inset-x-0 bottom-0 z-40 bg-background shadow-[0_-1px_0_hsl(var(--border))] lg:hidden"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 md:px-8">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-muted-foreground">{label}</div>
          <div className="truncate text-[17px] font-bold tabular-nums">{value}</div>
        </div>
        <button
          type="button"
          onClick={hasSelection ? checkout : showTickets}
          disabled={!canBuy}
          className={cn(
            "h-[50px] shrink-0 rounded-full px-7 text-[17px] font-semibold transition-opacity",
            canBuy ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground",
          )}
        >
          {hasSelection ? "Checkout" : canBuy ? "Get tickets" : value}
        </button>
      </div>
    </div>
  );
}
