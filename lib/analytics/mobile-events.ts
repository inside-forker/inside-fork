import { query } from "@/lib/db";
import { getZeroResultRollup } from "@/lib/analytics/search-zero-results";

export type MobileEventsSummary = {
  totalLast7d: number;
  screenViewsLast7d: number;
  searchesLast7d: number;
  zeroResultLast7d: number;
};

export type ZeroResultQuery = {
  query: string;
  count: number;
  lastSeen: string;
  daysActive?: number;
};

export type RecentMobileEvent = {
  id: string;
  eventName: string;
  occurredAt: string;
  sourceContext: string;
  screen: string | null;
  platform: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  anonId: string | null;
  actorName: string | null;
  actorUsername: string | null;
};

export type MobileEventsOverview = {
  summary: MobileEventsSummary;
  zeroResultQueries: ZeroResultQuery[];
  recentEvents: RecentMobileEvent[];
};

const SEARCH_EVENT_NAMES = ["search_performed", "filters_applied"];

/**
 * Scoped to public.mobile_events only - deliberately not merged with
 * lib/analytics/admin.ts, which is scoped to the web's separate,
 * enum-typed analytics_events table.
 */
export async function getMobileEventsOverview(): Promise<MobileEventsOverview> {
  const [summaryResult, rollupRows, recentResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE occurred_at >= now() - interval '7 days') AS total_last_7d,
         COUNT(*) FILTER (WHERE event_name = 'screen_viewed' AND occurred_at >= now() - interval '7 days') AS screen_views_last_7d,
         COUNT(*) FILTER (WHERE event_name = ANY($1) AND occurred_at >= now() - interval '7 days') AS searches_last_7d,
         COUNT(*) FILTER (WHERE event_name = ANY($1) AND (context->>'hasResults') = 'false' AND occurred_at >= now() - interval '7 days') AS zero_result_last_7d
       FROM public.mobile_events`,
      [SEARCH_EVENT_NAMES],
    ),
    getZeroResultRollup(30, 30).then(async (rows) => {
      if (rows.length > 0) return rows;
      const { rows: live } = await query(
        `SELECT context->>'query' AS query, COUNT(*) AS count, MAX(occurred_at) AS last_seen
         FROM public.mobile_events
         WHERE event_name = ANY($1)
           AND (context->>'hasResults') = 'false'
           AND context->>'query' IS NOT NULL AND context->>'query' != ''
           AND occurred_at >= now() - interval '30 days'
         GROUP BY context->>'query'
         ORDER BY count DESC, last_seen DESC
         LIMIT 20`,
        [SEARCH_EVENT_NAMES],
      );
      return live.map((r) => ({
        query: String(r.query),
        zeroCount: Number(r.count),
        daysActive: 1,
        lastDay: String(r.last_seen),
      }));
    }),
    query(
      `SELECT me.id, me.event_name, me.occurred_at, me.source_context, me.screen,
              me.platform, me.user_id, me.anon_id,
              (me.user_id IS NOT NULL) AS is_authenticated,
              p.full_name AS actor_name, p.username AS actor_username
       FROM public.mobile_events me
       LEFT JOIN public.profiles p ON p.id = me.user_id
       ORDER BY me.occurred_at DESC
       LIMIT 100`,
    ),
  ]);

  const s = summaryResult.rows[0];
  return {
    summary: {
      totalLast7d: Number(s.total_last_7d),
      screenViewsLast7d: Number(s.screen_views_last_7d),
      searchesLast7d: Number(s.searches_last_7d),
      zeroResultLast7d: Number(s.zero_result_last_7d),
    },
    zeroResultQueries: rollupRows.map((r) => ({
      query: r.query,
      count: r.zeroCount,
      lastSeen: r.lastDay,
      daysActive: r.daysActive,
    })),
    recentEvents: recentResult.rows.map((r) => ({
      id: String(r.id),
      eventName: r.event_name,
      occurredAt: r.occurred_at,
      sourceContext: r.source_context,
      screen: r.screen,
      platform: r.platform,
      isAuthenticated: Boolean(r.is_authenticated),
      userId: r.user_id ? String(r.user_id) : null,
      anonId: r.anon_id ? String(r.anon_id) : null,
      actorName: r.actor_name ? String(r.actor_name) : null,
      actorUsername: r.actor_username ? String(r.actor_username) : null,
    })),
  };
}
