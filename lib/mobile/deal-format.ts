/**
 * Pure formatting helpers for the deal-first mobile feed. `deals.discount_value`
 * is free text entered by admins/scrapers ("50%", "BOGO", "Rs 500", ...) - these
 * derive a display label and a sortable weight from it, matching the ad-hoc
 * `/(\d+)(?=%)/` percent-parsing convention already used in
 * `lib/listings/query-paginated-listings.ts` for the website's "Active Deals" filter.
 */

export function formatDiscount(value: string | null): {
  label: string;
  weight: number;
} {
  if (!value || !value.trim()) return { label: "Special Offer", weight: 0 };

  const percentMatch = value.match(/(\d+)\s*%/);
  if (percentMatch) {
    return { label: `${percentMatch[1]}%`, weight: Number(percentMatch[1]) };
  }

  if (/bogo|buy\s*one\s*get\s*one/i.test(value)) {
    return { label: "BOGO", weight: 60 };
  }

  const flatMatch = value.match(/rs\.?\s*([\d,]+)/i);
  if (flatMatch) {
    return { label: `Rs ${flatMatch[1]}`, weight: 10 };
  }

  return { label: value, weight: 0 };
}

/** Days remaining until `endDate`, rounded up so "expires later today" still
 * reads as 1 day left rather than 0. `null` when there's no expiry. */
export function daysUntil(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const diffMs = end - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

/** Normalizes a card display name for exact-match comparison (lowercase,
 * collapsed whitespace, punctuation stripped) - used to match a scraped
 * deal's card name text against `card_variants.card_name`. */
export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
