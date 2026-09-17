import { query } from "@/lib/db";
import { getZeroResultRollup } from "@/lib/analytics/search-zero-results";

/* ===================================================================== */
/* Types                                                                 */
/* ===================================================================== */

export type DateRangeFilter = "24h" | "7d" | "30d" | "all";

export type MobileEventsSummary = {
  totalEvents: number;
  screenViews: number;
  searches: number;
  zeroResultSearches: number;
  dealsViewed: number;
  dealsRedeemStarted: number;
  activeSignedInUsers: number;
  activeAnonUsers: number;
  totalScreenTimeSeconds: number;
  avgScreenTimeSeconds: number;
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
  context: Record<string, unknown>;
};

export type ScreenTimeRow = {
  screen: string;
  viewsCount: number;
  uniqueUsers: number;
  totalSecondsSpent: number;
  avgSecondsPerVisit: number;
};

export type ScreenUserBreakdown = {
  screen: string;
  userDisplay: string;
  username: string | null;
  userId: string | null;
  anonId: string | null;
  visits: number;
  totalSeconds: number;
};

export type ActiveUser = {
  userId: string | null;
  anonId: string | null;
  fullName: string | null;
  username: string | null;
  eventsCount: number;
  screensVisited: number;
  totalSeconds: number;
  firstSeen: string;
  lastSeen: string;
  /** Distinct native platforms seen for this actor in-range (ios / android). */
  platforms: string[];
  /** Screen with the most views for this actor in-range. */
  topScreen: string | null;
};

export type UserJourneyEvent = {
  id: string;
  eventName: string;
  screen: string | null;
  occurredAt: string;
  sourceContext: string;
  dwellSeconds: number;
  context: Record<string, unknown>;
};

export type DealViewership = {
  dealId: number;
  dealTitle: string;
  listingName: string;
  listingId: number;
  viewCount: number;
  redeemStartedCount: number;
  uniqueViewers: number;
};

export type DealViewerUser = {
  dealId: number;
  userDisplay: string;
  username: string | null;
  userId: string | null;
  anonId: string | null;
  views: number;
  redeemStarted: number;
  lastViewed: string;
};

export type SearchEvent = {
  id: string;
  occurredAt: string;
  surface: "deals" | "search" | "explore" | "listings" | "other";
  userDisplay: string;
  username: string | null;
  userId: string | null;
  anonId: string | null;
  queryText: string;
  resultCount: number;
  hasResults: boolean;
  screen: string | null;
  sourceContext: string;
};

export type MobileEventsFullOverview = {
  summary: MobileEventsSummary;
  screenTimeRows: ScreenTimeRow[];
  screenUserBreakdowns: ScreenUserBreakdown[];
  activeUsers: ActiveUser[];
  dealViewership: DealViewership[];
  dealViewerUsers: DealViewerUser[];
  searchEvents: SearchEvent[];
  zeroResultQueries: ZeroResultQuery[];
  recentEvents: RecentMobileEvent[];
};

/* ===================================================================== */
/* Helpers                                                               */
/* ===================================================================== */

const SEARCH_EVENT_NAMES = ["search_performed", "filters_applied"];
const DEAL_EVENT_NAMES = [
  "offer_viewed",
  "offer_redeem_started",
  "offer_redeemed",
];

function dateRangeClause(
  alias: string,
  col: string,
  range: DateRangeFilter,
): string {
  if (range === "all") return "TRUE";
  const intervals: Record<string, string> = {
    "24h": "1 day",
    "7d": "7 days",
    "30d": "30 days",
  };
  return `${alias}.${col} >= now() - interval '${intervals[range]}'`;
}

/** Native app only — drop Expo web (and any other non-ios/android). */
function nativePlatformClause(alias: string): string {
  return `(${alias}.platform IN ('ios', 'android') OR ${alias}.platform IS NULL)`;
}

