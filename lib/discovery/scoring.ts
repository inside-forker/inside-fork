/**
 * Ranking for Discovery Intents. Same additive weighted-term shape as
 * lib/recommendations/scoring.ts's scoreCandidate - a signal that isn't
 * available for a candidate (no coords, no hours data, unknown price) gates
 * off and the remaining weights renormalize over what's left, rather than
 * scoring the missing term as 0. What differs per intent is *which* terms
 * matter and how much (lib/discovery/intents.ts's DiscoveryWeights), plus a
 * categoryFit term in place of "Recommended For You"'s learned/time-of-day
 * affinity blend - intents are about the chosen mood, not the caller's
 * history.
 *
 * No DB access here on purpose, mirroring lib/recommendations/scoring.ts:
 * scripts/discovery-fixture-eval.ts exercises this file directly against
 * synthetic candidates.
 */
import {
  FRESHNESS_HALF_LIFE_DAYS,
  GEO_D0_METERS,
  OPEN_NOW_SCORE,
} from "@/lib/recommendations/constants";
import { jitterFor, type CandidateInput } from "@/lib/recommendations/scoring";
import { getCategorySlugIdMap } from "@/lib/recommendations/time-intent";
import type { DiscoveryIntentConfig } from "./intents";

export type DiscoveryCandidateInput = CandidateInput & {
  /** Known only for intents that use the price term (see resolveIntentCategoryFilter's caller) - undefined/null is "unknown", not "free". */
  minPricePerPerson?: number | null;
};

export type DiscoveryScoreBreakdown = {
  categoryFit: number;
  proximity: number;
  openNow: number;
  freshness: number;
  rating: number;
  price: number;
};

export type ScoredDiscoveryCandidate = DiscoveryCandidateInput & {
  score: number;
  breakdown: DiscoveryScoreBreakdown;
};

/** Category ids resolved from an intent's slugs, for one request. */
export type ResolvedIntentFilter = {
  /** null = no restriction (e.g. Something New draws from the whole city). */
  allowedCategoryIds: Set<number> | null;
  /** Empty when the intent has no excludeCategorySlugs. */
  excludedCategoryIds: Set<number>;
  boostByCategoryId: Map<number, number>;
};

/** Category-fit credit for a matched slug that has no explicit entry in categoryBoost. */
const DEFAULT_CATEGORY_BOOST = 0.6;

/**
 * Resolves an intent's `categorySlugs`/`categoryBoost` (the reviewable,
 * slug-keyed source of truth in intents.ts) to category ids for scoring,
 * via the same process-lifetime slug->id cache
 * lib/recommendations/time-intent.ts already maintains for the time-of-day
 * boosts - no second cache, no extra query beyond its first per-process call.
 */
export async function resolveIntentCategoryFilter(
  config: DiscoveryIntentConfig,
): Promise<ResolvedIntentFilter> {
  const slugToId = await getCategorySlugIdMap();
  return buildIntentCategoryFilter(config, slugToId);
}

/**
 * Pure half of {@link resolveIntentCategoryFilter} (no DB access) - split out
 * so scripts/discovery-fixture-eval.ts can exercise real filter/scoring
 * behavior against a synthetic slug->id map, the same way
 * lib/recommendations/time-intent.ts separates its pure
 * getTimeIntentBoostsBySlug from the DB-backed getTimeIntentBoostsByCategoryId.
 */
export function buildIntentCategoryFilter(
  config: DiscoveryIntentConfig,
  slugToId: Map<string, number>,
): ResolvedIntentFilter {
  if (config.categorySlugs.length === 0) {
    return {
      allowedCategoryIds: null,
      excludedCategoryIds: resolveExcludedIds(config, slugToId),
      boostByCategoryId: new Map(),
    };
  }

  const allowedCategoryIds = new Set<number>();
  const boostByCategoryId = new Map<number, number>();
  for (const slug of config.categorySlugs) {
    const id = slugToId.get(slug);
    // A configured slug that no longer resolves (renamed/removed in the
    // taxonomy) is skipped rather than thrown - a stale entry here should
    // shrink an intent's inventory, not 500 the endpoint.
    if (id == null) continue;
    allowedCategoryIds.add(id);
    boostByCategoryId.set(id, config.categoryBoost?.[slug] ?? DEFAULT_CATEGORY_BOOST);
  }
  return {
    allowedCategoryIds,
    excludedCategoryIds: resolveExcludedIds(config, slugToId),
    boostByCategoryId,
  };
}

function resolveExcludedIds(
  config: DiscoveryIntentConfig,
  slugToId: Map<string, number>,
): Set<number> {
  const excluded = new Set<number>();
  for (const slug of config.excludeCategorySlugs ?? []) {
    const id = slugToId.get(slug);
    if (id != null) excluded.add(id);
  }
  return excluded;
}

