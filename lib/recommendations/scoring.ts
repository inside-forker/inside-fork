/**
 * Pure scoring + diversity re-rank for "Recommended For You". No DB access
 * here on purpose - `scripts/recs-fixture-eval.ts` exercises this file
 * directly against synthetic candidates so weight changes are visible in
 * review without needing a live database.
 */
import {
  AFFINITY_K,
  AFFINITY_MAX_WEIGHT,
  AFFINITY_MEAN_WEIGHT,
  FATIGUE_STRENGTH,
  FRESHNESS_HALF_LIFE_DAYS,
  GEO_D0_METERS,
  JITTER_AMPLITUDE,
  JITTER_WINDOW_HOURS,
  MMR_LAMBDA,
  MMR_MAX_PER_PARENT,
  MMR_MAX_PER_SUBCATEGORY,
  TERM_WEIGHTS,
  TOP_RATED_PINNED_QUALITY_SCORE,
} from "./constants";
import { TIME_INTENT_FLOOR } from "./time-intent";

export type OpenState = "open" | "closed" | "unknown";

export type CandidateInput = {
  id: number;
  /** Leaf/subcategory ids this listing is tagged with (never empty in practice). */
  categoryIds: number[];
  /** Parent (top-level) ids derived from categoryIds, deduped. */
  parentCategoryIds: number[];
  /** null when the caller has no coords or the listing has no lat/lng - gates the proximity term off. */
  distanceMeters: number | null;
  /** Not scored here (see candidates.ts's `onlyOpen`, which hard-filters to
   * "open" before candidates ever reach this file) - kept only for the
   * "Open now"/"Closed now" reason text callers build from it. */
  openState: OpenState | null;
  /** null when created_at is missing - gates the freshness term off. */
  ageDays: number | null;
  /** null/0 when the listing has no organic rating yet - gates the quality
   * term to the `topRatedPinned` fallback (or off entirely if unpinned too). */
  avgRating: number | null;
  /** Admin-curated "Top Rated by Insiders" pin - same flag that feature uses
   * for its own cold start. Fallback quality signal when avgRating is empty. */
  topRatedPinned?: boolean;
  /** Impression-fatigue signal in [0,1]; 0 (default) is a structural no-op until Phase 2 data exists. */
  seenScore?: number;
  /** Structural "stays open late" signal (see candidates.ts's computeClosesLate) - unused by this file's own scorer, read by lib/discovery's Late Night intent. Optional so older fixtures/tests that predate this field still compile. */
  closesLate?: boolean;
};

export type ScoringContext = {
  /** T(c): time-of-day category boosts, sparse - missing ids read as TIME_INTENT_FLOOR. */
  timeIntentByCategoryId: Map<number, number>;
  /** learned(u,c) in [0,1] from user_listing_events, sparse - missing ids read as 0. */
  learnedAffinityByCategoryId?: Map<number, number>;
  /** n in alpha = n / (n + K): the actor's non-impression event count. */
  eventCount?: number;
  now?: Date;
  /** Seeds the anti-staleness jitter; pass the user id or an anon id. */
  actorKey?: string;
  /** Test-only: zeroes the jitter term so fixture assertions are exact. */
  disableJitter?: boolean;
};

export type ScoreBreakdown = {
  affinity: number;
  proximity: number;
  freshness: number;
  quality: number;
};

export type ScoredCandidate = CandidateInput & {
  score: number;
  breakdown: ScoreBreakdown;
};

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic +/- JITTER_AMPLITUDE offset, stable within a JITTER_WINDOW_HOURS window. */
export function jitterFor(candidateId: number, actorKey: string, now: Date): number {
  const windowIndex = Math.floor(now.getTime() / (JITTER_WINDOW_HOURS * 3600 * 1000));
  const unit = fnv1a(`${actorKey}:${windowIndex}:${candidateId}`) % 10_000 / 10_000;
  return (unit * 2 - 1) * JITTER_AMPLITUDE;
}

export function scoreCandidate(
  candidate: CandidateInput,
  ctx: ScoringContext,
): ScoredCandidate {
  const now = ctx.now ?? new Date();
  const actorKey = ctx.actorKey ?? "anon";
  const n = ctx.eventCount ?? 0;
  const alpha = n / (n + AFFINITY_K);

  const affinityPerCategory = candidate.categoryIds.map((categoryId) => {
    const learned = ctx.learnedAffinityByCategoryId?.get(categoryId) ?? 0;
    const timeIntent = ctx.timeIntentByCategoryId.get(categoryId) ?? TIME_INTENT_FLOOR;
    return alpha * learned + (1 - alpha) * timeIntent;
  });
  const affinity =
    affinityPerCategory.length > 0
      ? AFFINITY_MAX_WEIGHT * Math.max(...affinityPerCategory) +
        AFFINITY_MEAN_WEIGHT *
          (affinityPerCategory.reduce((a, b) => a + b, 0) / affinityPerCategory.length)
      : TIME_INTENT_FLOOR;

  const proximity =
    candidate.distanceMeters != null
      ? Math.exp(-candidate.distanceMeters / GEO_D0_METERS)
      : null;
  const freshness =
    candidate.ageDays != null ? Math.exp(-candidate.ageDays / FRESHNESS_HALF_LIFE_DAYS) : null;
  const quality =
    candidate.avgRating != null && candidate.avgRating > 0
      ? candidate.avgRating / 5
      : candidate.topRatedPinned
        ? TOP_RATED_PINNED_QUALITY_SCORE
        : null;

  const terms: Array<[number, number | null]> = [
    [TERM_WEIGHTS.affinity, affinity],
    [TERM_WEIGHTS.proximity, proximity],
    [TERM_WEIGHTS.quality, quality],
    [TERM_WEIGHTS.freshness, freshness],
  ];
  const availableWeight = terms.reduce((sum, [w, v]) => sum + (v != null ? w : 0), 0);

  let score: number;
  if (availableWeight > 0) {
    score = terms.reduce(
      (sum, [w, v]) => sum + (v != null ? (w / availableWeight) * v : 0),
      0,
    );
  } else {
    // Affinity is gated in unconditionally, so this only happens if callers
    // zero every weight - fall back to the affinity term rather than 0.
    score = affinity;
  }

  const seenScore = candidate.seenScore ?? 0;
  score *= 1 - FATIGUE_STRENGTH * seenScore;
  if (!ctx.disableJitter) {
    score += jitterFor(candidate.id, actorKey, now);
  }

  return {
    ...candidate,
    score,
    breakdown: {
      affinity,
      proximity: proximity ?? 0,
      freshness: freshness ?? 0,
      quality: quality ?? 0,
    },
  };
}