/**
 * Dwell time for one `mobile_events` row. The RN client already measures
 * this itself — every navigation/background transition fires a
 * `screen_engaged` event carrying `context.duration_seconds` (see the root
 * layout's screen focus/blur instrumentation) — so prefer that real,
 * client-measured value over a timestamp-gap estimate whenever one exists.
 *
 * Only applied for `screen_viewed` rows specifically: a different event type
 * that happens to carry the same `screen` tag (e.g. a search fired mid-visit)
 * would otherwise get credited with the *whole* visit's duration by matching
 * the same closing `screen_engaged` row, inflating totals. Those rows - and
 * any `screen_viewed` row from a visit that ended without a matching
 * `screen_engaged` (older app builds, or the app being killed mid-visit) -
 * fall back to the previous gap-to-next-event estimate, unchanged.
 */
function realDurationExpr(alias: string): string {
  return `COALESCE(
    CASE WHEN ${alias}.event_name = 'screen_viewed' THEN (
      SELECT NULLIF(se.context->>'duration_seconds', '')::numeric
      FROM public.mobile_events se
      WHERE se.event_name = 'screen_engaged'
        AND se.session_id = ${alias}.session_id
        AND se.screen = ${alias}.screen
        AND se.occurred_at > ${alias}.occurred_at
      ORDER BY se.occurred_at ASC
      LIMIT 1
    ) END,
    EXTRACT(EPOCH FROM (
      LEAD(${alias}.occurred_at) OVER (PARTITION BY ${alias}.session_id ORDER BY ${alias}.occurred_at)
      - ${alias}.occurred_at
    ))
  )`;
}

function parsePlatforms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((p) => String(p).toLowerCase())
      .filter((p) => p === "ios" || p === "android");
  }
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsePlatforms(parsed);
    } catch {
      return value
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p === "ios" || p === "android");
    }
  }
  return [];
}

/* ===================================================================== */
/* Main Data Fetcher                                                     */
/* ===================================================================== */

/**
 * Comprehensive mobile analytics data fetcher.
 * Uses window functions over session_id to compute dwell durations on
 * historical events (no client-side instrumentation required for existing data).
 *
 * Scoped to public.mobile_events only.
 */
