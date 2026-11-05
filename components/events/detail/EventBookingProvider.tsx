"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event, TicketType } from "@/types/events.types";
import type { ParchiOffer } from "@/lib/parchi/discount";
import { useCartStore } from "@/lib/context/cartStore";
import { useArrivedFromParchi } from "@/lib/parchi/prefill";
import {
  isTicketOnSale,
  ticketPricing,
  ticketUnavailable,
} from "@/lib/events/ticket-pricing";

interface BookingContext {
  event: Event;
  ticketTypes: TicketType[];
  /** The event's Parchi offer, only for Parchi-app arrivals; else null. */
  parchiOffer: ParchiOffer | null;
  /** Parchi toggle on and the visitor came from the Parchi app. */
  showStudentPrice: boolean;
  selected: Record<number, number>;
  setQuantity: (ticketId: number, quantity: number) => void;
  totalTickets: number;
  /** Total at the prices shown on the tiles (student prices for Parchi arrivals). */
  totalPrice: number;
  /** Cheapest tier that can be bought, for "From Rs …"; null when none can. */
  fromPrice: number | null;
  /** Why nothing can be bought ("Sold out", "On sale 10 Nov"); null while something can. */
  unavailableLabel: string | null;
  checkout: () => void;
  /** Bring the ticket tiles into view. */
  showTickets: () => void;
}

const Ctx = createContext<BookingContext | null>(null);

export function useEventBooking(): BookingContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEventBooking must be used inside EventBookingProvider");
  return ctx;
}

/** Tiers that lead somewhere: on sale here, or sold on the organizer's site. */
function isBuyable(ticket: TicketType): boolean {
  return Boolean(ticket.ticket_url) || isTicketOnSale(ticket);
}

/**
 * Ticket selection shared by the ticket tiles, the desktop total and the
 * phone booking bar.
 */
export function EventBookingProvider({
  event,
  ticketTypes,
  parchiOffer,
  children,
}: {
  event: Event;
  ticketTypes: TicketType[];
  parchiOffer: ParchiOffer | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { addItem, clearCart } = useCartStore();
  const arrivedFromParchi = useArrivedFromParchi();
  const showStudentPrice = Boolean(parchiOffer) && arrivedFromParchi;
  const [selected, setSelected] = useState<Record<number, number>>({});

  const setQuantity = useCallback((ticketId: number, quantity: number) => {
    setSelected((prev) => ({ ...prev, [ticketId]: Math.max(0, quantity) }));
  }, []);

  const { totalTickets, totalPrice } = useMemo(() => {
    let count = 0;
    let price = 0;
    for (const [id, qty] of Object.entries(selected)) {
      const ticket = ticketTypes.find((t) => t.id === Number(id));
      if (!ticket || qty <= 0) continue;
      count += qty;
      price += ticketPricing(ticket, showStudentPrice).salePrice * qty;
    }
    return { totalTickets: count, totalPrice: price };
  }, [selected, ticketTypes, showStudentPrice]);

  const fromPrice = useMemo(() => {
    const prices = ticketTypes
      .filter(isBuyable)
      .map((t) => ticketPricing(t, showStudentPrice).salePrice);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [ticketTypes, showStudentPrice]);

  const unavailableLabel = useMemo(() => {
    if (ticketTypes.length === 0 || ticketTypes.some(isBuyable)) return null;
    const reasons = ticketTypes.map((t) => ticketUnavailable(t)).filter((r) => r != null);
    const soon = ticketTypes
      .filter((t) => ticketUnavailable(t)?.kind === "soon")
      .sort((a, b) => new Date(a.sale_starts_at).getTime() - new Date(b.sale_starts_at).getTime());
    if (soon.length > 0) return ticketUnavailable(soon[0])!.label;
    if (reasons.length > 0 && reasons.every((r) => r.kind === "ended")) return "Sale ended";
    return "Sold out";
  }, [ticketTypes]);

  const checkout = useCallback(() => {
    clearCart();
    for (const [id, quantity] of Object.entries(selected)) {
      if (quantity <= 0) continue;
      const ticket = ticketTypes.find((t) => t.id === Number(id));
      if (!ticket) continue;
      addItem({
        ticketTypeId: ticket.id,
        eventId: event.id,
        eventName: event.name,
        ticketName: ticket.name,
        price: ticket.price,
        quantity,
        maxQuantity: ticket.quantity_available || undefined,
      });
    }
    router.push("/checkout");
  }, [addItem, clearCart, event.id, event.name, router, selected, ticketTypes]);

  const showTickets = useCallback(() => {
    document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const value = useMemo<BookingContext>(
    () => ({
      event,
      ticketTypes,
      parchiOffer: showStudentPrice ? parchiOffer : null,
      showStudentPrice,
      selected,
      setQuantity,
      totalTickets,
      totalPrice,
      fromPrice,
      unavailableLabel,
      checkout,
      showTickets,
    }),
    [
      event,
      ticketTypes,
      parchiOffer,
      showStudentPrice,
      selected,
      setQuantity,
      totalTickets,
      totalPrice,
      fromPrice,
      unavailableLabel,
      checkout,
      showTickets,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export interface BookingSummary {
  /** "3 tickets", "1 ticket · Parchi rate", "From" or "Tickets". */
  label: string;
  /** "Rs 10,497", or why nothing can be bought ("Sold out"). */
  value: string;
  hasSelection: boolean;
  /** Something can still be bought. */
  canBuy: boolean;
}

export function useBookingSummary(): BookingSummary {
  const { totalTickets, totalPrice, fromPrice, unavailableLabel, showStudentPrice } = useEventBooking();
  if (totalTickets > 0) {
    const count = `${totalTickets} ticket${totalTickets === 1 ? "" : "s"}`;
    return {
      label: showStudentPrice ? `${count} · Parchi rate` : count,
      value: rupees(totalPrice),
      hasSelection: true,
      canBuy: true,
    };
  }
  if (fromPrice != null) {
    return { label: "From", value: rupees(fromPrice), hasSelection: false, canBuy: true };
  }
  return { label: "Tickets", value: unavailableLabel ?? "Sold out", hasSelection: false, canBuy: false };
}

function rupees(amount: number): string {
  return `Rs ${amount.toLocaleString("en-US")}`;
}
