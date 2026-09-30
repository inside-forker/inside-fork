/** Pure Parchi discount helpers - safe to import from client components. */

export interface ParchiOffer {
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount_amount: number | null;
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
