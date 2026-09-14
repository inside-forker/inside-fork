/**
 * learned(u,c): a user/anon actor's recency-weighted category affinity from
 * user_listing_events (Phase 2). Computed on the fly per request - at the
 * current traffic volume (~15 active users) this is sub-millisecond. Only
 * add a rollup table if a request-time aggregate here exceeds ~30ms; keep
 * this function's signature stable either way.
 */
import { query } from "@/lib/db";
import { EVENT_HALF_LIFE_DAYS, EVENT_WEIGHTS } from "./constants";

export type ActorKey = {
  userId: string | null;
  anonId: string | null;
};

export type AffinityResult = {
  /** learned(u,c) normalized to [0,1] - 1.0 is the actor's single strongest category. */
  byCategoryId: Map<number, number>;
  /** n: non-impression event count, feeds alpha = n / (n + AFFINITY_K). */
  eventCount: number;
};

const EMPTY: AffinityResult = { byCategoryId: new Map(), eventCount: 0 };

const EVENT_WEIGHT_CASE = Object.entries(EVENT_WEIGHTS)
  .map(([type, weight]) => `WHEN '${type}' THEN ${weight}`)
  .join(" ");

const HALF_LIFE_SECONDS = EVENT_HALF_LIFE_DAYS * 86400;

/**
 * Reads `user_listing_events` for the given actor (user id and/or anon id -
 * pass whichever is known). Degrades to {@link EMPTY} rather than throwing if
 * the table isn't present yet (e.g. before the Phase 2 migration has run),
 * so recommendations keep working on time-of-day context alone.
 */
export async function getUserCategoryAffinity(
  actor: ActorKey,
): Promise<AffinityResult> {
  if (!actor.userId && !actor.anonId) return EMPTY;

  try {
    const [{ rows: categoryRows }, { rows: countRows }] = await Promise.all([
      query(
        `SELECT lc.category_id AS category_id,
                SUM(
                  (CASE ule.event_type ${EVENT_WEIGHT_CASE} ELSE 0 END)
                  * exp(-EXTRACT(EPOCH FROM (now() - ule.created_at)) / ${HALF_LIFE_SECONDS})
                  * COALESCE(lc.relevance_score, 1.0)
                ) AS weighted_score
         FROM public.user_listing_events ule
         JOIN public.listing_categories lc ON lc.listing_id = ule.listing_id
         WHERE (ule.user_id = $1 OR ule.anon_id = $2)
         GROUP BY lc.category_id`,
        [actor.userId, actor.anonId],
      ),
      query(
        `SELECT count(*) AS n
         FROM public.user_listing_events
         WHERE (user_id = $1 OR anon_id = $2) AND event_type <> 'rec_impression'`,
        [actor.userId, actor.anonId],
      ),
    ]);

    const raw = (categoryRows as Array<{ category_id: number | string; weighted_score: number | string }>)
      .map((r) => ({ categoryId: Number(r.category_id), score: Number(r.weighted_score) }))
      .filter((r) => Number.isFinite(r.score));

    const maxScore = raw.reduce((max, r) => Math.max(max, r.score), 0);
    const byCategoryId = new Map<number, number>();
    if (maxScore > 0) {
      for (const r of raw) {
        // Negative net affinity (e.g. unfavorited) floors at 0 - it's an
        // absence of interest, not a boostable "anti-signal" for this term.
        byCategoryId.set(r.categoryId, Math.max(0, r.score / maxScore));
      }
    }

    const eventCount = Number(countRows[0]?.n ?? 0);

    return { byCategoryId, eventCount: Number.isFinite(eventCount) ? eventCount : 0 };
  } catch (error) {
    console.error("[recommendations] affinity lookup failed, degrading to time-intent only:", error);
    return EMPTY;
  }
}

/**
 * learned(u,c) for calendar events - the events sibling of
 * {@link getUserCategoryAffinity}, kept as a separate function (not a mode
 * flag on the existing one) so that function's signature stays stable per its
 * own doc comment above.
 *
 * Combines two signals into one per-category score, since listings and
 * events share the same `categories` table/taxonomy: browsing taste learned
 * from `user_listing_events` (joined via `listing_categories`) and taste
 * learned from `user_event_events` (joined directly via `events.category_id`,
 * no join table needed there). Both are UNIONed and normalized together in
 * one query rather than computed separately and averaged, so the result is
 * one consistent [0,1] scale.
 */
export async function getEventCategoryAffinity(
  actor: ActorKey,
): Promise<AffinityResult> {
  if (!actor.userId && !actor.anonId) return EMPTY;

  try {
    const [{ rows: categoryRows }, { rows: countRows }] = await Promise.all([
      query(
        `SELECT category_id, SUM(weighted_score) AS weighted_score FROM (
           SELECT lc.category_id AS category_id,
                  (CASE ule.event_type ${EVENT_WEIGHT_CASE} ELSE 0 END)
                  * exp(-EXTRACT(EPOCH FROM (now() - ule.created_at)) / ${HALF_LIFE_SECONDS})
                  * COALESCE(lc.relevance_score, 1.0) AS weighted_score
           FROM public.user_listing_events ule
           JOIN public.listing_categories lc ON lc.listing_id = ule.listing_id
           WHERE (ule.user_id = $1 OR ule.anon_id = $2)
           UNION ALL
           SELECT e.category_id AS category_id,
                  (CASE uee.event_type ${EVENT_WEIGHT_CASE} ELSE 0 END)
                  * exp(-EXTRACT(EPOCH FROM (now() - uee.created_at)) / ${HALF_LIFE_SECONDS}) AS weighted_score
           FROM public.user_event_events uee
           JOIN public.events e ON e.id = uee.event_id
           WHERE (uee.user_id = $1 OR uee.anon_id = $2) AND e.category_id IS NOT NULL
         ) combined
         GROUP BY category_id`,
        [actor.userId, actor.anonId],
      ),
      query(
        `SELECT
           (SELECT count(*) FROM public.user_listing_events
            WHERE (user_id = $1 OR anon_id = $2) AND event_type <> 'rec_impression')
           +
           (SELECT count(*) FROM public.user_event_events
            WHERE (user_id = $1 OR anon_id = $2) AND event_type <> 'rec_impression')
           AS n`,
        [actor.userId, actor.anonId],
      ),
    ]);

    const raw = (categoryRows as Array<{ category_id: number | string; weighted_score: number | string }>)
      .map((r) => ({ categoryId: Number(r.category_id), score: Number(r.weighted_score) }))
      .filter((r) => Number.isFinite(r.score));

    const maxScore = raw.reduce((max, r) => Math.max(max, r.score), 0);
    const byCategoryId = new Map<number, number>();
    if (maxScore > 0) {
      for (const r of raw) {
        byCategoryId.set(r.categoryId, Math.max(0, r.score / maxScore));
      }
    }

    const eventCount = Number(countRows[0]?.n ?? 0);

    return { byCategoryId, eventCount: Number.isFinite(eventCount) ? eventCount : 0 };
  } catch (error) {
    console.error("[recommendations] event affinity lookup failed, degrading to time-intent only:", error);
    return EMPTY;
  }
}
