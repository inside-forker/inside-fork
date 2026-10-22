/** Prismfest student auto-discount (Inside Karachi logged-in, non-Parchi channel). */
export const PRISMFEST_SLUG = "prismfest-26";

export function isPrismfestSlug(slug: string | null | undefined): boolean {
  return (slug ?? "").trim().toLowerCase() === PRISMFEST_SLUG;
}

/** Organiser's venue layout (same artwork as on Ticketwala), shown above the tickets. */
export const PRISMFEST_VENUE_MAP = "/events/prismfest-26-venue-map.jpg";

/** Original pre-discount prices shown crossed out matching Ticketwala. */
export const PRISMFEST_ORIGINAL_PRICES: Record<string, number> = {
  "prism fam": 6000,
  "prism her": 6000,
  "prism front": 12000,
  "prism exclusive": 16000,
};

export function getPrismfestOriginalPrice(ticketName: string): number | null {
  const lower = ticketName.toLowerCase();
  for (const [key, price] of Object.entries(PRISMFEST_ORIGINAL_PRICES)) {
    if (lower.includes(key)) return price;
  }
  return null;
}

/** Discounted prices for Inside Karachi / verified Parchi users. */
export const PRISMFEST_DISCOUNTED_PRICES: Record<string, number> = {
  "prism fam": 2999,
  "prism her": 4800,
  "prism front": 5999,
  "prism exclusive": 9999,
};

export function getPrismfestDiscountedPrice(ticketName: string): number | null {
  const lower = ticketName.toLowerCase();
  for (const [key, price] of Object.entries(PRISMFEST_DISCOUNTED_PRICES)) {
    if (lower.includes(key)) return price;
  }
  return null;
}

export function getPrismfestTicketDiscount(
  ticketName: string,
  basePrice: number,
): number {
  const discounted = getPrismfestDiscountedPrice(ticketName);
  if (discounted != null && discounted < basePrice) {
    return basePrice - discounted;
  }
  return 0;
}

