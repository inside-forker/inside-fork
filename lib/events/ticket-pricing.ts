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

export type TicketPricing =
  | { mode: "parchi"; salePrice: number; comparePrice: number | null }
  | { mode: "native"; salePrice: number; comparePrice: number | null };

/**
 * Price to show for a tier on the public event page.
 * - Parchi arrivals (showStudentPrice = true) see the Parchi student rate (e.g. 15% off)
 *   with the standard list price crossed out. Native Inside discounts do not show to Parchi visitors.
 * - Normal Inside visitors (showStudentPrice = false) see native Inside pricing: regular price,
 *   or slashed price ONLY if a native discount was explicitly configured (original_price > price).
 */
export function ticketPricing(ticket: TicketType, showStudentPrice = false): TicketPricing {
  if (showStudentPrice) {
    // Visitor arrived via Parchi link:
    // Parchi student pricing applies. Native Inside discounts must NOT show to Parchi visitors.
    const parchiComparePrice =
      ticket.parchi_original_price && ticket.parchi_original_price > 0
        ? ticket.parchi_original_price
        : ticket.original_price && ticket.original_price > ticket.price
          ? ticket.original_price
          : ticket.price;

    const studentPrice = tierStudentPrice(ticket);

    if (studentPrice != null && studentPrice < parchiComparePrice) {
      return {
        mode: "parchi",
        salePrice: studentPrice,
        comparePrice: parchiComparePrice,
      };
    }

    // Fallback if no student price configured: show standard compare price without native inside discount
    return {
      mode: "native",
      salePrice: parchiComparePrice,
      comparePrice: null,
    };
  }

  // Regular Inside Karachi visitor (did NOT arrive from Parchi link):
  // Never show Parchi student discount or Parchi comparison prices.
  // If original_price matches parchi_original_price and price matches parchi_price,
  // this is a Parchi discount and must NOT be shown as a slashed price to normal Inside users.
  if (
    ticket.parchi_original_price != null &&
    ticket.parchi_price != null &&
    ticket.original_price === ticket.parchi_original_price &&
    ticket.price === ticket.parchi_price
  ) {
    return {
      mode: "native",
      salePrice: ticket.parchi_original_price,
      comparePrice: null,
    };
  }

  // ONLY show a discount if native Inside discount was explicitly configured (original_price > price).
  const hasNativeDiscount =
    ticket.original_price != null && ticket.original_price > ticket.price;

  return {
    mode: "native",
    salePrice: ticket.price,
    comparePrice: hasNativeDiscount ? (ticket.original_price ?? null) : null,
  };
}
