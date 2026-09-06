import { query } from "@/lib/db";
import { CONSUMER_ROLES } from "@/lib/scoring/thresholds";
import {
  EVENT_HALF_LIFE_DAYS,
  EVENT_WEIGHTS,
} from "@/lib/recommendations/constants";

const EVENT_WEIGHT_CASE = Object.entries(EVENT_WEIGHTS)
  .map(([type, weight]) => `WHEN '${type}' THEN ${weight}`)
  .join(" ");

const HALF_LIFE_SECONDS = EVENT_HALF_LIFE_DAYS * 86400;

export type RefreshTasteGraphResult = {
  usersTouched: number;
  rowsUpserted: number;
  durationMs: number;
};

/**
 * Nightly rebuild of user_category_affinity from listing events + validated
 * redemptions (redeem counts as a strong positive signal).
 */
export async function refreshTasteGraph(): Promise<RefreshTasteGraphResult> {
  const startedAt = Date.now();

  await query(`DELETE FROM public.user_category_affinity`);

  const { rowCount } = await query(
    `
    WITH consumers AS (
      SELECT id AS user_id FROM public.profiles WHERE role::text = ANY($1::text[])
    ),
    listing_signals AS (
      SELECT
        ule.user_id,
        lc.category_id,
        SUM(
          (CASE ule.event_type ${EVENT_WEIGHT_CASE} ELSE 0 END)
          * exp(-EXTRACT(EPOCH FROM (now() - ule.created_at)) / ${HALF_LIFE_SECONDS})
          * COALESCE(lc.relevance_score, 1.0)
        ) AS weighted_score,
        COUNT(*) FILTER (WHERE ule.event_type <> 'rec_impression')::int AS event_count
      FROM public.user_listing_events ule
      INNER JOIN public.listing_categories lc ON lc.listing_id = ule.listing_id
      WHERE ule.user_id IS NOT NULL
      GROUP BY ule.user_id, lc.category_id
    ),
    redeem_signals AS (
      SELECT
        r.user_id,
        lc.category_id,
        SUM(
          6.0 * exp(-EXTRACT(EPOCH FROM (now() - r.validated_at)) / ${HALF_LIFE_SECONDS})
        ) AS weighted_score,
        COUNT(*)::int AS event_count
      FROM public.redemptions r
      INNER JOIN public.listing_categories lc ON lc.listing_id = r.listing_id
      WHERE r.status = 'validated' AND r.user_id IS NOT NULL AND r.validated_at IS NOT NULL
      GROUP BY r.user_id, lc.category_id
    ),
    combined AS (
      SELECT user_id, category_id,
             SUM(weighted_score) AS weighted_score,
             SUM(event_count)::int AS event_count
      FROM (
        SELECT * FROM listing_signals
        UNION ALL
        SELECT * FROM redeem_signals
      ) s
      GROUP BY user_id, category_id
    ),
    ranked AS (
      SELECT
        c.user_id,
        c.category_id,
        c.event_count,
        CASE
          WHEN mx.max_score > 0 THEN GREATEST(0, ROUND((c.weighted_score / mx.max_score)::numeric, 4))
          ELSE 0
        END AS affinity
      FROM combined c
      INNER JOIN consumers cons ON cons.user_id = c.user_id
      INNER JOIN (
        SELECT user_id, MAX(weighted_score) AS max_score
        FROM combined
        GROUP BY user_id
      ) mx ON mx.user_id = c.user_id
      WHERE c.weighted_score > 0
    )
    INSERT INTO public.user_category_affinity (user_id, category_id, affinity, event_count, computed_at)
    SELECT user_id, category_id, affinity, event_count, now()
    FROM ranked
    `,
    [CONSUMER_ROLES],
  );

  const { rows: userRows } = await query(
    `SELECT COUNT(DISTINCT user_id)::int AS n FROM public.user_category_affinity`,
  );

  return {
    usersTouched: Number(userRows[0]?.n ?? 0),
    rowsUpserted: rowCount ?? 0,
    durationMs: Date.now() - startedAt,
  };
}
