import { query } from "@/lib/db";

/**
 * Rebuild last-N-days zero-result search rollups from mobile_events +
 * analytics_events into search_zero_results_daily.
 */
export async function refreshSearchZeroResultsDaily(days = 30): Promise<{
  upserted: number;
}> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  await query(
    `DELETE FROM public.search_zero_results_daily WHERE day >= $1::date`,
    [since.toISOString().slice(0, 10)],
  );

  const { rowCount: mobileCount } = await query(
    `INSERT INTO public.search_zero_results_daily (day, platform, query, zero_count, updated_at)
     SELECT
       (occurred_at AT TIME ZONE 'Asia/Karachi')::date AS day,
       'mobile'::text AS platform,
       lower(trim(context->>'query')) AS query,
       COUNT(*)::int AS zero_count,
       now()
     FROM public.mobile_events
     WHERE event_name IN ('search_performed', 'filters_applied')
       AND (context->>'hasResults') = 'false'
       AND context->>'query' IS NOT NULL
       AND trim(context->>'query') <> ''
       AND occurred_at >= $1
     GROUP BY 1, 3
     ON CONFLICT (day, platform, query)
     DO UPDATE SET zero_count = EXCLUDED.zero_count, updated_at = now()`,
    [since.toISOString()],
  );

  const { rowCount: webCount } = await query(
    `INSERT INTO public.search_zero_results_daily (day, platform, query, zero_count, updated_at)
     SELECT
       (occurred_at AT TIME ZONE 'Asia/Karachi')::date AS day,
       'web'::text AS platform,
       lower(trim(COALESCE(context->>'query', context->>'q', ''))) AS query,
       COUNT(*)::int AS zero_count,
       now()
     FROM public.analytics_events
     WHERE event_type = 'search_performed'
       AND (
         (context->>'hasResults') = 'false'
         OR (context->>'has_results') = 'false'
         OR COALESCE((context->>'resultCount')::int, (context->>'result_count')::int, -1) = 0
       )
       AND COALESCE(context->>'query', context->>'q', '') <> ''
       AND occurred_at >= $1
     GROUP BY 1, 3
     HAVING lower(trim(COALESCE(context->>'query', context->>'q', ''))) <> ''
     ON CONFLICT (day, platform, query)
     DO UPDATE SET zero_count = EXCLUDED.zero_count, updated_at = now()`,
    [since.toISOString()],
  );

  const { rowCount: allCount } = await query(
    `INSERT INTO public.search_zero_results_daily (day, platform, query, zero_count, updated_at)
     SELECT day, 'all'::text, query, SUM(zero_count)::int, now()
     FROM public.search_zero_results_daily
     WHERE day >= $1::date AND platform IN ('mobile', 'web')
     GROUP BY day, query
     ON CONFLICT (day, platform, query)
     DO UPDATE SET zero_count = EXCLUDED.zero_count, updated_at = now()`,
    [since.toISOString().slice(0, 10)],
  );

  return {
    upserted: (mobileCount ?? 0) + (webCount ?? 0) + (allCount ?? 0),
  };
}

export type ZeroResultRollupRow = {
  query: string;
  zeroCount: number;
  daysActive: number;
  lastDay: string;
};

/** Top zero-result queries over a window from the daily rollup (platform=all). */
export async function getZeroResultRollup(
  days = 30,
  limit = 50,
): Promise<ZeroResultRollupRow[]> {
  const { rows } = await query(
    `SELECT
       query,
       SUM(zero_count)::int AS zero_count,
       COUNT(DISTINCT day)::int AS days_active,
       MAX(day)::text AS last_day
     FROM public.search_zero_results_daily
     WHERE platform = 'all'
       AND day >= (CURRENT_DATE - ($1::int || ' days')::interval)
     GROUP BY query
     ORDER BY zero_count DESC, last_day DESC
     LIMIT $2`,
    [days, limit],
  );

  return rows.map((r) => ({
    query: String(r.query),
    zeroCount: Number(r.zero_count),
    daysActive: Number(r.days_active),
    lastDay: String(r.last_day),
  }));
}