export async function getMobileEventsFullOverview(
  range: DateRangeFilter = "7d",
): Promise<MobileEventsFullOverview> {
  const dateFilter = dateRangeClause("me", "occurred_at", range);

  const [
    summaryResult,
    screenTimeResult,
    screenUserResult,
    activeUsersResult,
    dealViewResult,
    dealViewerUsersResult,
    searchResult,
    rollupRows,
    recentResult,
  ] = await Promise.all([
    /* 1. Summary KPIs */
    query(
      `SELECT
         COUNT(*)::int AS total_events,
         COUNT(*) FILTER (WHERE event_name = 'screen_viewed')::int AS screen_views,
         COUNT(*) FILTER (WHERE event_name = ANY($1))::int AS searches,
         COUNT(*) FILTER (WHERE event_name = ANY($1) AND (context->>'hasResults') = 'false')::int AS zero_result_searches,
         COUNT(*) FILTER (WHERE event_name = 'offer_viewed')::int AS deals_viewed,
         COUNT(*) FILTER (WHERE event_name = 'offer_redeem_started')::int AS deals_redeem_started,
         COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS active_signed_in_users,
         COUNT(DISTINCT anon_id) FILTER (WHERE anon_id IS NOT NULL AND user_id IS NULL)::int AS active_anon_users
       FROM public.mobile_events me
       WHERE ${dateFilter}`,
      [SEARCH_EVENT_NAMES],
    ),

    /* 2. Screen time analytics — seconds per page, users, avg duration */
    query(
      `WITH screen_durations AS (
        SELECT
          me.screen,
          me.user_id,
          me.anon_id,
          me.session_id,
          me.occurred_at,
          ${realDurationExpr("me")} AS raw_duration
        FROM public.mobile_events me
        WHERE me.screen IS NOT NULL AND me.screen != ''
          AND ${dateFilter}
          AND ${nativePlatformClause("me")}
      )
      SELECT
        screen,
        COUNT(*)::int AS views_count,
        COUNT(DISTINCT COALESCE(user_id::text, anon_id))::int AS unique_users,
        ROUND(SUM(CASE WHEN raw_duration > 0 AND raw_duration < 1800 THEN raw_duration ELSE 15 END)::numeric, 0)::int AS total_seconds_spent,
        ROUND(AVG(CASE WHEN raw_duration > 0 AND raw_duration < 1800 THEN raw_duration ELSE 15 END)::numeric, 1) AS avg_seconds_per_visit
      FROM screen_durations
      GROUP BY screen
      ORDER BY total_seconds_spent DESC`,
    ),

    /* 3. Per-user screen time breakdown */
    query(
      `WITH screen_durations AS (
        SELECT
          me.screen,
          me.user_id,
          me.anon_id,
          me.session_id,
          me.occurred_at,
          ${realDurationExpr("me")} AS raw_duration
        FROM public.mobile_events me
        WHERE me.screen IS NOT NULL AND me.screen != ''
          AND ${dateFilter}
          AND ${nativePlatformClause("me")}
      )
      SELECT
        sd.screen,
        COALESCE(p.full_name, 'Anonymous ' || SUBSTRING(sd.anon_id, 1, 8)) AS user_display,
        p.username,
        sd.user_id::text,
        sd.anon_id,
        COUNT(*)::int AS visits,
        ROUND(SUM(CASE WHEN sd.raw_duration > 0 AND sd.raw_duration < 1800 THEN sd.raw_duration ELSE 15 END)::numeric, 0)::int AS total_seconds
      FROM screen_durations sd
      LEFT JOIN public.profiles p ON p.id = sd.user_id
      GROUP BY sd.screen, user_display, p.username, sd.user_id, sd.anon_id
      ORDER BY total_seconds DESC
      LIMIT 200`,
    ),

    /* 4. Active users list — platforms + most-viewed screen */
    query(
      `WITH user_events AS (
        SELECT
          me.user_id,
          me.anon_id,
          me.screen,
          me.platform,
          me.event_name,
          me.occurred_at,
          me.session_id,
          ${realDurationExpr("me")} AS raw_duration
        FROM public.mobile_events me
        WHERE ${dateFilter}
          AND ${nativePlatformClause("me")}
      ),
      ranked_screens AS (
        SELECT
          user_id,
          anon_id,
          screen AS top_screen,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, anon_id
            ORDER BY COUNT(*) DESC
          ) AS rn
        FROM user_events
        WHERE screen IS NOT NULL AND screen != ''
          AND event_name = 'screen_viewed'
        GROUP BY user_id, anon_id, screen
      )
      SELECT
        ue.user_id::text,
        ue.anon_id,
        p.full_name,
        p.username,
        COUNT(*)::int AS events_count,
        COUNT(DISTINCT ue.screen)::int AS screens_visited,
        ROUND(SUM(CASE WHEN ue.raw_duration > 0 AND ue.raw_duration < 1800 THEN ue.raw_duration ELSE 5 END)::numeric, 0)::int AS total_seconds,
        MIN(ue.occurred_at)::text AS first_seen,
        MAX(ue.occurred_at)::text AS last_seen,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT LOWER(ue.platform)), NULL) AS platforms,
        MAX(ts.top_screen) AS top_screen
      FROM user_events ue
      LEFT JOIN public.profiles p ON p.id = ue.user_id
      LEFT JOIN ranked_screens ts
        ON ts.rn = 1
        AND ts.user_id IS NOT DISTINCT FROM ue.user_id
        AND ts.anon_id IS NOT DISTINCT FROM ue.anon_id
      GROUP BY ue.user_id, ue.anon_id, p.full_name, p.username
      ORDER BY events_count DESC
      LIMIT 50`,
    ),

    /* 5. Deals viewership — join with deals + listings */
    query(
      `WITH deal_events AS (
        SELECT
          me.id,
          me.event_name,
          me.user_id,
          me.anon_id,
          NULLIF((me.context->>'dealId'), '')::bigint AS deal_id,
          NULLIF((me.context->>'listingId'), '')::bigint AS listing_id
        FROM public.mobile_events me
        WHERE me.event_name = ANY($1)
          AND me.context->>'dealId' IS NOT NULL
          AND ${dateFilter}
      )
      SELECT
         de.deal_id,
         d.title AS deal_title,
         l.name AS listing_name,
         de.listing_id,
         COUNT(*) FILTER (WHERE de.event_name = 'offer_viewed')::int AS view_count,
         COUNT(*) FILTER (WHERE de.event_name = 'offer_redeem_started')::int AS redeem_started_count,
         COUNT(DISTINCT COALESCE(de.user_id::text, de.anon_id))::int AS unique_viewers
       FROM deal_events de
       LEFT JOIN public.deals d ON d.id = de.deal_id
       LEFT JOIN public.listings l ON l.id = de.listing_id
       GROUP BY de.deal_id, d.title, l.name, de.listing_id
       ORDER BY view_count DESC
       LIMIT 50`,
      [DEAL_EVENT_NAMES],
    ),

    /* 6. Deal viewer users — who viewed which deals */
    query(
      `WITH deal_events AS (
        SELECT
          me.id,
          me.event_name,
          me.user_id,
          me.anon_id,
          me.occurred_at,
          NULLIF((me.context->>'dealId'), '')::bigint AS deal_id
        FROM public.mobile_events me
        WHERE me.event_name = ANY($1)
          AND me.context->>'dealId' IS NOT NULL
          AND ${dateFilter}
      )
      SELECT
         de.deal_id,
         COALESCE(p.full_name, 'Anonymous ' || SUBSTRING(de.anon_id, 1, 8)) AS user_display,
         p.username,
         de.user_id::text,
         de.anon_id,
         COUNT(*) FILTER (WHERE de.event_name = 'offer_viewed')::int AS views,
         COUNT(*) FILTER (WHERE de.event_name = 'offer_redeem_started')::int AS redeem_started,
         MAX(de.occurred_at)::text AS last_viewed
       FROM deal_events de
       LEFT JOIN public.profiles p ON p.id = de.user_id
       GROUP BY de.deal_id, user_display, p.username, de.user_id, de.anon_id
       ORDER BY views DESC
       LIMIT 200`,
      [DEAL_EVENT_NAMES],
    ),

    /* 7. Search events by surface and user */
    query(
      `SELECT
         me.id::text,
         me.occurred_at::text,
         me.screen,
         me.source_context,
         COALESCE(p.full_name, 'Anonymous ' || SUBSTRING(me.anon_id, 1, 8)) AS user_display,
         p.username,
         me.user_id::text,
         me.anon_id,
         COALESCE(me.context->>'query', '') AS query_text,
         COALESCE((me.context->>'resultCount')::int, 0) AS result_count,
         COALESCE((me.context->>'hasResults')::boolean, true) AS has_results
       FROM public.mobile_events me
       LEFT JOIN public.profiles p ON p.id = me.user_id
       WHERE me.event_name = ANY($1)
         AND ${dateFilter}
       ORDER BY me.occurred_at DESC
       LIMIT 200`,
      [SEARCH_EVENT_NAMES],
    ),

    /* 8. Zero-result rollup (30 days always for demand gap context) */
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
         LIMIT 30`,
        [SEARCH_EVENT_NAMES],
      );
      return live.map((r) => ({
        query: String(r.query),
        zeroCount: Number(r.count),
        daysActive: 1,
        lastDay: String(r.last_seen),
      }));
    }),

    /* 9. Recent events with full context */
    query(
      `SELECT me.id, me.event_name, me.occurred_at, me.source_context, me.screen,
              me.platform, me.user_id, me.anon_id,
              (me.user_id IS NOT NULL) AS is_authenticated,
              p.full_name AS actor_name, p.username AS actor_username,
              me.context
       FROM public.mobile_events me
       LEFT JOIN public.profiles p ON p.id = me.user_id
       WHERE ${dateFilter}
       ORDER BY me.occurred_at DESC
       LIMIT 200`,
    ),
  ]);

  /* ——— Map results ——— */

  const s = summaryResult.rows[0];

  const screenTimeRows: ScreenTimeRow[] = screenTimeResult.rows.map((r) => ({
    screen: r.screen,
    viewsCount: Number(r.views_count),
    uniqueUsers: Number(r.unique_users),
    totalSecondsSpent: Number(r.total_seconds_spent),
    avgSecondsPerVisit: Number(r.avg_seconds_per_visit),
  }));

  const totalScreenTime = screenTimeRows.reduce(
    (acc, r) => acc + r.totalSecondsSpent,
    0,
  );
  const totalScreenViews = screenTimeRows.reduce(
    (acc, r) => acc + r.viewsCount,
    0,
  );

  return {
    summary: {
      totalEvents: Number(s.total_events),
      screenViews: Number(s.screen_views),
      searches: Number(s.searches),
      zeroResultSearches: Number(s.zero_result_searches),
      dealsViewed: Number(s.deals_viewed),
      dealsRedeemStarted: Number(s.deals_redeem_started),
      activeSignedInUsers: Number(s.active_signed_in_users),
      activeAnonUsers: Number(s.active_anon_users),
      totalScreenTimeSeconds: totalScreenTime,
      avgScreenTimeSeconds:
        totalScreenViews > 0
          ? Math.round(totalScreenTime / totalScreenViews)
          : 0,
    },
    screenTimeRows,
    screenUserBreakdowns: screenUserResult.rows.map((r) => ({
      screen: r.screen,
      userDisplay: r.user_display,
      username: r.username,
      userId: r.user_id ?? null,
      anonId: r.anon_id ?? null,
      visits: Number(r.visits),
      totalSeconds: Number(r.total_seconds),
    })),
    activeUsers: activeUsersResult.rows.map((r) => ({
      userId: r.user_id ?? null,
      anonId: r.anon_id ?? null,
      fullName: r.full_name ?? null,
      username: r.username ?? null,
      eventsCount: Number(r.events_count),
      screensVisited: Number(r.screens_visited),
      totalSeconds: Number(r.total_seconds),
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      platforms: parsePlatforms(r.platforms),
      topScreen: r.top_screen ? String(r.top_screen) : null,
    })),
    dealViewership: dealViewResult.rows.map((r) => ({
      dealId: Number(r.deal_id),
      dealTitle: r.deal_title ?? `Deal #${r.deal_id}`,
      listingName: r.listing_name ?? `Listing #${r.listing_id}`,
      listingId: Number(r.listing_id),
      viewCount: Number(r.view_count),
      redeemStartedCount: Number(r.redeem_started_count),
      uniqueViewers: Number(r.unique_viewers),
    })),
    dealViewerUsers: dealViewerUsersResult.rows.map((r) => ({
      dealId: Number(r.deal_id),
      userDisplay: r.user_display,
      username: r.username ?? null,
      userId: r.user_id ?? null,
      anonId: r.anon_id ?? null,
      views: Number(r.views),
      redeemStarted: Number(r.redeem_started),
      lastViewed: r.last_viewed,
    })),
    searchEvents: searchResult.rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurred_at,
      surface: categorizeSurface(r.source_context, r.screen),
      userDisplay: r.user_display,
      username: r.username ?? null,
      userId: r.user_id ?? null,
      anonId: r.anon_id ?? null,
      queryText: r.query_text ?? "",
      resultCount: Number(r.result_count),
      hasResults: Boolean(r.has_results),
      screen: r.screen,
      sourceContext: r.source_context,
    })),
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
      context:
        typeof r.context === "object" && r.context !== null
          ? (r.context as Record<string, unknown>)
          : {},
    })),
  };
}

