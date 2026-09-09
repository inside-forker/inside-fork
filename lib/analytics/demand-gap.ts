import { query } from "@/lib/db";
import { getZeroResultRollup } from "@/lib/analytics/search-zero-results";

export type DemandGapRow = {
  query: string;
  zeroCount: number;
  daysActive: number;
  lastDay: string;
  trend7d: number;
  prior7d: number;
};

export type DemandGapOverview = {
  topQueries: DemandGapRow[];
  totalZeroEvents30d: number;
  uniqueQueries30d: number;
  generatedAt: string;
};

/**
 * Demand-gap product seed: unmet search demand from zero-result rollups.
 */
export async function getDemandGapOverview(
  days = 30,
  limit = 50,
): Promise<DemandGapOverview> {
  const rollup = await getZeroResultRollup(days, limit);

  let trendMap = new Map<string, { current: number; prior: number }>();
  try {
    const { rows } = await query(
      `SELECT
         query,
         COALESCE(SUM(zero_count) FILTER (
           WHERE day >= (CURRENT_DATE - INTERVAL '7 days')
         ), 0)::int AS current_7d,
         COALESCE(SUM(zero_count) FILTER (
           WHERE day >= (CURRENT_DATE - INTERVAL '14 days')
             AND day < (CURRENT_DATE - INTERVAL '7 days')
         ), 0)::int AS prior_7d
       FROM public.search_zero_results_daily
       WHERE platform = 'all'
         AND day >= (CURRENT_DATE - INTERVAL '14 days')
       GROUP BY query`,
    );
    trendMap = new Map(
      rows.map((r) => [
        String(r.query),
        {
          current: Number(r.current_7d ?? 0),
          prior: Number(r.prior_7d ?? 0),
        },
      ]),
    );
  } catch (error) {
    console.error("demand gap trend load failed", error);
  }

  let totals = { total: 0, unique: 0 };
  try {
    const { rows } = await query(
      `SELECT
         COALESCE(SUM(zero_count), 0)::int AS total,
         COUNT(DISTINCT query)::int AS unique_queries
       FROM public.search_zero_results_daily
       WHERE platform = 'all'
         AND day >= (CURRENT_DATE - ($1::int || ' days')::interval)`,
      [days],
    );
    totals = {
      total: Number(rows[0]?.total ?? 0),
      unique: Number(rows[0]?.unique_queries ?? 0),
    };
  } catch (error) {
    console.error("demand gap totals failed", error);
  }

  return {
    topQueries: rollup.map((r) => {
      const t = trendMap.get(r.query);
      return {
        ...r,
        trend7d: t?.current ?? 0,
        prior7d: t?.prior ?? 0,
      };
    }),
    totalZeroEvents30d: totals.total,
    uniqueQueries30d: totals.unique,
    generatedAt: new Date().toISOString(),
  };
}
