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
 * SQL for a tier's student price: the event's Parchi % off (rounded to whole
 * rupees) applies to every ticket; a ticket's own Parchi price is used only
 * when the event has no %. NULL unless the event's Parchi toggle is on. The
 * one definition shared by every query and by create_booking_atomic (keep
 * the migration in step).
 */
export function studentPriceSql(tt = "tt", e = "e"): string {
  return `(CASE WHEN ${e}.parchi_enabled THEN
    CASE WHEN ${e}.parchi_discount_percent > 0
      THEN round(${tt}.price * (100 - ${e}.parchi_discount_percent) / 100)
      ELSE ${tt}.parchi_price END END)`;
}

/**
 * Per-ticket student price on an event with the Parchi toggle on
 * (`events.parchi_enabled`). Everyone gets it: Inside Karachi visitors
 * automatically, Parchi-app visitors after verifying. Null when the tier has
 * no discount. Same rule as create_booking_atomic. `parchi_price` here is the
 * effective student price (studentPriceSql), not the raw column.
 */
export function tierStudentPrice(ticket: {
  price: number;
  parchi_price?: number | null;
}): number | null {
  const p = ticket.parchi_price;
  return p != null && p >= 0 && p < ticket.price ? p : null;
}

/** Rupees off one ticket of this tier (0 when it has no student price). */
export function tierStudentDiscount(ticket: {
  price: number;
  parchi_price?: number | null;
}): number {
  const p = tierStudentPrice(ticket);
  return p == null ? 0 : ticket.price - p;
}

/** Discount on a cart: per-tier rupees off times quantity. */
export function tiersStudentDiscount(
  items: Array<{ price: number; parchi_price?: number | null; quantity: number }>,
): number {
  return items.reduce((sum, i) => sum + tierStudentDiscount(i) * i.quantity, 0);
}

/**
 * The headline offer for banners: the biggest % off across the event's tiers
 * ("Up to 50% off"). Null when no tier has a student price.
 */
export function tiersHeadlineOffer(
  tickets: Array<{ price: number; parchi_price?: number | null }>,
): ParchiOffer | null {
  let best = 0;
  for (const t of tickets) {
    const off = tierStudentDiscount(t);
    if (off > 0 && t.price > 0) best = Math.max(best, (off / t.price) * 100);
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