/* ===================================================================== */
/* User Journey (loaded on-demand for a specific user)                   */
/* ===================================================================== */

export async function getUserJourney(
  userId: string | null,
  anonId: string | null,
  range: DateRangeFilter = "7d",
): Promise<UserJourneyEvent[]> {
  const dateFilter = dateRangeClause("me", "occurred_at", range);

  const identityClause = userId
    ? `me.user_id = $1`
    : `me.anon_id = $1 AND me.user_id IS NULL`;
  const identityParam = userId ?? anonId;

  const result = await query(
    `WITH ordered AS (
      SELECT
        me.id::text,
        me.event_name,
        me.screen,
        me.occurred_at::text,
        me.source_context,
        me.context,
        ${realDurationExpr("me")} AS raw_duration
      FROM public.mobile_events me
      WHERE ${identityClause}
        AND ${dateFilter}
        AND ${nativePlatformClause("me")}
    )
    SELECT
      id, event_name, screen, occurred_at, source_context, context,
      CASE WHEN raw_duration > 0 AND raw_duration < 1800 THEN ROUND(raw_duration::numeric, 1) ELSE 0 END AS dwell_seconds
    FROM ordered
    ORDER BY occurred_at DESC
    LIMIT 500`,
    [identityParam],
  );

  return result.rows.map((r) => ({
    id: r.id,
    eventName: r.event_name,
    screen: r.screen,
    occurredAt: r.occurred_at,
    sourceContext: r.source_context,
    dwellSeconds: Number(r.dwell_seconds),
    context:
      typeof r.context === "object" && r.context !== null
        ? (r.context as Record<string, unknown>)
        : {},
  }));
}

