import type { TicketType } from "@/types/events.types";
import { tierStudentPrice } from "@/lib/parchi/discount";
import { formatEventDayMonth } from "@/lib/events/datetime";

const pkr = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
});

/** "Rs 2,500" */
export function formatPKR(amount: number): string {
  return pkr.format(amount);
}

/** On sale right now and not sold out. */
export function isTicketOnSale(ticket: TicketType, now = new Date()): boolean {
  if (new Date(ticket.sale_starts_at) > now) return false;
  if (new Date(ticket.sale_ends_at) < now) return false;
  return ticket.quantity_available === null || ticket.quantity_available > 0;
}

export type TicketUnavailable =
  | { kind: "soon"; label: string }
  | { kind: "ended"; label: string }
  | { kind: "soldout"; label: string };

/** Why a tier can't be bought ("On sale 10 Nov", "Sold out"), or null while it's on sale. */
export function ticketUnavailable(ticket: TicketType, now = new Date()): TicketUnavailable | null {
  if (new Date(ticket.sale_starts_at) > now) {
    return { kind: "soon", label: `On sale ${formatEventDayMonth(ticket.sale_starts_at)}` };
  }
  if (new Date(ticket.sale_ends_at) < now) return { kind: "ended", label: "Sale ended" };
  if (ticket.quantity_available === 0) return { kind: "soldout", label: "Sold out" };
  return null;
}

/** "15% off" for a tier with its own slashed price; null otherwise. */
export function percentOff(salePrice: number, comparePrice: number | null): string | null {
  if (!comparePrice || comparePrice <= salePrice) return null;
  const pct = Math.round(((comparePrice - salePrice) / comparePrice) * 100);
  return pct > 0 ? `${pct}% off` : null;
}

/** Most a visitor can add of one tier: per-person cap, then stock. */
export function maxSelectable(ticket: TicketType): number {
  const perPerson = ticket.max_per_person ?? 10;
  const stock =
    ticket.quantity_available === null
      ? Number.MAX_SAFE_INTEGER
      : ticket.quantity_available;
  return Math.min(perPerson, stock);
}

export type TicketPricing = {
  mode: "native";
  salePrice: number;
  comparePrice: number | null;
};

/**
 * Price to show for a tier on the public event page.
 * Returns the native purchasable ticket price (with native original_price comparison, if any).
 * Parchi student discounts are applied at checkout after 2FA verification, not baked into the public event page sale price.
 */
export function ticketPricing(ticket: TicketType): TicketPricing {
  return {
    mode: "native",
    salePrice: ticket.price,
    comparePrice:
      ticket.original_price && ticket.original_price > ticket.price
        ? ticket.original_price
        : null,
  };
}
