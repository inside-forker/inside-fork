/**
 * Discovery Intents: a fixed, product-curated menu of "what should I do
 * right now" modes (Date Night, Late Night, ...), layered on top of the
 * existing recommendation candidate pool (lib/recommendations/candidates.ts)
 * with a per-intent ranking algorithm instead of the "Recommended For You"
 * affinity blend (lib/recommendations/scoring.ts's scoreCandidate).
 *
 * This is a code table, not a DB table, on purpose - same call the repo
 * already made for lib/recommendations/time-intent.ts's category-boost
 * RULES: there are ~8 of these, they're a product/IA decision reviewed like
 * code (not admin-toggled data), and the weights only mean anything paired
 * with the scorer in lib/discovery/scoring.ts, so a DB row would either
 * duplicate logic that has to live in code anyway or need its own rules
 * engine to be a complete substitute. See the PR description for the full
 * "why no table" writeup.
 *
 * Every `categorySlugs`/`categoryBoost` slug below is real, currently-
 * published inventory - verified live against `listing_categories` on
 * 2026-08-05 (counts ranged from ~700 for restaurants-cafes down to 8 for
 * parks-outdoor-spaces; every intent's category union clears 300+ published
 * listings city-wide, so none of them starve under normal conditions).
 * Slugs resolve to category ids at request time via
 * lib/recommendations/time-intent.ts's getCategorySlugIdMap() - the same
 * cached slug->id lookup the time-of-day boosts already use - so renaming a
 * slug in the taxonomy is a one-place fix, not a hunt through this file.
 */

export type DiscoveryIntentSlug =
  | "date-night"
  | "friends-visiting"
  | "late-night"
  | "need-peace"
  | "one-hour-free"
  | "budget-friendly"
  | "something-new"
  | "family-time";

/**
 * Relative term weights, renormalized over whatever signals are actually
 * available for a given candidate (same "gate off missing data, don't score
 * it 0" rule lib/recommendations/scoring.ts's scoreCandidate already uses).
 * Must sum to 1 - see lib/discovery/scoring.ts for how each term is computed.
 */
export type DiscoveryWeights = {
  /** How well the listing's categories match this intent's theme (0 when categorySlugs is empty - "no restriction" has no fit concept). */
  categoryFit: number;
  /** exp(-distanceMeters / GEO_D0_METERS); 0 weight or missing coords gates this off. */
  proximity: number;
  /** Open now / closed / unknown, via the shared OPEN_NOW_SCORE map. */
  openNow: number;
  /** exp(-ageDays / FRESHNESS_HALF_LIFE_DAYS) - how recently the listing was added. */
  freshness: number;
  /** avg_rating normalized to [0,1]. */
  rating: number;
  /** Only meaningful when budgetCeilingPkr is set; gated off for every other intent (price data covers ~3% of listings today, so this is a bonus signal, never a hard requirement). */
  price: number;
};

export type DiscoveryIntentConfig = {
  slug: DiscoveryIntentSlug;
  label: string;
  subtitle: string;
  /** Lucide icon name (matches the convention categories.icon_name already uses) - presentational only. */
  iconName: string;
  /** Leaf category slugs this intent draws from. Empty array = no restriction (e.g. "Something New" is intentionally city-wide). */
  categorySlugs: string[];
  /**
   * Hard exclude: drop any candidate that has ≥1 of these category ids,
   * even if it also matches an allowed slug (e.g. a burger joint dual-tagged
   * restaurants-cafes + fast-food must not surface on Date Night).
   */
  excludeCategorySlugs?: string[];
  /** Per-slug category-fit multiplier in [0,1]; a matched slug missing from this map uses DEFAULT_CATEGORY_BOOST (see scoring.ts). */
  categoryBoost?: Partial<Record<string, number>>;
  weights: DiscoveryWeights;
  /**
   * Hard filter: exclude candidates *known* to be closed right now. Missing
   * hours data (openState null) is never excluded - same rule the recs
   * engine already applies. Off for intents where forward-looking browsing
   * is legitimate (Friends Visiting, Budget Friendly, Something New, Family
   * Time); on for the "right now" intents where a closed result is useless.
   */
  requireOpenNow?: boolean;
  /**
   * Hard filter, Late Night only: candidate must have a *confirmed*
   * late-closing schedule (candidates.ts's computeClosesLate). Unlike
   * requireOpenNow, this excludes candidates with no hours data at all,
   * because "stays open late" is the entire premise of the intent, not a
   * nice-to-have signal.
   */
  requireClosesLate?: boolean;
  /** Hard cap on distanceMeters when coords are known; no effect when they aren't (proximity gates off the same way it does for scoring). */
  maxDistanceMeters?: number;
  /** PKR. Listings at/under this get full price-term credit; above it decays via the same exp() shape the proximity term uses. */
  budgetCeilingPkr?: number;
  /** Surface a small "happening soon" events slice in meta.events (lib/discovery/events.ts) - only for intents where events are actually part of the theme. */
  includeEvents?: boolean;
};

