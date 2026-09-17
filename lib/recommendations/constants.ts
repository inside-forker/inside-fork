/**
 * Tunables for the "Recommended For You" scorer. Grouped here so weight
 * changes are a one-file diff and show up clearly in review.
 *
 * `AFFINITY_K` and `EVENT_HALF_LIFE_DAYS` are priors, not measured values -
 * there isn't enough event volume yet to fit them. Revisit once
 * user_listing_events has real traffic (see Phase 2 go/no-go query).
 *
 * `openNow` is no longer a term here - "For You" hard-filters to confirmed-
 * open listings before scoring (see candidates.ts's `onlyOpen`), so there's
 * nothing left for a weighted term to differentiate. Discovery Intents still
 * scores open/closed/unknown via its own module (lib/discovery/scoring.ts)
 * and OPEN_NOW_SCORE below, which is untouched.
 */

/** Term weights before gate-based renormalisation. Must sum to 1. */
export const TERM_WEIGHTS = {
  affinity: 0.5,
  proximity: 0.25,
  quality: 0.15,
  freshness: 0.1,
} as const;

/**
 * Fallback quality score for a listing with no organic rating yet
 * (avg_rating is 0 for effectively the whole catalog right now) but that an
 * admin has already pinned via the same `top_rated_pinned` flag "Top Rated by
 * Insiders" uses for its own cold start. Kept below 1.0 so a genuine 5-star
 * organic rating, once real reviews exist, can still outrank a manual pin.
 */
export const TOP_RATED_PINNED_QUALITY_SCORE = 0.9;

/** exp(-distanceMeters / GEO_D0) - Karachi is ~3,500 km^2, so this is in meters. */
export const GEO_D0_METERS = 3000;

/** exp(-ageDays / FRESHNESS_HALF_LIFE_DAYS) for the freshness term. */
export const FRESHNESS_HALF_LIFE_DAYS = 90;

export const OPEN_NOW_SCORE = {
  open: 1.0,
  unknown: 0.5,
  closed: 0.15,
} as const;

/**
 * aff(u,c) = alpha * learned(u,c) + (1 - alpha) * T(c); alpha = n / (n + K).
 * Lowered from 20: at ~15 active users, almost nobody reached the 20
 * non-impression interactions needed for their own taste to meaningfully
 * outweigh the generic time-of-day prior. At K=5, alpha=0.5 by n=5 and
 * alpha=0.8 by n=20 - personal history now dominates much sooner, while a
 * brand-new actor (n=0) still gets alpha=0, unchanged.
 */
export const AFFINITY_K = 5;

/** Blend of max vs mean per-category affinity across a listing's categories. */
export const AFFINITY_MAX_WEIGHT = 0.7;
export const AFFINITY_MEAN_WEIGHT = 0.3;

/** Half-life (days) for exponential recency decay of user_listing_events rows. */
export const EVENT_HALF_LIFE_DAYS = 45;

/** Event type -> affinity weight. Impressions are excluded (fatigue/CTR only). */
export const EVENT_WEIGHTS: Record<string, number> = {
  view: 1.0,
  view_long: 2.0,
  rec_click: 3.0,
  contact_click: 4.0,
  call_click: 4.0,
  directions_click: 4.0,
  menu_open: 4.0,
  share: 4.0,
  favorite: 5.0,
  unfavorite: -5.0,
  rec_impression: 0.0,
};

/** score *= (1 - FATIGUE_STRENGTH * seenScore). seenScore is 0 until Phase 2 data exists. */
export const FATIGUE_STRENGTH = 0.8;

/** Anti-staleness jitter, +/- this fraction of score, reseeded every 6h. */
export const JITTER_AMPLITUDE = 0.02;
export const JITTER_WINDOW_HOURS = 6;

/** MMR diversity re-rank - searches the full candidate set, no top-N slice (see scoring.ts's diversify). */
export const MMR_LAMBDA = 0.35;
export const MMR_MAX_PER_SUBCATEGORY = 2;
export const MMR_MAX_PER_PARENT = 3;

/** Timezone every time-of-day computation is anchored to (no DST). */
export const RECS_TIMEZONE = "Asia/Karachi";

/**
 * Tunables for the events "for you" scorer (lib/recommendations/event-scoring.ts).
 * Same priors-not-measured caveat as the listings tunables above.
 */

/** Term weights before gate-based renormalisation. Must sum to 1. */
export const EVENT_TERM_WEIGHTS = {
  category: 0.5,
  soonness: 0.4,
  /** Gated out entirely when a candidate has no lat/lng. */
  proximity: 0.1,
} as const;

/** exp(-hoursUntilStart / EVENT_SOON_HALF_LIFE_HOURS) - an event ~36h out
 * scores half of one starting now. */
export const EVENT_SOON_HALF_LIFE_HOURS = 36;
