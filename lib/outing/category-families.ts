/**
 * Category families used by outing answer contracts (allow / forbid sets).
 * Slugs map to coarse families so golden fixtures stay stable if leaf names shift.
 */

export type CategoryFamily =
  | "entertainment"
  | "gaming"
  | "live_music"
  | "parks"
  | "cinema"
  | "restaurants"
  | "cafes"
  | "fast_food"
  | "bakeries"
  | "fine_dining"
  | "shopping"
  | "self_care"
  | "sports"
  | "tourism"
  | "other";

const SLUG_TO_FAMILY: Record<string, CategoryFamily> = {
  "entertainment-recreation": "entertainment",
  "gaming-lounges-arcades": "gaming",
  "live-music-comedy-venues": "live_music",
  "parks-outdoor-spaces": "parks",
  "cinemas-amusement-parks": "cinema",
  "restaurants-cafes": "restaurants",
  "pakistani-desi-cuisine": "restaurants",
  "cafes-coworking-spots": "cafes",
  "fast-food-street-food": "fast_food",
  "bakeries-desserts": "bakeries",
  "juice-bars-beverages": "bakeries",
  "fine-dining-buffets": "fine_dining",
  "shopping-malls-outlets": "shopping",
  "apparel-clothing": "shopping",
  "salons-spas": "self_care",
  "cosmetics-fragrances": "self_care",
  "padel-cricket-futsal-clubs": "sports",
  "gyms-fitness-centers": "sports",
  "travel-tourism": "tourism",
  "venues-rentals": "entertainment",
};

export const FOOD_FAMILIES: CategoryFamily[] = [
  "restaurants",
  "cafes",
  "fast_food",
  "bakeries",
  "fine_dining",
];

/** Diversity buckets for mixed plans (1 restaurant + 1 cafe + hangout…). */
export type OutingDiversityBucket =
  | "meal"
  | "cafe"
  | "sweet"
  | "hangout"
  | "other";

const BUCKET_CAPS: Record<OutingDiversityBucket, number> = {
  // One restaurant / fine dining / fast-food meal — not a stack of eateries
  meal: 1,
  cafe: 1,
  sweet: 1,
  hangout: 3,
  other: 2,
};

export function diversityBucketForFamily(
  family: CategoryFamily,
): OutingDiversityBucket {
  if (family === "restaurants" || family === "fine_dining" || family === "fast_food") {
    return "meal";
  }
  if (family === "cafes") return "cafe";
  if (family === "bakeries") return "sweet";
  if (
    family === "entertainment" ||
    family === "gaming" ||
    family === "live_music" ||
    family === "parks" ||
    family === "cinema" ||
    family === "sports"
  ) {
    return "hangout";
  }
  return "other";
}

export function diversityBucketCap(bucket: OutingDiversityBucket): number {
  return BUCKET_CAPS[bucket];
}

export function familyForSlug(slug: string | null | undefined): CategoryFamily {
  if (!slug) return "other";
  return SLUG_TO_FAMILY[slug] ?? "other";
}

/** Best-effort family from a display category name when slug is unknown. */
export function familyForCategoryName(
  name: string | null | undefined,
): CategoryFamily {
  if (!name) return "other";
  const n = name.toLowerCase();
  if (/fine.?dining|buffet/.test(n)) return "fine_dining";
  if (/fast.?food|street.?food|burger|pizza/.test(n)) return "fast_food";
  if (/bakery|dessert|juice|sweet/.test(n)) return "bakeries";
  if (/cafe|coffee|cowork/.test(n)) return "cafes";
  if (/restaurant|dining|cuisine|desi|food/.test(n)) return "restaurants";
  if (/gaming|arcade|snooker|bowling/.test(n)) return "gaming";
  if (/cinema|amusement|movie/.test(n)) return "cinema";
  if (/music|comedy|live/.test(n)) return "live_music";
  if (/park|outdoor/.test(n)) return "parks";
  if (/salon|spa|massage/.test(n)) return "self_care";
  if (/shop|mall|fashion/.test(n)) return "shopping";
  if (/padel|cricket|futsal|gym|sport/.test(n)) return "sports";
  if (/travel|tourism|tour|agency/.test(n)) return "tourism";
  if (/entertainment|recreation|fun/.test(n)) return "entertainment";
  return "other";
}

export const HANGOUT_CATEGORY_SLUGS = [
  "entertainment-recreation",
  "gaming-lounges-arcades",
  "cinemas-amusement-parks",
  "live-music-comedy-venues",
  "parks-outdoor-spaces",
] as const;

/** Friends visiting / impress guests — food + fun, never tour desks. */
export const FRIENDS_CATEGORY_SLUGS = [
  "entertainment-recreation",
  "cinemas-amusement-parks",
  "live-music-comedy-venues",
  "fine-dining-buffets",
  "restaurants-cafes",
  "cafes-coworking-spots",
  "shopping-malls-outlets",
] as const;

export const DATE_CATEGORY_SLUGS = [
  "fine-dining-buffets",
  "cafes-coworking-spots",
  "live-music-comedy-venues",
  "restaurants-cafes",
] as const;

export const DATE_DEMOTE_SLUGS = new Set([
  "fast-food-street-food",
  "bakeries-desserts",
  "pakistani-desi-cuisine",
]);

/** Social outing needs that must never surface travel agencies. */
export const TOURISM_EXCLUDED_NEEDS = new Set([
  "hangout",
  "friends",
  "date",
  "family",
  "activity",
]);

export const TOURISM_SLUG = "travel-tourism";

/** Gyms are not social hangouts even when miscategorized as entertainment. */
export const GYM_SLUG = "gyms-fitness-centers";

const GYM_NAME_RE =
  /\b(gym|fitness|fitnest|workout|crossfit|dumbbells?|weight.?train|personal trainer|yoga studio)\b/i;

export function isGymLikeListing(listing: {
  name?: string | null;
  description?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}): boolean {
  if (listing.category_slug === GYM_SLUG) return true;
  if (/gym|fitness/i.test(listing.category_name ?? "")) return true;
  return GYM_NAME_RE.test(
    `${listing.name ?? ""} ${listing.description ?? ""}`,
  );
}

/** Social outing needs that must never surface gyms / fitness centers. */
export const GYM_EXCLUDED_NEEDS = new Set([
  "hangout",
  "friends",
  "date",
  "family",
]);