/**
 * Weights must sum to 1 across each row (categoryFit + proximity + openNow +
 * freshness + rating + price) - verified for all eight by
 * scripts/discovery-fixture-eval.ts, run it after editing any row here.
 */
export const DISCOVERY_INTENTS: DiscoveryIntentConfig[] = [
  {
    slug: "date-night",
    label: "Date Night",
    subtitle: "Romantic spots for tonight",
    iconName: "heart",
    // Aligned with outing DATE_CATEGORY_SLUGS — posh/romantic, not casual food arcs.
    categorySlugs: [
      "fine-dining-buffets",
      "cafes-coworking-spots",
      "live-music-comedy-venues",
      "restaurants-cafes",
    ],
    excludeCategorySlugs: [
      "fast-food-street-food",
      "bakeries-desserts",
      "pakistani-desi-cuisine",
      "cinemas-amusement-parks",
      "gaming-lounges-arcades",
    ],
    categoryBoost: {
      "fine-dining-buffets": 1.0,
      "live-music-comedy-venues": 0.95,
      "cafes-coworking-spots": 0.85,
      "restaurants-cafes": 0.45,
    },
    // Rating-led: date night should feel dressier than "open now nearby".
    // Open-now stays a soft signal only — hard-requiring it at 4pm collapses
    // the pool to lunch/kabab spots and starves fine dining.
    weights: {
      categoryFit: 0.35,
      proximity: 0.1,
      openNow: 0.15,
      freshness: 0,
      rating: 0.4,
      price: 0,
    },
    includeEvents: true,
  },
  {
    slug: "friends-visiting",
    label: "Friends Visiting",
    subtitle: "Impress out-of-town guests",
    iconName: "users",
    // Places to eat + hang — never tour agencies / travel booking shops.
    categorySlugs: [
      "entertainment-recreation",
      "cinemas-amusement-parks",
      "live-music-comedy-venues",
      "fine-dining-buffets",
      "restaurants-cafes",
      "cafes-coworking-spots",
      "shopping-malls-outlets",
      "bakeries-desserts",
    ],
    excludeCategorySlugs: ["travel-tourism"],
    categoryBoost: {
      "entertainment-recreation": 1.0,
      "cinemas-amusement-parks": 0.95,
      "live-music-comedy-venues": 0.9,
      "fine-dining-buffets": 0.85,
      "shopping-malls-outlets": 0.7,
      "cafes-coworking-spots": 0.65,
      "restaurants-cafes": 0.55,
      "bakeries-desserts": 0.45,
    },
    // Rating dominant: what would make Karachi look good for guests.
    weights: { categoryFit: 0.3, proximity: 0.15, openNow: 0.2, freshness: 0, rating: 0.35, price: 0 },
    includeEvents: true,
  },
  {
    slug: "late-night",
    label: "Late Night",
    subtitle: "Open when the city winds down",
    iconName: "moon",
    categorySlugs: [
      "pakistani-desi-cuisine",
      "fast-food-street-food",
      "restaurants-cafes",
      "juice-bars-beverages",
      "pharmacies-medical-stores",
      "bakeries-desserts",
    ],
    categoryBoost: {
      "pakistani-desi-cuisine": 1.0,
      "fast-food-street-food": 0.9,
      "restaurants-cafes": 0.6,
      "juice-bars-beverages": 0.6,
      "pharmacies-medical-stores": 0.5,
      "bakeries-desserts": 0.5,
    },
    weights: { categoryFit: 0.25, proximity: 0.25, openNow: 0.4, freshness: 0, rating: 0.1, price: 0 },
    requireOpenNow: true,
    requireClosesLate: true,
  },
  {
    slug: "need-peace",
    label: "Need Peace",
    subtitle: "Quiet spots to slow down",
    iconName: "wind",
    categorySlugs: ["parks-outdoor-spaces", "salons-spas", "cafes-coworking-spots", "bakeries-desserts"],
    categoryBoost: {
      "parks-outdoor-spaces": 1.0,
      "salons-spas": 0.9,
      "cafes-coworking-spots": 0.85,
      "bakeries-desserts": 0.4,
    },
    weights: { categoryFit: 0.3, proximity: 0.15, openNow: 0.2, freshness: 0, rating: 0.35, price: 0 },
    requireOpenNow: true,
  },
  {
    slug: "one-hour-free",
    label: "One Hour Free",
    subtitle: "Quick things nearby",
    iconName: "timer",
    categorySlugs: ["cafes-coworking-spots", "juice-bars-beverages", "bakeries-desserts", "fast-food-street-food", "salons-spas"],
    categoryBoost: {
      "cafes-coworking-spots": 0.9,
      "juice-bars-beverages": 0.9,
      "bakeries-desserts": 0.8,
      "fast-food-street-food": 0.7,
      "salons-spas": 0.5,
    },
    // Proximity dominant - with an hour to spend, "close" matters more than
    // "perfect fit". A tight 3km cap keeps this from suggesting a 45-minute
    // drive across the city.
    weights: { categoryFit: 0.15, proximity: 0.5, openNow: 0.3, freshness: 0, rating: 0.05, price: 0 },
    requireOpenNow: true,
    maxDistanceMeters: 3000,
  },
  {
    slug: "budget-friendly",
    label: "Budget Friendly",
    subtitle: "Great without breaking the bank",
    iconName: "wallet",
    categorySlugs: [
      "fast-food-street-food",
      "bakeries-desserts",
      "pakistani-desi-cuisine",
      "juice-bars-beverages",
      "groceries-fresh-food",
      "restaurants-cafes",
    ],
    categoryBoost: {
      "fast-food-street-food": 1.0,
      "juice-bars-beverages": 0.9,
      "bakeries-desserts": 0.8,
      "pakistani-desi-cuisine": 0.75,
      "groceries-fresh-food": 0.7,
      "restaurants-cafes": 0.4,
    },
    // Category is the dominant signal on purpose: min_price_per_person is
    // only populated on ~3% of published listings today, so it can only
    // ever be a bonus tie-breaker, never the primary ranking signal.
    weights: { categoryFit: 0.45, proximity: 0.1, openNow: 0.15, freshness: 0, rating: 0.05, price: 0.25 },
    budgetCeilingPkr: 1200,
  },
  {
    slug: "something-new",
    label: "Something New",
    subtitle: "Recently added to Karachi",
    iconName: "sparkles",
    categorySlugs: [],
    weights: { categoryFit: 0, proximity: 0.1, openNow: 0.15, freshness: 0.55, rating: 0.2, price: 0 },
    includeEvents: true,
  },
  {
    slug: "family-time",
    label: "Family Time",
    subtitle: "Fun for all ages",
    iconName: "users-round",
    categorySlugs: [
      "parks-outdoor-spaces",
      "cinemas-amusement-parks",
      "entertainment-recreation",
      "restaurants-cafes",
      "bakeries-desserts",
    ],
    excludeCategorySlugs: ["travel-tourism"],
    categoryBoost: {
      "parks-outdoor-spaces": 1.0,
      "cinemas-amusement-parks": 0.95,
      "entertainment-recreation": 0.9,
      "restaurants-cafes": 0.55,
      "bakeries-desserts": 0.5,
    },
    weights: { categoryFit: 0.3, proximity: 0.25, openNow: 0.2, freshness: 0, rating: 0.25, price: 0 },
  },
];

const BY_SLUG = new Map<string, DiscoveryIntentConfig>(DISCOVERY_INTENTS.map((intent) => [intent.slug, intent]));

export function listDiscoveryIntents(): DiscoveryIntentConfig[] {
  return DISCOVERY_INTENTS;
}

export function getDiscoveryIntent(slug: string): DiscoveryIntentConfig | null {
  return BY_SLUG.get(slug) ?? null;
}
