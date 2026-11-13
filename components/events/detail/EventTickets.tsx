"use client";

import { useMemo, useState } from "react";
import { ChevronDown, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { isTicketOnSale, percentOff, ticketPricing } from "@/lib/events/ticket-pricing";
import { useBookingSummary, useEventBooking } from "./EventBookingProvider";
import { EventTicketRow } from "./EventTicketRow";
import { groupTickets, type TicketGroup } from "./ticket-groups";

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

function useTicketGroups(): TicketGroup[] {
  const { event, ticketTypes } = useEventBooking();
  return useMemo(() => groupTickets(ticketTypes, event), [ticketTypes, event]);
}

/** "Up to 15% off" when any tier on sale is discounted. */
function useDiscountNote(): string | null {
  const { ticketTypes, showStudentPrice } = useEventBooking();
  return useMemo(() => {
    let best = 0;
    for (const t of ticketTypes) {
      if (t.ticket_url || !isTicketOnSale(t)) continue;
      const p = ticketPricing(t, showStudentPrice);
      const pct = Number(percentOff(p.salePrice, p.comparePrice)?.replace(/\D/g, "") ?? 0);
      best = Math.max(best, pct);
    }
    return best > 0 ? `Up to ${best}% off` : null;
  }, [ticketTypes, showStudentPrice]);
}

function pickedIn(group: TicketGroup, selected: Record<number, number>): number {
  return group.tickets.reduce((n, t) => n + (selected[t.id] ?? 0), 0);
}

function TicketsHeading({ className }: { className?: string }) {
  const note = useDiscountNote();
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[17px] font-bold leading-snug lg:text-lg">Tickets</h2>
      {note && <span className="text-data text-muted-foreground lg:text-small">{note}</span>}
    </div>
  );
}

/** The Parchi student rate, for visitors who came from the Parchi app. */
function ParchiOffer() {
  const { parchiOffer } = useEventBooking();
  if (!parchiOffer) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-media border border-border px-4 py-3 first:mt-0">
      <div className="min-w-0 flex-1">
        <div className="text-small font-semibold">Parchi student rate</div>
        <div className="text-data text-muted-foreground">
          {parchiOffer.max_discount_amount != null
            ? `Up to ${rs(parchiOffer.max_discount_amount)} off · verify your Parchi ID at checkout`
            : "Verify your Parchi ID at checkout"}
        </div>
      </div>
      <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-data font-bold text-primary-foreground">
        {parchiOffer.discount_type === "fixed"
          ? `${rs(parchiOffer.discount_value)} off`
          : `${parchiOffer.discount_value}% off`}
      </span>
    </div>
  );
}

function QrNote() {
  const { ticketTypes } = useEventBooking();
  if (!ticketTypes.some((t) => !t.ticket_url)) return null;
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-data text-muted-foreground">
      <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
      Your QR works once, so don&apos;t share it.
    </p>
  );
}

/**
 * Phones: one day at a time. With two or three groups ("Day 1", "Day 2")
 * they become pink day tabs with a count of picked tickets; otherwise the
 * groups stack. Each tier has an always-on − qty + stepper.
 */
