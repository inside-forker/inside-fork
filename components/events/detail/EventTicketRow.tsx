"use client";

import { ArrowUpRight, Minus, Plus } from "lucide-react";
import type { TicketType } from "@/types/events.types";
import { cn } from "@/lib/utils";
import { isTicketOnSale, maxSelectable, ticketPricing, ticketUnavailable } from "@/lib/events/ticket-pricing";
import { useEventBooking } from "./EventBookingProvider";

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

/**
 * One ticket tier as a row: name, notes and price on the left, the control on
 * the right. `stepper` (phones) always shows − qty +; `add` (desktop) shows an
 * Add pill until the tier is picked.
 */
export function EventTicketRow({
  ticket,
  control,
  className,
}: {
  ticket: TicketType;
  control: "stepper" | "add";
  className?: string;
}) {
  const { selected, setQuantity, showStudentPrice } = useEventBooking();
  const external = Boolean(ticket.ticket_url);
  const unavailable = external ? null : ticketUnavailable(ticket);
  const onSale = !external && isTicketOnSale(ticket);
  const qty = selected[ticket.id] ?? 0;
  const max = maxSelectable(ticket);
  const atLimit = onSale && qty > 0 && qty >= max;
  const pricing = ticketPricing(ticket, showStudentPrice);

  const people = ticket.people_per_ticket ?? 1;
  const minPeople = ticket.min_people_per_ticket;
  const admits =
    people > 1 ? `Admits ${minPeople && minPeople < people ? `${minPeople}–${people}` : people}` : null;
  const perPerson = ticket.max_per_person ?? 10;
  const limitNote = atLimit ? (max >= perPerson ? `Max ${max} per person` : `Only ${max} left`) : null;
  const note = limitNote ?? admits;
  const description = ticket.description?.trim() || null;
  const struck = Boolean(unavailable && unavailable.kind !== "soon");

  let action: React.ReactNode;
  if (external) {
    action = (
      <a
        href={ticket.ticket_url!}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-muted px-4 text-small font-semibold text-foreground transition-colors duration-fast hover:bg-border"
      >
        Buy pass
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  } else if (unavailable) {
    action = (
      <span
        className={cn(
          "inline-flex h-10 shrink-0 items-center rounded-full bg-muted px-3.5 text-data font-semibold",
          unavailable.kind === "soon" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {unavailable.label}
      </span>
    );
  } else if (control === "add" && qty === 0) {
    action = (
      <button
        type="button"
        onClick={() => setQuantity(ticket.id, 1)}
        aria-label={`Add ${ticket.name}`}
        className="h-10 shrink-0 rounded-full border border-border bg-background px-5 text-small font-semibold text-foreground transition-colors duration-fast hover:bg-muted"
      >
        Add
      </button>
    );
  } else {
    const minus = control === "stepper" ? "border border-border bg-background" : "bg-muted";
    action = (
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setQuantity(ticket.id, qty - 1)}
          disabled={qty === 0}
          aria-label={`Remove one ${ticket.name}`}
          className="group grid h-11 w-11 place-items-center disabled:opacity-35"
        >
          <span className={cn("grid h-9 w-9 place-items-center rounded-full text-foreground", minus)}>
            <Minus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </span>
        </button>
        <span className="min-w-6 text-center text-[15px] font-bold tabular-nums" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQuantity(ticket.id, Math.min(max, qty + 1))}
          disabled={atLimit || !onSale}
          aria-label={`Add one more ${ticket.name}`}
          className="grid h-11 w-11 place-items-center disabled:opacity-30"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background">
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <li className={cn("flex items-center gap-3", className)}>
      <div className="min-w-0 flex-1">
        <p className="text-small font-semibold leading-snug">{ticket.name}</p>
        {note && <p className="text-data text-muted-foreground">{note}</p>}
        {description && <p className="line-clamp-2 text-data text-muted-foreground">{description}</p>}
        <div className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
          <span className={cn("text-[15px] font-bold", struck && "text-muted-foreground line-through")}>
            {rs(pricing.salePrice)}
          </span>
          {pricing.comparePrice && !unavailable && (
            <s className="text-label text-muted-foreground">{rs(pricing.comparePrice)}</s>
          )}
        </div>
      </div>
      {action}
    </li>
  );
}
