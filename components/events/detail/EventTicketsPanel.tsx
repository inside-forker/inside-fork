"use client";

import { useMemo } from "react";
import { ArrowUpRight, Minus, Plus, QrCode } from "lucide-react";
import type { TicketType } from "@/types/events.types";
import { cn } from "@/lib/utils";
import {
  isTicketOnSale,
  maxSelectable,
  percentOff,
  ticketPricing,
  ticketUnavailable,
} from "@/lib/events/ticket-pricing";
import { formatEventFacts } from "@/lib/events/datetime";
import { useBookingSummary, useEventBooking } from "./EventBookingProvider";
import { SECTION_TITLE } from "./styles";

interface TicketGroup {
  name: string | null;
  tickets: TicketType[];
}

/**
 * Tickets as a two-up grid of tiles. On phones it sits in the page flow and
 * the booking bar carries the total; from lg it is the sticky card beside the
 * content, with its own total and Checkout.
 */
export function EventTicketsPanel({ className }: { className?: string }) {
  const { event, ticketTypes, parchiOffer, checkout } = useEventBooking();
  const summary = useBookingSummary();
  const facts = formatEventFacts(event.start_time, event.end_time);

  const groups = useMemo<TicketGroup[]>(() => {
    const named = new Map<string, TicketType[]>();
    const ungrouped: TicketType[] = [];
    for (const t of ticketTypes) {
      const g = t.group_name?.trim();
      if (g) named.set(g, [...(named.get(g) ?? []), t]);
      else ungrouped.push(t);
    }
    const list: TicketGroup[] = [...named].map(([name, tickets]) => ({ name, tickets }));
    if (ungrouped.length > 0) list.push({ name: null, tickets: ungrouped });
    return list;
  }, [ticketTypes]);

  const hasNamedGroups = groups.some((g) => g.name);
  const sellsHere = ticketTypes.some((t) => !t.ticket_url);

  return (
    <section
      id="tickets"
      aria-labelledby="tickets-title"
      className={cn("scroll-mt-24 lg:rounded-[28px] lg:p-6 lg:ring-1 lg:ring-inset lg:ring-border", className)}
    >
      <h2 id="tickets-title" className={cn(SECTION_TITLE, "lg:text-[22px]")}>
        Tickets
      </h2>
      {facts.summary && (
        <p className="mt-1 hidden text-[15px] text-muted-foreground lg:block">{facts.summary}</p>
      )}

      <div className="mt-4 lg:mt-5">
        {parchiOffer && (
          <div className="mb-2.5 flex items-center gap-3 rounded-[20px] px-4 py-3.5 ring-1 ring-inset ring-border">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Parchi student rate</div>
              <div className="text-[13px] text-muted-foreground">
                {parchiOffer.max_discount_amount != null
                  ? `Up to Rs ${parchiOffer.max_discount_amount.toLocaleString("en-US")} off · verify your Parchi ID at checkout`
                  : "Verify your Parchi ID at checkout"}
              </div>
            </div>
            <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-primary-foreground">
              {parchiOffer.discount_type === "fixed"
                ? `Rs ${parchiOffer.discount_value.toLocaleString("en-US")} off`
                : `${parchiOffer.discount_value}% off`}
            </span>
          </div>
        )}

        <div className="space-y-5">
          {groups.map((group, i) => (
            <div key={group.name ?? `ungrouped-${i}`} role="group" aria-label={group.name ?? "Tickets"}>
              {hasNamedGroups && (
                <h3 className="mb-2.5 ml-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  {group.name ?? "General passes"}
                </h3>
              )}
              <ul className="grid grid-cols-2 gap-2.5">
                {group.tickets.map((ticket, j) => (
                  <TicketTile
                    key={ticket.id}
                    ticket={ticket}
                    // An odd tier out spans the row as a wide tile.
                    wide={group.tickets.length % 2 === 1 && j === group.tickets.length - 1}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 hidden lg:block">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] text-muted-foreground">{summary.label}</span>
          <span className="text-[28px] font-bold tabular-nums tracking-[-0.02em]">{summary.value}</span>
        </div>
        <button
          type="button"
          onClick={checkout}
          disabled={!summary.hasSelection}
          className={cn(
            "mt-4 h-[52px] w-full rounded-full text-[17px] font-semibold transition-opacity",
            summary.hasSelection
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-muted text-muted-foreground",
          )}
        >
          Checkout
        </button>
      </div>

      {sellsHere && (
        <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
          Your QR works once, so don&apos;t share it.
        </p>
      )}
    </section>
  );
}

function TicketTile({ ticket, wide }: { ticket: TicketType; wide: boolean }) {
  const { selected, setQuantity, showStudentPrice } = useEventBooking();
  const external = Boolean(ticket.ticket_url);
  const unavailable = external ? null : ticketUnavailable(ticket);
  const onSale = !external && isTicketOnSale(ticket);
  const qty = selected[ticket.id] ?? 0;
  const picked = onSale && qty > 0;
  const max = maxSelectable(ticket);
  const atLimit = picked && qty >= max;
  const pricing = ticketPricing(ticket, showStudentPrice);
  const discount = percentOff(pricing.salePrice, pricing.comparePrice);

  const people = ticket.people_per_ticket ?? 1;
  const minPeople = ticket.min_people_per_ticket;
  const admits =
    people > 1 ? `Admits ${minPeople && minPeople < people ? `${minPeople}–${people}` : people}` : null;
  const perPerson = ticket.max_per_person ?? 10;
  const limitNote = atLimit ? (max >= perPerson ? `Max ${max} per person` : `Only ${max} left`) : null;
  const note = limitNote ?? admits;
  const description = ticket.description?.trim() || null;

  const sub = picked ? "text-background/65" : "text-muted-foreground";

  const name = (
    <>
      <h4 className="px-0.5 text-[15px] font-semibold leading-[1.3]">{ticket.name}</h4>
      {note && <p className={cn("px-0.5 text-[13px]", sub)}>{note}</p>}
      {description && <p className={cn("line-clamp-2 px-0.5 text-[13px]", sub)}>{description}</p>}
      {discount && !unavailable && (
        <span className="mt-2 inline-flex self-start rounded-full bg-primary px-2 py-0.5 text-[13px] font-bold text-primary-foreground">
          {discount}
        </span>
      )}
    </>
  );

  const price = (
    <div className={cn(wide ? "mt-1.5" : "mt-3.5")}>
      <div
        className={cn(
          "flex items-baseline gap-1 px-0.5 tabular-nums",
          unavailable && unavailable.kind !== "soon" && "line-through",
        )}
      >
        <span className={cn("text-[13px] font-semibold", !unavailable && sub)}>Rs</span>
        <span className="text-[26px] font-bold leading-[1.05] tracking-[-0.025em]">
          {pricing.salePrice.toLocaleString("en-US")}
        </span>
      </div>
      {pricing.comparePrice && !unavailable && (
        <div className={cn("px-0.5 text-[13px]", sub)}>
          <s>Rs {pricing.comparePrice.toLocaleString("en-US")}</s>
        </div>
      )}
    </div>
  );

  let action: React.ReactNode;
  if (external) {
    action = (
      <a
        href={ticket.ticket_url!}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-background text-[15px] font-semibold text-foreground transition-opacity hover:opacity-80"
      >
        Buy pass
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </a>
    );
  } else if (unavailable) {
    action = (
      <div
        className={cn(
          "grid h-11 place-items-center rounded-full bg-muted px-3 text-center text-[15px] font-semibold",
          unavailable.kind === "soon" && "text-foreground",
        )}
      >
        {unavailable.label}
      </div>
    );
  } else if (!picked) {
    action = (
      <button
        type="button"
        onClick={() => setQuantity(ticket.id, 1)}
        aria-label={`Add ${ticket.name}`}
        className="h-11 w-full rounded-full bg-background text-[15px] font-semibold text-foreground transition-opacity hover:opacity-80"
      >
        Add
      </button>
    );
  } else {
    action = (
      <div className="flex h-11 items-center justify-between rounded-full bg-background/15">
        <button
          type="button"
          onClick={() => setQuantity(ticket.id, qty - 1)}
          aria-label={`Remove one ${ticket.name}`}
          className="grid h-11 w-11 place-items-center rounded-full"
        >
          <Minus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <span className="text-[17px] font-bold tabular-nums" aria-live="polite">
          {qty}
        </span>
        <button
          type="button"
          onClick={() => setQuantity(ticket.id, Math.min(max, qty + 1))}
          disabled={atLimit}
          aria-label={`Add one more ${ticket.name}`}
          className="grid h-11 w-11 place-items-center rounded-full disabled:opacity-30"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const surface = picked
    ? "bg-foreground text-background"
    : unavailable
      ? "text-muted-foreground ring-1 ring-inset ring-border"
      : "bg-muted text-foreground";

  if (wide) {
    return (
      <li className={cn("col-span-2 flex items-center gap-3 rounded-[20px] py-4 pl-4 pr-3.5", surface)}>
        <div className="flex min-w-0 flex-1 flex-col">
          {name}
          {price}
        </div>
        <div className="w-[120px] shrink-0">{action}</div>
      </li>
    );
  }

  return (
    <li className={cn("flex min-h-[184px] flex-col rounded-[20px] px-3.5 pb-3.5 pt-4", surface)}>
      {name}
      <div className="flex-1" />
      {price}
      <div className="mt-3.5">{action}</div>
    </li>
  );
}