export function EventTicketsPhone({ className }: { className?: string }) {
  const { selected } = useEventBooking();
  const groups = useTicketGroups();
  const tabs = groups.length >= 2 && groups.length <= 3;
  const [activeKey, setActiveKey] = useState(groups[0]?.key);
  const active = groups.find((g) => g.key === activeKey) ?? groups[0];

  if (!active) return null;

  return (
    <section id="tickets" aria-label="Tickets" className={cn("scroll-mt-24", className)}>
      {!tabs && <TicketsHeading />}
      <ParchiOffer />

      {tabs ? (
        <>
          <div role="tablist" aria-label="Tickets by day" className="mt-3 flex rounded-full bg-muted p-[3px] first:mt-0">
            {groups.map((g) => {
              const on = g.key === active.key;
              const count = pickedIn(g, selected);
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveKey(g.key)}
                  className={cn(
                    "flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-small font-semibold transition-colors duration-fast",
                    on ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  <span className="truncate">
                    {g.name}
                    {g.dateLabel && ` · ${g.dateLabel.split(" ").slice(0, 2).join(" ")}`}
                  </span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-label font-bold tabular-nums",
                        on ? "bg-background text-primary" : "bg-foreground text-background",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <ul role="tabpanel" aria-label={active.name} className="mt-1">
            {active.tickets.map((t) => (
              <EventTicketRow key={t.id} ticket={t} control="stepper" className="border-b border-border py-2" />
            ))}
          </ul>
        </>
      ) : (
        groups.map((g) => (
          <div key={g.key} role="group" aria-label={g.name} className="mt-3">
            {groups.length > 1 && (
              <h3 className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {g.name}
                {g.dateLabel && ` · ${g.dateLabel}`}
              </h3>
            )}
            <ul>
              {g.tickets.map((t) => (
                <EventTicketRow key={t.id} ticket={t} control="stepper" className="border-b border-border py-2" />
              ))}
            </ul>
          </div>
        ))
      )}

      <QrNote />
    </section>
  );
}

function DaySection({ group }: { group: TicketGroup }) {
  const { selected, showStudentPrice } = useEventBooking();
  const [open, setOpen] = useState(true);
  const picked = pickedIn(group, selected);
  const prices = group.tickets
    .filter((t) => !t.ticket_url && isTicketOnSale(t))
    .map((t) => ticketPricing(t, showStudentPrice).salePrice);
  const summary = picked > 0 ? `${picked} picked` : prices.length > 0 ? `From ${rs(Math.min(...prices))}` : null;

  return (
    <div className="mt-3 overflow-hidden rounded-media border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center gap-2 bg-muted pl-4 pr-3.5 text-left transition-colors duration-fast hover:bg-border"
      >
        <span className="text-[15px] font-bold">{group.name}</span>
        {group.dateLabel && <span className="text-data text-muted-foreground">{group.dateLabel}</span>}
        {summary && <span className="ml-auto text-data tabular-nums text-muted-foreground">{summary}</span>}
        <ChevronDown
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-transform duration-fast",
            !summary && "ml-auto",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul>
          {group.tickets.map((t) => (
            <EventTicketRow key={t.id} ticket={t} control="add" className="border-t border-border py-1.5 pl-4 pr-2" />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Desktop: the tickets in the sidebar. Several groups fold open and shut as
 * day sections; a single group is one bordered list. Total and Checkout sit
 * underneath.
 */
export function EventTicketsDesktop({ className }: { className?: string }) {
  const { checkout } = useEventBooking();
  const summary = useBookingSummary();
  const groups = useTicketGroups();

  return (
    <section aria-label="Tickets" className={className}>
      <TicketsHeading />
      <ParchiOffer />

      {groups.length > 1 ? (
        groups.map((g) => <DaySection key={g.key} group={g} />)
      ) : (
        <ul className="mt-3 overflow-hidden rounded-media border border-border">
          {groups[0]?.tickets.map((t) => (
            <EventTicketRow
              key={t.id}
              ticket={t}
              control="add"
              className="border-t border-border py-1.5 pl-4 pr-2 first:border-t-0"
            />
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-small text-muted-foreground">{summary.label}</span>
        <span className="text-2xl font-bold tabular-nums tracking-[-0.01em]">{summary.value}</span>
      </div>
      <button
        type="button"
        onClick={checkout}
        disabled={!summary.hasSelection}
        className={cn(
          "mt-3 h-[52px] w-full rounded-full text-body font-semibold transition-opacity duration-fast",
          summary.hasSelection ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground",
        )}
      >
        Checkout
      </button>
      <QrNote />
    </section>
  );
}