/** True when the intent has no category restriction, or the candidate has >=1 allowed category. */
export function matchesIntentCategory(candidate: CandidateInput, filter: ResolvedIntentFilter): boolean {
  if (filter.excludedCategoryIds.size > 0) {
    if (candidate.categoryIds.some((id) => filter.excludedCategoryIds.has(id))) {
      return false;
    }
  }
  if (filter.allowedCategoryIds === null) return true;
  return candidate.categoryIds.some((id) => filter.allowedCategoryIds!.has(id));
}

/**
 * Hard filters applied before scoring: category membership, plus each
 * intent's optional open-now / closes-late / max-distance gates. Missing
 * data is never treated as a fail here (an unknown open state, or no coords
 * at all, simply can't be evaluated against these gates) - see
 * requireOpenNow/requireClosesLate's doc comments in intents.ts for why the
 * two differ on how strict they are about missing hours specifically.
 */
export function passesIntentFilters(
  candidate: DiscoveryCandidateInput,
  config: DiscoveryIntentConfig,
  filter: ResolvedIntentFilter,
): boolean {
  if (!matchesIntentCategory(candidate, filter)) return false;
  if (config.requireOpenNow && candidate.openState === "closed") return false;
  if (config.requireClosesLate && candidate.closesLate !== true) return false;
  if (
    config.maxDistanceMeters != null &&
    candidate.distanceMeters != null &&
    candidate.distanceMeters > config.maxDistanceMeters
  ) {
    return false;
  }
  return true;
}

function categoryFitScore(candidate: CandidateInput, filter: ResolvedIntentFilter): number | null {
  if (filter.allowedCategoryIds === null) return null;
  let best: number | null = null;
  for (const id of candidate.categoryIds) {
    const boost = filter.boostByCategoryId.get(id);
    if (boost != null && (best === null || boost > best)) best = boost;
  }
  return best;
}

/** Full credit at/under the ceiling; exponential decay above it (same shape as the proximity term's distance decay). */
function priceScore(minPricePerPerson: number | null | undefined, ceilingPkr: number | undefined): number | null {
  if (ceilingPkr == null || minPricePerPerson == null) return null;
  if (minPricePerPerson <= ceilingPkr) return 1;
  return Math.exp(-(minPricePerPerson - ceilingPkr) / ceilingPkr);
}

export type DiscoveryScoringContext = {
  now: Date;
  /** Seeds the anti-staleness jitter (lib/recommendations/scoring.ts's jitterFor); pass the user id or an anon id. */
  actorKey: string;
  /** Test-only: zeroes the jitter term so fixture assertions are exact. */
  disableJitter?: boolean;
};

export function scoreDiscoveryCandidate(
  candidate: DiscoveryCandidateInput,
  config: DiscoveryIntentConfig,
  filter: ResolvedIntentFilter,
  ctx: DiscoveryScoringContext,
): ScoredDiscoveryCandidate {
  const categoryFit = categoryFitScore(candidate, filter);
  const proximity =
    candidate.distanceMeters != null ? Math.exp(-candidate.distanceMeters / GEO_D0_METERS) : null;
  const openNow = candidate.openState != null ? OPEN_NOW_SCORE[candidate.openState] : null;
  const freshness =
    candidate.ageDays != null ? Math.exp(-candidate.ageDays / FRESHNESS_HALF_LIFE_DAYS) : null;
  const rating = candidate.avgRating != null ? candidate.avgRating / 5 : null;
  const price = priceScore(candidate.minPricePerPerson, config.budgetCeilingPkr);

  const terms: Array<[number, number | null]> = [
    [config.weights.categoryFit, categoryFit],
    [config.weights.proximity, proximity],
    [config.weights.openNow, openNow],
    [config.weights.freshness, freshness],
    [config.weights.rating, rating],
    [config.weights.price, price],
  ];
  const availableWeight = terms.reduce((sum, [w, v]) => sum + (v != null ? w : 0), 0);

  const baseScore =
    availableWeight > 0
      ? terms.reduce((sum, [w, v]) => sum + (v != null ? (w / availableWeight) * v : 0), 0)
      // Every weight's signal was unavailable (e.g. no coords, no hours, no
      // rating, off-taxonomy candidate) - fall back to category fit (or a
      // neutral 0.5) rather than collapsing every such candidate to a tied 0.
      : (categoryFit ?? 0.5);

  const jitter = ctx.disableJitter ? 0 : jitterFor(candidate.id, ctx.actorKey, ctx.now);

  return {
    ...candidate,
    score: baseScore + jitter,
    breakdown: {
      categoryFit: categoryFit ?? 0,
      proximity: proximity ?? 0,
      openNow: openNow ?? 0,
      freshness: freshness ?? 0,
      rating: rating ?? 0,
      price: price ?? 0,
    },
  };
}

export function scoreDiscoveryCandidates(
  candidates: DiscoveryCandidateInput[],
  config: DiscoveryIntentConfig,
  filter: ResolvedIntentFilter,
  ctx: DiscoveryScoringContext,
): ScoredDiscoveryCandidate[] {
  return candidates.map((c) => scoreDiscoveryCandidate(c, config, filter, ctx));
}
