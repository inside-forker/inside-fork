/**
 * Maps listing category slug/name → the six Discounts UI buckets used by the
 * mobile deals catalog (`dining` … `travel`). Cafes fold into dining.
 */

export type MobileDealCategory =
  | "dining"
  | "shopping"
  | "beauty"
  | "hotels"
  | "entertainment"
  | "travel";

const SLUG_TO_DEAL_CATEGORY: Record<string, MobileDealCategory> = {
  // Dining
  "food-dining": "dining",
  "restaurants-cafes": "dining",
  "pakistani-desi-cuisine": "dining",
  "cafes-coworking-spots": "dining",
  "fast-food-street-food": "dining",
  "bakeries-desserts": "dining",
  "juice-bars-beverages": "dining",
  "fine-dining-buffets": "dining",
  "groceries-fresh-food": "dining",

  // Shopping
  "shopping-fashion": "shopping",
  "shopping-malls-outlets": "shopping",
  "apparel-clothing": "shopping",
  "footwear-bags": "shopping",
  "jewelry-watches": "shopping",
  "electronics-gadgets": "shopping",
  "home-living": "shopping",
  "books-stationery": "shopping",
  "ecommerce-online-stores": "shopping",

  // Beauty
  "beauty-personal-care": "beauty",
  "salons-spas": "beauty",
  "cosmetics-fragrances": "beauty",
  "health-wellness": "beauty",
  "pharmacies-medical-stores": "beauty",

  // Hotels / stays (name-match often; keep common slugs if present)
  hotels: "hotels",
  "hotels-stays": "hotels",
  "hotels-lodging": "hotels",
  lodging: "hotels",
  resorts: "hotels",

  // Entertainment / fitness
  "services-living": "entertainment",
  "entertainment-recreation": "entertainment",
  "gaming-lounges-arcades": "entertainment",
  "live-music-comedy-venues": "entertainment",
  "parks-outdoor-spaces": "entertainment",
  "cinemas-amusement-parks": "entertainment",
  "padel-cricket-futsal-clubs": "entertainment",
  "gyms-fitness-centers": "entertainment",
  "fitness-sports": "entertainment",
  "swimming-pools-clubs": "entertainment",
  "yoga-martial-arts-studios": "entertainment",
  "venues-rentals": "entertainment",

  // Travel
  "travel-tourism": "travel",
  "automotive-transport-services": "travel",
};

/** Leaf / family → dining sub-filter chip labels on category drill-down. */
const SLUG_TO_SUB: Record<string, string> = {
  "cafes-coworking-spots": "Cafés",
  "fast-food-street-food": "Fast Food",
  "fine-dining-buffets": "Fine Dining",
  "pakistani-desi-cuisine": "BBQ",
  "bakeries-desserts": "Cafés",
  "juice-bars-beverages": "Cafés",
  "restaurants-cafes": "Fine Dining",
  "groceries-fresh-food": "Groceries",
};

function guessFromName(name: string | null | undefined): MobileDealCategory | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (
    /restaurant|cafe|café|dining|food|bakery|dessert|juice|bbq|grill|grocery/.test(
      n,
    )
  ) {
    return "dining";
  }
  if (
    /shop|mall|retail|apparel|clothing|boutique|fashion|footwear|jewelry|electronics|gadget/.test(
      n,
    )
  ) {
    return "shopping";
  }
  if (/salon|spa|beauty|cosmetic|wellness|barber|pharmacy|clinic/.test(n)) {
    return "beauty";
  }
  if (/hotel|stay|lodging|resort|guest house|guesthouse/.test(n)) return "hotels";
  if (/travel|tour|airline|flight|transport|airport/.test(n)) return "travel";
  if (
    /cinema|movie|entertainment|park|arcade|gaming|music|sport|gym|fitness|club|yoga|swim/.test(
      n,
    )
  ) {
    return "entertainment";
  }
  return null;
}

/**
 * Resolve Discounts category + optional dining subCategory from listing
 * category slug/name. Unmapped categories fall back to `entertainment` so
 * the deal still appears in All Deals / For You (category grid counts only
 * the six buckets).
 */
export function mapListingToDealCategory(
  slug: string | null | undefined,
  name: string | null | undefined,
): { category: MobileDealCategory; subCategory?: string } {
  const fromSlug = slug ? SLUG_TO_DEAL_CATEGORY[slug] : undefined;
  const category =
    fromSlug ?? guessFromName(name) ?? guessFromName(slug) ?? "entertainment";
  const subCategory =
    category === "dining" && slug ? SLUG_TO_SUB[slug] : undefined;
  return subCategory ? { category, subCategory } : { category };
}
