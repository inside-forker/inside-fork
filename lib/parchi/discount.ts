/** Pure Parchi discount helpers - safe to import from client components. */

// Parchi's own brand colours (sampled from their artwork), for anything that
// should read as "a Parchi offer" at a glance.
export const PARCHI_BLUE = "#0069DB";
export const PARCHI_YELLOW = "#FDF12A";

export interface ParchiOffer {
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount_amount: number | null;
}

/**
 * SQL for a tier's student price:
 * - If the ticket has an explicit parchi_price, use it.
 * - Otherwise, apply the event's Parchi % off to the standard list price
 *   (COALESCE(parchi_original_price, original_price, price)).
 * NULL unless the event's Parchi toggle is on.
 */
export function studentPriceSql(tt = "tt", e = "e"): string {
  return `(CASE WHEN ${e}.parchi_enabled THEN
    COALESCE(${tt}.parchi_price,
      CASE WHEN ${e}.parchi_discount_percent > 0
        THEN round(COALESCE(${tt}.parchi_original_price, ${tt}.original_price, ${tt}.price) * (100 - ${e}.parchi_discount_percent) / 100)
        ELSE NULL END) END)`;
}

/**
 * Per-ticket student price on an event with the Parchi toggle on
 * (`events.parchi_enabled`). Parchi-app visitors receive this rate after verifying.
 * Compares against the standard list price (parchi_original_price ?? original_price ?? price)
 * so that any native Inside discount does not interfere with the Parchi rate.
 */
export function tierStudentPrice(ticket: {
  price: number;
  original_price?: number | null;
  parchi_price?: number | null;
  parchi_original_price?: number | null;
}): number | null {
  const p = ticket.parchi_price;
  const base = ticket.parchi_original_price ?? ticket.original_price ?? ticket.price;
  return p != null && p >= 0 && p < base ? p : null;
}

/** Rupees off one ticket of this tier (0 when it has no student price). */
export function tierStudentDiscount(ticket: {
  price: number;
  original_price?: number | null;
  parchi_price?: number | null;
  parchi_original_price?: number | null;
}): number {
  const p = tierStudentPrice(ticket);
  const base = ticket.parchi_original_price ?? ticket.original_price ?? ticket.price;
  return p == null ? 0 : base - p;
}

/** Discount on a cart: per-tier rupees off times quantity. */
export function tiersStudentDiscount(
  items: Array<{
    price: number;
    original_price?: number | null;
    parchi_price?: number | null;
    parchi_original_price?: number | null;
    quantity: number;
  }>,
): number {
  return items.reduce((sum, i) => sum + tierStudentDiscount(i) * i.quantity, 0);
}

/**
 * The headline offer for banners: the biggest % off across the event's tiers
 * ("Up to 50% off"). Null when no tier has a student price and no event % is configured.
 */
export function tiersHeadlineOffer(
  tickets: Array<{
    price: number;
    original_price?: number | null;
    parchi_price?: number | null;
    parchi_original_price?: number | null;
  }>,
  eventPercent?: number | null,
): ParchiOffer | null {
  let best = 0;
  for (const t of tickets) {
    const off = tierStudentDiscount(t);
    const base = t.parchi_original_price ?? t.original_price ?? t.price;
    if (off > 0 && base > 0) best = Math.max(best, (off / base) * 100);
  }
  if (best <= 0 && eventPercent != null && eventPercent > 0) {
    best = eventPercent;
  }
  if (best <= 0) return null;
  return {
    discount_type: "percentage",
    discount_value: Math.round(best),
    max_discount_amount: null,
  };
}

/** Same math as claim_parchi_discount (and the coupon RPC branch). */
export function computeParchiDiscount(offer: ParchiOffer, subtotal: number): number {
  let discount =
    offer.discount_type === "percentage"
      ? Math.round(subtotal * offer.discount_value) / 100
      : offer.discount_value;
  if (offer.discount_type === "percentage" && offer.max_discount_amount != null) {
    discount = Math.min(discount, offer.max_discount_amount);
  }
  return Math.min(discount, subtotal);
}

/** "20% off (up to PKR 1,000)" / "PKR 500 off". */
export function describeParchiOffer(offer: ParchiOffer): string {
  if (offer.discount_type === "fixed") {
    return `PKR ${offer.discount_value.toLocaleString()} off`;
  }
  const cap =
    offer.max_discount_amount != null
      ? ` (up to PKR ${offer.max_discount_amount.toLocaleString()})`
      : "";
  return `${offer.discount_value}% off${cap}`;
}
