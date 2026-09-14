/**
 * Pure scoring for the "What's on" personalized events feed
 * (app/api/mobile/v1/events/for-you). No DB access here on purpose, same as
 * scoring.ts, which this deliberately does not reuse: CandidateInput/
 * scoreCandidate there are listing-shaped (ageDays = time since creation,
 * hardcoded FRESHNESS_HALF_LIFE_DAYS) and don't map cleanly onto "time until
 * an event starts". `jitterFor` is generic and is reused as-is.
 */
import { AFFINITY_K, EVENT_SOON_HALF_LIFE_HOURS, EVENT_TERM_WEIGHTS, GEO_D0_METERS } from "./constants";
import { TIME_INTENT_FLOOR } from "./time-intent";
import { jitterFor } from "./scoring";

export type EventCandidateInput = {
  id: number;
  categoryId: number | null;
  startTime: Date;
  /** null when the caller has no coords or the event has no lat/lng - gates the proximity term off. */
  distanceMeters: number | null;
};

export type EventScoringContext = {
  /** T(c): time-of-day category boosts, sparse - missing/null category ids read as TIME_INTENT_FLOOR. */
  timeIntentByCategoryId: Map<number, number>;
  /** learned(u,c) in [0,1] from getEventCategoryAffinity, sparse - missing ids read as 0. */
  learnedAffinityByCategoryId?: Map<number, number>;
  /** n in alpha = n / (n + K): the actor's non-impression event count. */
  eventCount?: number;
  now?: Date;
  /** Seeds the anti-staleness jitter; pass the user id or an anon id. */
  actorKey?: string;
  /** Test-only: zeroes the jitter term so fixture assertions are exact. */
  disableJitter?: boolean;
};

export type EventScoreBreakdown = {
  category: number;
  soonness: number;
  proximity: number;
};

export type ScoredEventCandidate = EventCandidateInput & {
  score: number;
  breakdown: EventScoreBreakdown;
};

export function scoreEventCandidate(
  candidate: EventCandidateInput,
  ctx: EventScoringContext,
): ScoredEventCandidate {
  const now = ctx.now ?? new Date();
  const actorKey = ctx.actorKey ?? "anon";
  const n = ctx.eventCount ?? 0;
  const alpha = n / (n + AFFINITY_K);

  // Never a hard 0, even for a brand-new actor - falls back to the time-of-day
  // prior, same cold-start shape as the listings scorer.
  const learned =
    candidate.categoryId != null
      ? (ctx.learnedAffinityByCategoryId?.get(candidate.categoryId) ?? 0)
      : 0;
  const timeIntent =
    candidate.categoryId != null
      ? (ctx.timeIntentByCategoryId.get(candidate.categoryId) ?? TIME_INTENT_FLOOR)
      : TIME_INTENT_FLOOR;
  const categoryScore = alpha * learned + (1 - alpha) * timeIntent;

  const hoursUntilStart = Math.max(
    0,
    (candidate.startTime.getTime() - now.getTime()) / 3_600_000,
  );
  const soonness = Math.exp(-hoursUntilStart / EVENT_SOON_HALF_LIFE_HOURS);

  const proximity =
    candidate.distanceMeters != null
      ? Math.exp(-candidate.distanceMeters / GEO_D0_METERS)
      : null;

  const terms: Array<[number, number | null]> = [
    [EVENT_TERM_WEIGHTS.category, categoryScore],
    [EVENT_TERM_WEIGHTS.soonness, soonness],
    [EVENT_TERM_WEIGHTS.proximity, proximity],
  ];
  const availableWeight = terms.reduce((sum, [w, v]) => sum + (v != null ? w : 0), 0);

  let score: number;
  if (availableWeight > 0) {
    score = terms.reduce(
      (sum, [w, v]) => sum + (v != null ? (w / availableWeight) * v : 0),
      0,
    );
  } else {
    // category/soonness are gated in unconditionally, so this can't happen in
    // practice - fall back to categoryScore rather than 0 just in case.
    score = categoryScore;
  }

  if (!ctx.disableJitter) {
    score += jitterFor(candidate.id, actorKey, now);
  }

  return {
    ...candidate,
    score,
    breakdown: { category: categoryScore, soonness, proximity: proximity ?? 0 },
  };
}

export function scoreEventCandidates(
  candidates: EventCandidateInput[],
  ctx: EventScoringContext,
): ScoredEventCandidate[] {
  return candidates.map((c) => scoreEventCandidate(c, ctx));
}