export function scoreCandidates(
  candidates: CandidateInput[],
  ctx: ScoringContext,
): ScoredCandidate[] {
  return candidates.map((c) => scoreCandidate(c, ctx));
}

function jaccard(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const id of setA) if (setB.has(id)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Minimal shape {@link diversify} needs - satisfied by ScoredCandidate and lib/discovery's ScoredDiscoveryCandidate alike. */
export type Diversifiable = {
  id: number;
  score: number;
  categoryIds: number[];
  parentCategoryIds: number[];
};

/**
 * Greedy MMR re-rank over scored candidates, with hard caps of
 * <=MMR_MAX_PER_SUBCATEGORY sharing a subcategory and <=MMR_MAX_PER_PARENT
 * sharing a top-level parent. Caps are relaxed (score order) if they'd
 * otherwise leave the result short of `limit` - the size guarantee wins over
 * diversity when inventory is thin.
 *
 * Deliberately searches the *entire* scored list, not just a top-N slice:
 * with food ~66% of inventory and the heaviest-boosted category, the raw
 * top-ranked candidates near any given point used to be almost all food, so
 * the parent cap "ran out of room" within a narrow slice and backfilled with
 * more food instead of ever reaching non-food candidates ranked lower.
 *
 * Generic over any {@link Diversifiable} (not hardcoded to ScoredCandidate)
 * so lib/discovery's per-intent scorer can reuse this exact, already-tuned
 * re-rank instead of a second copy - it only ever reads id/score/categoryIds
 * /parentCategoryIds, never the score breakdown, so the wider "Recommended
 * For You" shape was never actually required here.
 */
export function diversify<T extends Diversifiable>(scored: T[], limit: number): T[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  const selected: T[] = [];
  const subCounts = new Map<number, number>();
  const parentCounts = new Map<number, number>();
  const remaining = [...sorted];

  const violatesCaps = (c: T): boolean => {
    for (const id of c.categoryIds) {
      if ((subCounts.get(id) ?? 0) >= MMR_MAX_PER_SUBCATEGORY) return true;
    }
    for (const id of c.parentCategoryIds) {
      if ((parentCounts.get(id) ?? 0) >= MMR_MAX_PER_PARENT) return true;
    }
    return false;
  };

  const commit = (c: T): void => {
    selected.push(c);
    for (const id of c.categoryIds) subCounts.set(id, (subCounts.get(id) ?? 0) + 1);
    for (const id of c.parentCategoryIds) {
      parentCounts.set(id, (parentCounts.get(id) ?? 0) + 1);
    }
    const idx = remaining.indexOf(c);
    if (idx >= 0) remaining.splice(idx, 1);
  };

  while (selected.length < limit && remaining.length > 0) {
    let best: T | null = null;
    let bestMmr = -Infinity;
    for (const c of remaining) {
      if (violatesCaps(c)) continue;
      const maxJaccard =
        selected.length === 0
          ? 0
          : Math.max(...selected.map((s) => jaccard(c.categoryIds, s.categoryIds)));
      const mmr = c.score - MMR_LAMBDA * maxJaccard;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        best = c;
      }
    }
    if (!best) break; // everything remaining violates a hard cap
    commit(best);
  }

  // Backfill in score order (ignoring caps) if hard caps left us short of
  // `limit` - only reachable when the whole candidate set can't fill `limit`
  // diverse slots, e.g. thin inventory in an area. Iterates a snapshot, not
  // `remaining` itself: commit() splices out of `remaining` as it goes, and
  // mutating an array while a `for...of` is walking it skips every other
  // element once the loop's cursor and the splice both shift the same index
  // (confirmed via scripts/discovery-fixture-eval.ts's thin-pool Late Night
  // case, which needs a 2+ item backfill far more often than "Recommended
  // For You"'s denser candidate pool ever triggers).
  if (selected.length < limit) {
    for (const c of [...remaining]) {
      if (selected.length >= limit) break;
      commit(c);
    }
  }

  return selected.slice(0, limit);
}