/* ===================================================================== */
/* Screen users (modal drill-down for a single screen)                   */
/* ===================================================================== */

export async function getScreenUsers(
  screen: string,
  range: DateRangeFilter = "7d",
  isPrefix: boolean = false,
): Promise<ScreenUserBreakdown[]> {
  const dateFilter = dateRangeClause("me", "occurred_at", range);
  const normalized = screen.startsWith("/") ? screen.slice(1) : screen;
  const isHome = !normalized || normalized.toLowerCase() === "home";

  let screenCondition: string;
  let params: string[];

  if (isHome) {
    screenCondition = `(me.screen = '' OR me.screen = '/' OR LOWER(me.screen) = 'home')`;
    params = [];
  } else if (isPrefix) {
    screenCondition = `(me.screen = $1 OR me.screen = $2 OR me.screen LIKE $1 || '/%' OR me.screen LIKE $2 || '/%')`;
    params = [normalized, `/${normalized}`];
  } else {
    screenCondition = `(me.screen = $1 OR me.screen = $2)`;
    params = [normalized, `/${normalized}`];
  }

  const result = await query(
    `WITH screen_durations AS (
      SELECT
        me.screen,
        me.user_id,
        me.anon_id,
        me.session_id,
        me.occurred_at,
        ${realDurationExpr("me")} AS raw_duration
      FROM public.mobile_events me
      WHERE ${screenCondition}
        AND ${dateFilter}
        AND ${nativePlatformClause("me")}
    )
    SELECT
      ${isHome ? "'Home'" : "$1"} AS screen,
      COALESCE(p.full_name, 'Anonymous ' || SUBSTRING(sd.anon_id, 1, 8)) AS user_display,
      p.username,
      sd.user_id::text,
      sd.anon_id,
      COUNT(*)::int AS visits,
      ROUND(SUM(CASE WHEN sd.raw_duration > 0 AND sd.raw_duration < 1800 THEN sd.raw_duration ELSE 15 END)::numeric, 0)::int AS total_seconds
    FROM screen_durations sd
    LEFT JOIN public.profiles p ON p.id = sd.user_id
    GROUP BY user_display, p.username, sd.user_id, sd.anon_id
    ORDER BY total_seconds DESC
    LIMIT 200`,
    params,
  );

  return result.rows.map((r) => ({
    screen: String(r.screen),
    userDisplay: String(r.user_display),
    username: r.username ? String(r.username) : null,
    userId: r.user_id ? String(r.user_id) : null,
    anonId: r.anon_id ? String(r.anon_id) : null,
    visits: Number(r.visits),
    totalSeconds: Number(r.total_seconds),
  }));
}

/* ===================================================================== */
/* Backwards-compatible legacy export (used by other callers if any)     */
/* ===================================================================== */

/** @deprecated Use getMobileEventsFullOverview instead. */
export async function getMobileEventsOverview() {
  const full = await getMobileEventsFullOverview("7d");
  return {
    summary: {
      totalLast7d: full.summary.totalEvents,
      screenViewsLast7d: full.summary.screenViews,
      searchesLast7d: full.summary.searches,
      zeroResultLast7d: full.summary.zeroResultSearches,
    },
    zeroResultQueries: full.zeroResultQueries,
    recentEvents: full.recentEvents,
  };
}

/* ===================================================================== */
/* Surface categorization                                                */
/* ===================================================================== */

function categorizeSurface(
  sourceContext: string,
  screen: string | null,
): SearchEvent["surface"] {
  const sc = (sourceContext ?? "").toLowerCase();
  const scr = (screen ?? "").toLowerCase();

  if (sc === "deals" || scr.includes("deals")) return "deals";
  if (sc === "search_explore" || sc === "search" || scr === "search")
    return "search";
  if (sc === "explore" || scr === "explore") return "explore";
  if (sc === "category_browse" || scr === "listings" || scr === "/listings")
    return "listings";
  return "other";
}
