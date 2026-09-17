import { query } from "@/lib/db";
import {
  KARACHI_NEIGHBORHOODS,
  resolveKarachiNeighborhood,
  calculateDistanceKm,
  type KarachiNeighborhoodInfo,
} from "./karachi-areas";
import type { DateRangeFilter } from "./mobile-events";

/* ===================================================================== */
/* Types                                                                 */
/* ===================================================================== */

export type HeatmapFilterType = "all" | "searches" | "screens" | "deals" | "listings";

export type HeatmapPoint = {
  lat: number;
  lng: number;
  weight: number; // 0.1 to 1.0
  neighborhood: string;
  eventName: string;
  occurredAt: string;
  userId: string | null;
  anonId: string | null;
};

export type NeighborhoodCluster = {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  totalEvents: number;
  uniqueUsers: number;
  activeSignedUsers: number;
  activeAnonUsers: number;
  topSearches: { query: string; count: number }[];
  topListings: { id: number; name: string; views: number }[];
  topDeals: { id: number; title: string; views: number }[];
  totalDwellSeconds: number;
  intensityScore: number; // 0 - 100
  intensityLevel: "blazing" | "hot" | "warm" | "mild";
  categoryAffinity: string[];
};

export type LocationOverviewSummary = {
  totalGeoEvents: number;
  trackedActors: number;
  signedInActors: number;
  anonActors: number;
  hottestNeighborhood: string;
  hottestNeighborhoodEvents: number;
  topLocalSearch: string;
  topLocalListing: string;
  activeHotspotsCount: number;
};

export type AreaUser = {
  userId: string | null;
  anonId: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  eventsCount: number;
  lastSeen: string;
  platform: string | null;
  topScreen: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastEventName: string | null;
};

export type PinnedUserTarget = {
  lat: number;
  lng: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  lastSeen: string;
  platform: string | null;
  topScreen: string | null;
  lastEventName?: string | null;
  isSigned: boolean;
};

export type TrackedUserSummary = {
  actorId: string;
  isUserId: boolean;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  platform: string | null;
  totalPings: number;
  firstSeen: string;
  lastSeen: string;
  lastLatitude: number;
  lastLongitude: number;
  lastNeighborhood: string | null;
  neighborhoodsVisited: string[];
};

export type UserPingHistoryItem = {
  id: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  eventName: string;
  screen: string | null;
  occurredAt: string;
  context: Record<string, any>;
};

export type AreaSearch = {
  query: string;
  count: number;
  lastSeen: string;
  hasResults: boolean;
};

export type AreaListingVisit = {
  listingId: number;
  listingName: string;
  viewCount: number;
  uniqueViewers: number;
};

export type AreaDealEngagement = {
  dealId: number;
  dealTitle: string;
  listingName: string;
  views: number;
  redeems: number;
};

export type AreaHourlyBucket = {
  hour: number;
  count: number;
};

export type AreaEventStreamItem = {
  id: string;
  eventName: string;
  occurredAt: string;
  screen: string | null;
  userDisplay: string;
  sourceContext: string;
  details: string | null;
};

export type AreaDetailIntelligence = {
  neighborhood: string;
  overview: {
    totalEvents: number;
    uniqueUsers: number;
    totalDwellSeconds: number;
    intensityLevel: "blazing" | "hot" | "warm" | "mild";
    peakHour: string;
  };
  topSearches: AreaSearch[];
  topListings: AreaListingVisit[];
  topDeals: AreaDealEngagement[];
  activeUsers: AreaUser[];
  hourlyActivity: AreaHourlyBucket[];
  recentEvents: AreaEventStreamItem[];
};

export type LocationIntelligencePayload = {
  summary: LocationOverviewSummary;
  clusters: NeighborhoodCluster[];
  heatmapPoints: HeatmapPoint[];
};

/* ===================================================================== */
/* Date Helpers                                                          */
/* ===================================================================== */

function dateRangeClause(alias: string, range: DateRangeFilter): string {
  if (range === "24h") return `AND ${alias}.occurred_at >= now() - INTERVAL '24 hours'`;
  if (range === "7d") return `AND ${alias}.occurred_at >= now() - INTERVAL '7 days'`;
  if (range === "30d") return `AND ${alias}.occurred_at >= now() - INTERVAL '30 days'`;
  return "";
}

/* ===================================================================== */
/* Data Fetching Methods                                                 */
/* ===================================================================== */

/**
 * Fetches high-level location overview, neighborhood clusters, and radiant heatmap points.
 */
export async function getLocationIntelligenceData(
  range: DateRangeFilter = "7d",
  filterType: HeatmapFilterType = "all"
): Promise<LocationIntelligencePayload> {
  const dateClause = dateRangeClause("me", range);

  let eventTypeFilter = "";
  if (filterType === "searches") {
    eventTypeFilter = `AND (me.event_name IN ('search_performed', 'filters_applied') OR me.context ? 'query')`;
  } else if (filterType === "screens") {
    eventTypeFilter = `AND me.event_name IN ('screen_viewed', 'screen_engaged')`;
  } else if (filterType === "deals") {
    eventTypeFilter = `AND (me.event_name LIKE 'offer_%' OR me.screen LIKE '%deal%')`;
  } else if (filterType === "listings") {
    eventTypeFilter = `AND (me.screen LIKE '%listing%' OR me.context ? 'listing_id' OR me.context ? 'listingId')`;
  }

  // 1. Fetch RAW points with coordinates within Karachi boundary
  const pointsRes = await query<{
    latitude: number;
    longitude: number;
    neighborhood: string | null;
    event_name: string;
    occurred_at: string;
    user_id: string | null;
    anon_id: string | null;
  }>(
    `SELECT
       me.latitude,
       me.longitude,
       me.neighborhood,
       me.event_name,
       me.occurred_at::text,
       me.user_id,
       me.anon_id
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       AND me.longitude IS NOT NULL
       AND me.latitude BETWEEN 24.6 AND 25.3
       AND me.longitude BETWEEN 66.8 AND 67.5
       ${dateClause}
       ${eventTypeFilter}
     ORDER BY me.occurred_at DESC
     LIMIT 3000`
  );

  const rawPoints = pointsRes.rows;

  // Build mapped heatmap points
  const heatmapPoints: HeatmapPoint[] = rawPoints.map((p) => {
    let weight = 0.5;
    if (p.event_name.startsWith("offer_redeem") || p.event_name === "offer_redeemed") {
      weight = 1.0;
    } else if (p.event_name === "search_performed" || p.event_name.includes("engaged")) {
      weight = 0.8;
    } else if (p.event_name.startsWith("offer_view")) {
      weight = 0.7;
    } else {
      weight = 0.45;
    }

    const resolvedArea =
      p.neighborhood || resolveKarachiNeighborhood(p.latitude, p.longitude);

    return {
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      weight,
      neighborhood: resolvedArea,
      eventName: p.event_name,
      occurredAt: p.occurred_at,
      userId: p.user_id,
      anonId: p.anon_id,
    };
  });

  // 2. Aggregate Neighborhood Data from DB
  const neighborhoodStatsRes = await query<{
    neighborhood: string;
    total_events: string;
    unique_users: string;
    signed_in_users: string;
    anon_users: string;
  }>(
    `SELECT
       COALESCE(me.neighborhood, 'Karachi Central') as neighborhood,
       COUNT(*)::text as total_events,
       COUNT(DISTINCT COALESCE(me.user_id::text, me.anon_id))::text as unique_users,
       COUNT(DISTINCT me.user_id)::text as signed_in_users,
       COUNT(DISTINCT me.anon_id) FILTER (WHERE me.user_id IS NULL)::text as anon_users
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       ${dateClause}
     GROUP BY COALESCE(me.neighborhood, 'Karachi Central')
     ORDER BY COUNT(*) DESC`
  );

  // 3. Top searches per neighborhood
  const neighborhoodSearchesRes = await query<{
    neighborhood: string;
    query_text: string;
    query_count: string;
  }>(
    `SELECT
       COALESCE(me.neighborhood, 'Karachi Central') as neighborhood,
       LOWER(TRIM(COALESCE(me.context->>'query', me.context->>'searchQuery', me.context->>'q', ''))) as query_text,
       COUNT(*)::text as query_count
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       AND (me.event_name = 'search_performed' OR me.context ? 'query')
       AND COALESCE(me.context->>'query', me.context->>'searchQuery', me.context->>'q', '') != ''
       ${dateClause}
     GROUP BY COALESCE(me.neighborhood, 'Karachi Central'), query_text
     HAVING LENGTH(LOWER(TRIM(COALESCE(me.context->>'query', me.context->>'searchQuery', me.context->>'q', '')))) > 1
     ORDER BY COUNT(*) DESC`
  );

  const searchesByArea: Record<string, { query: string; count: number }[]> = {};
  neighborhoodSearchesRes.rows.forEach((r) => {
    if (!searchesByArea[r.neighborhood]) {
      searchesByArea[r.neighborhood] = [];
    }
    if (searchesByArea[r.neighborhood].length < 5) {
      searchesByArea[r.neighborhood].push({
        query: r.query_text,
        count: parseInt(r.query_count, 10),
      });
    }
  });

  // 4. Top listings per neighborhood
  const neighborhoodListingsRes = await query<{
    neighborhood: string;
    listing_id: number;
    listing_name: string;
    views: string;
  }>(
    `SELECT
       COALESCE(me.neighborhood, 'Karachi Central') as neighborhood,
       l.id as listing_id,
       l.name as listing_name,
       COUNT(*)::text as views
     FROM public.mobile_events me
     JOIN public.listings l ON l.id = NULLIF((me.context->>'listing_id'), '')::bigint
                            OR l.id = NULLIF((me.context->>'listingId'), '')::bigint
     WHERE me.latitude IS NOT NULL
       ${dateClause}
     GROUP BY COALESCE(me.neighborhood, 'Karachi Central'), l.id, l.name
     ORDER BY COUNT(*) DESC`
  );

  const listingsByArea: Record<string, { id: number; name: string; views: number }[]> = {};
  neighborhoodListingsRes.rows.forEach((r) => {
    if (!listingsByArea[r.neighborhood]) {
      listingsByArea[r.neighborhood] = [];
    }
    if (listingsByArea[r.neighborhood].length < 5) {
      listingsByArea[r.neighborhood].push({
        id: r.listing_id,
        name: r.listing_name,
        views: parseInt(r.views, 10),
      });
    }
  });

  // Calculate max events for normalized heat intensity
  const maxEvents = Math.max(
    1,
    ...neighborhoodStatsRes.rows.map((r) => parseInt(r.total_events, 10))
  );

  // Map known Karachi neighborhoods into clusters with live data
  const clusters: NeighborhoodCluster[] = KARACHI_NEIGHBORHOODS.map((kn) => {
    const statMatch = neighborhoodStatsRes.rows.find(
      (s) =>
        s.neighborhood.toLowerCase().includes(kn.id) ||
        s.neighborhood.toLowerCase().includes(kn.name.toLowerCase()) ||
        kn.aliasList.some((alias) => s.neighborhood.toLowerCase().includes(alias))
    );

    const totalEvents = statMatch ? parseInt(statMatch.total_events, 10) : 0;
    const uniqueUsers = statMatch ? parseInt(statMatch.unique_users, 10) : 0;
    const activeSignedUsers = statMatch ? parseInt(statMatch.signed_in_users, 10) : 0;
    const activeAnonUsers = statMatch ? parseInt(statMatch.anon_users, 10) : 0;

    const matchedAreaKey = statMatch?.neighborhood || kn.name;
    const topSearches = searchesByArea[matchedAreaKey] || [];
    const topListings = listingsByArea[matchedAreaKey] || [];

    const intensityScore = Math.min(
      100,
      Math.round((totalEvents / maxEvents) * 100)
    );

    let intensityLevel: "blazing" | "hot" | "warm" | "mild" = "mild";
    if (intensityScore >= 75) intensityLevel = "blazing";
    else if (intensityScore >= 45) intensityLevel = "hot";
    else if (intensityScore >= 20) intensityLevel = "warm";

    return {
      id: kn.id,
      name: kn.name,
      center: kn.center,
      radiusKm: kn.radiusKm,
      totalEvents,
      uniqueUsers,
      activeSignedUsers,
      activeAnonUsers,
      topSearches,
      topListings,
      topDeals: [],
      totalDwellSeconds: Math.round(totalEvents * 42),
      intensityScore,
      intensityLevel,
      categoryAffinity: kn.categoryAffinity || [],
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);

  // Summary Metrics
  const totalGeoEvents = rawPoints.length;
  const uniqueActors = new Set(
    rawPoints.map((p) => p.user_id || p.anon_id).filter(Boolean)
  ).size;
  const signedInActors = new Set(
    rawPoints.map((p) => p.user_id).filter(Boolean)
  ).size;
  const anonActors = Math.max(0, uniqueActors - signedInActors);

  const hottestCluster = clusters[0];
  const hottestNeighborhood = hottestCluster?.totalEvents > 0 ? hottestCluster.name : "Gulshan-e-Iqbal";
  const hottestNeighborhoodEvents = hottestCluster?.totalEvents || 0;

  const topSearchOverall =
    neighborhoodSearchesRes.rows[0]?.query_text || "Biryani";
  const topListingOverall =
    neighborhoodListingsRes.rows[0]?.listing_name || "Al-Habib Restaurant";

  const summary: LocationOverviewSummary = {
    totalGeoEvents,
    trackedActors: uniqueActors,
    signedInActors,
    anonActors,
    hottestNeighborhood,
    hottestNeighborhoodEvents,
    topLocalSearch: topSearchOverall,
    topLocalListing: topListingOverall,
    activeHotspotsCount: clusters.filter((c) => c.totalEvents > 0).length,
  };

  return {
    summary,
    clusters,
    heatmapPoints,
  };
}

/**
 * Fetches comprehensive drill-down intelligence for a selected neighborhood.
 */
export async function getAreaDetailIntelligence(
  neighborhoodName: string,
  range: DateRangeFilter = "7d"
): Promise<AreaDetailIntelligence> {
  const dateClause = dateRangeClause("me", range);

  // Match area using fuzzy / substring matching in SQL
  const areaFilter = `AND (me.neighborhood ILIKE $1 OR $1 ILIKE ('%' || me.neighborhood || '%'))`;
  const areaParam = `%${neighborhoodName}%`;

  // 1. Overview counts & dwell time
  const overviewRes = await query<{
    total_events: string;
    unique_users: string;
    total_dwell: string;
  }>(
    `SELECT
       COUNT(*)::text as total_events,
       COUNT(DISTINCT COALESCE(me.user_id::text, me.anon_id))::text as unique_users,
       COALESCE(SUM(
         CASE
           WHEN (me.context->>'dwell_seconds') ~ '^[0-9]+$'
             THEN (me.context->>'dwell_seconds')::int
           WHEN (me.context->>'dwellMs') ~ '^[0-9]+$'
             THEN ((me.context->>'dwellMs')::numeric / 1000)::int
           ELSE 30
         END
       ), 0)::text as total_dwell
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}`,
    [areaParam]
  );

  const totalEvents = parseInt(overviewRes.rows[0]?.total_events || "0", 10);
  const uniqueUsers = parseInt(overviewRes.rows[0]?.unique_users || "0", 10);
  const totalDwellSeconds = parseInt(overviewRes.rows[0]?.total_dwell || "0", 10);

  let intensityLevel: "blazing" | "hot" | "warm" | "mild" = "mild";
  if (totalEvents > 100) intensityLevel = "blazing";
  else if (totalEvents > 40) intensityLevel = "hot";
  else if (totalEvents > 15) intensityLevel = "warm";

  // 2. Top searches in this area
  const searchRes = await query<{
    query: string;
    search_count: string;
    last_seen: string;
    has_results: boolean;
  }>(
    `SELECT
       LOWER(TRIM(COALESCE(me.context->>'query', me.context->>'searchQuery', me.context->>'q', ''))) as query,
       COUNT(*)::text as search_count,
       MAX(me.occurred_at)::text as last_seen,
       COALESCE((me.context->>'hasResults')::boolean, (me.context->>'resultCount')::int > 0, true) as has_results
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       AND (me.event_name = 'search_performed' OR me.context ? 'query')
       AND COALESCE(me.context->>'query', me.context->>'searchQuery', me.context->>'q', '') != ''
       ${areaFilter}
       ${dateClause}
     GROUP BY query, has_results
     ORDER BY COUNT(*) DESC
     LIMIT 15`,
    [areaParam]
  );

  const topSearches: AreaSearch[] = searchRes.rows.map((r) => ({
    query: r.query,
    count: parseInt(r.search_count, 10),
    lastSeen: r.last_seen,
    hasResults: Boolean(r.has_results),
  }));

  // 3. Top listings visited by users located in this area
  const listingsRes = await query<{
    listing_id: number;
    listing_name: string;
    view_count: string;
    unique_viewers: string;
  }>(
    `SELECT
       l.id as listing_id,
       l.name as listing_name,
       COUNT(*)::text as view_count,
       COUNT(DISTINCT COALESCE(me.user_id::text, me.anon_id))::text as unique_viewers
     FROM public.mobile_events me
     JOIN public.listings l ON l.id = NULLIF((me.context->>'listing_id'), '')::bigint
                            OR l.id = NULLIF((me.context->>'listingId'), '')::bigint
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}
     GROUP BY l.id, l.name
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    [areaParam]
  );

  const topListings: AreaListingVisit[] = listingsRes.rows.map((r) => ({
    listingId: r.listing_id,
    listingName: r.listing_name,
    viewCount: parseInt(r.view_count, 10),
    uniqueViewers: parseInt(r.unique_viewers, 10),
  }));

  // 4. Deals viewed / redeemed in this area
  const dealsRes = await query<{
    deal_id: number;
    deal_title: string;
    listing_name: string;
    views: string;
    redeems: string;
  }>(
    `SELECT
       d.id as deal_id,
       d.title as deal_title,
       COALESCE(l.name, 'Inside Karachi Partner') as listing_name,
       COUNT(*) FILTER (WHERE me.event_name LIKE 'offer_view%')::text as views,
       COUNT(*) FILTER (WHERE me.event_name LIKE 'offer_redeem%')::text as redeems
     FROM public.mobile_events me
     JOIN public.deals d ON d.id = NULLIF((me.context->>'deal_id'), '')::bigint
                         OR d.id = NULLIF((me.context->>'offer_id'), '')::bigint
     LEFT JOIN public.listings l ON l.id = d.listing_id
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}
     GROUP BY d.id, d.title, l.name
     ORDER BY COUNT(*) DESC
     LIMIT 10`,
    [areaParam]
  );

  const topDeals: AreaDealEngagement[] = dealsRes.rows.map((r) => ({
    dealId: r.deal_id,
    dealTitle: r.deal_title,
    listingName: r.listing_name,
    views: parseInt(r.views, 10),
    redeems: parseInt(r.redeems, 10),
  }));

  // 5. Active users roster in this area
  const usersRes = await query<{
    user_id: string | null;
    anon_id: string | null;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    events_count: string;
    last_seen: string;
    platform: string | null;
    top_screen: string | null;
    last_latitude: number | null;
    last_longitude: number | null;
    last_event_name: string | null;
  }>(
    `SELECT
       me.user_id,
       me.anon_id,
       p.full_name,
       p.username,
       p.avatar_url,
       COUNT(*)::text as events_count,
       MAX(me.occurred_at)::text as last_seen,
       MAX(me.platform) as platform,
       (ARRAY_AGG(me.latitude ORDER BY me.occurred_at DESC))[1] as last_latitude,
       (ARRAY_AGG(me.longitude ORDER BY me.occurred_at DESC))[1] as last_longitude,
       (ARRAY_AGG(me.event_name ORDER BY me.occurred_at DESC))[1] as last_event_name,
       (
         SELECT sub.screen
         FROM public.mobile_events sub
         WHERE sub.screen IS NOT NULL
           AND (
             (me.user_id IS NOT NULL AND sub.user_id = me.user_id) OR
             (me.user_id IS NULL AND sub.anon_id = me.anon_id)
           )
         ORDER BY sub.occurred_at DESC
         LIMIT 1
       ) as top_screen
     FROM public.mobile_events me
     LEFT JOIN public.profiles p ON p.id = me.user_id
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}
     GROUP BY me.user_id, me.anon_id, p.full_name, p.username, p.avatar_url
     ORDER BY COUNT(*) DESC
     LIMIT 20`,
    [areaParam]
  );

  const activeUsers: AreaUser[] = usersRes.rows.map((r) => ({
    userId: r.user_id,
    anonId: r.anon_id,
    fullName: r.full_name,
    username: r.username,
    avatarUrl: r.avatar_url,
    eventsCount: parseInt(r.events_count, 10),
    lastSeen: r.last_seen,
    platform: r.platform,
    topScreen: r.top_screen,
    lastLatitude: r.last_latitude ? Number(r.last_latitude) : null,
    lastLongitude: r.last_longitude ? Number(r.last_longitude) : null,
    lastEventName: r.last_event_name,
  }));

  // 6. Hourly activity distribution
  const hourlyRes = await query<{
    hour_of_day: number;
    event_count: string;
  }>(
    `SELECT
       EXTRACT(HOUR FROM me.occurred_at)::int as hour_of_day,
       COUNT(*)::text as event_count
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}
     GROUP BY hour_of_day
     ORDER BY hour_of_day ASC`,
    [areaParam]
  );

  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
  hourlyRes.rows.forEach((r) => {
    hourlyMap.set(r.hour_of_day, parseInt(r.event_count, 10));
  });

  const hourlyActivity: AreaHourlyBucket[] = Array.from(hourlyMap.entries()).map(
    ([hour, count]) => ({ hour, count })
  );

  // Determine peak hour
  let peakHour = "8:00 PM";
  let maxCount = -1;
  hourlyActivity.forEach((b) => {
    if (b.count > maxCount) {
      maxCount = b.count;
      const period = b.hour >= 12 ? "PM" : "AM";
      const displayH = b.hour % 12 === 0 ? 12 : b.hour % 12;
      peakHour = `${displayH}:00 ${period}`;
    }
  });

  // 7. Recent Area Event Stream
  const recentEventsRes = await query<{
    id: string;
    event_name: string;
    occurred_at: string;
    screen: string | null;
    source_context: string;
    user_id: string | null;
    anon_id: string | null;
    full_name: string | null;
    username: string | null;
    context: Record<string, unknown>;
  }>(
    `SELECT
       me.id::text,
       me.event_name,
       me.occurred_at::text,
       me.screen,
       me.source_context,
       me.user_id,
       me.anon_id,
       p.full_name,
       p.username,
       me.context
     FROM public.mobile_events me
     LEFT JOIN public.profiles p ON p.id = me.user_id
     WHERE me.latitude IS NOT NULL
       ${areaFilter}
       ${dateClause}
     ORDER BY me.occurred_at DESC
     LIMIT 30`,
    [areaParam]
  );

  const recentEvents: AreaEventStreamItem[] = recentEventsRes.rows.map((r) => {
    let userDisplay = "Anonymous User";
    if (r.full_name) userDisplay = r.full_name;
    else if (r.username) userDisplay = `@${r.username}`;
    else if (r.anon_id) userDisplay = `Device ${r.anon_id.slice(-6)}`;

    let details: string | null = null;
    if (r.context) {
      if (typeof r.context.query === "string") details = `Searched: "${r.context.query}"`;
      else if (typeof r.context.searchQuery === "string") details = `Searched: "${r.context.searchQuery}"`;
      else if (typeof r.context.listing_name === "string") details = `Viewed: ${r.context.listing_name}`;
      else if (typeof r.context.offer_title === "string") details = `Offer: ${r.context.offer_title}`;
    }

    return {
      id: r.id,
      eventName: r.event_name,
      occurredAt: r.occurred_at,
      screen: r.screen,
      userDisplay,
      sourceContext: r.source_context,
      details,
    };
  });

  return {
    neighborhood: neighborhoodName,
    overview: {
      totalEvents,
      uniqueUsers,
      totalDwellSeconds,
      intensityLevel,
      peakHour,
    },
    topSearches,
    topListings,
    topDeals,
    activeUsers,
    hourlyActivity,
    recentEvents,
  };
}

/**
 * Fetches all tracked users with their location summary across Karachi
 */
export async function getAllTrackedUsers(
  range: DateRangeFilter = "7d",
  search?: string
): Promise<TrackedUserSummary[]> {
  const dateClause = dateRangeClause("me", range);
  const params: any[] = [];
  let searchFilter = "";

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    const pIdx = params.length;
    searchFilter = `AND (
      LOWER(p.full_name) LIKE $${pIdx} OR
      LOWER(p.username) LIKE $${pIdx} OR
      LOWER(me.anon_id) LIKE $${pIdx} OR
      LOWER(me.neighborhood) LIKE $${pIdx}
    )`;
  }

  const res = await query<{
    actor_id: string;
    is_user_id: boolean;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    platform: string | null;
    total_pings: string;
    first_seen: string;
    last_seen: string;
    last_latitude: number;
    last_longitude: number;
    last_neighborhood: string | null;
    neighborhoods: string[] | null;
  }>(
    `SELECT
       COALESCE(me.user_id::text, me.anon_id) as actor_id,
       (me.user_id IS NOT NULL) as is_user_id,
       p.full_name,
       p.username,
       p.avatar_url,
       MODE() WITHIN GROUP (ORDER BY me.platform) as platform,
       COUNT(*)::text as total_pings,
       MIN(me.occurred_at)::text as first_seen,
       MAX(me.occurred_at)::text as last_seen,
       (
         SELECT sub.latitude
         FROM public.mobile_events sub
         WHERE sub.latitude IS NOT NULL
           AND (
             (me.user_id IS NOT NULL AND sub.user_id = me.user_id) OR
             (me.user_id IS NULL AND sub.anon_id = me.anon_id)
           )
         ORDER BY sub.occurred_at DESC
         LIMIT 1
       ) as last_latitude,
       (
         SELECT sub.longitude
         FROM public.mobile_events sub
         WHERE sub.longitude IS NOT NULL
           AND (
             (me.user_id IS NOT NULL AND sub.user_id = me.user_id) OR
             (me.user_id IS NULL AND sub.anon_id = me.anon_id)
           )
         ORDER BY sub.occurred_at DESC
         LIMIT 1
       ) as last_longitude,
       (
         SELECT sub.neighborhood
         FROM public.mobile_events sub
         WHERE sub.neighborhood IS NOT NULL
           AND (
             (me.user_id IS NOT NULL AND sub.user_id = me.user_id) OR
             (me.user_id IS NULL AND sub.anon_id = me.anon_id)
           )
         ORDER BY sub.occurred_at DESC
         LIMIT 1
       ) as last_neighborhood,
       array_agg(DISTINCT me.neighborhood) FILTER (WHERE me.neighborhood IS NOT NULL) as neighborhoods
     FROM public.mobile_events me
     LEFT JOIN public.profiles p ON p.id = me.user_id
     WHERE me.latitude IS NOT NULL
       ${dateClause}
       ${searchFilter}
     GROUP BY me.user_id, me.anon_id, p.full_name, p.username, p.avatar_url
     ORDER BY COUNT(*) DESC, MAX(me.occurred_at) DESC
     LIMIT 100`,
    params
  );

  return res.rows.map((r) => ({
    actorId: r.actor_id,
    isUserId: r.is_user_id,
    fullName: r.full_name,
    username: r.username,
    avatarUrl: r.avatar_url,
    platform: r.platform,
    totalPings: parseInt(r.total_pings, 10),
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    lastLatitude: Number(r.last_latitude) || 24.89,
    lastLongitude: Number(r.last_longitude) || 67.06,
    lastNeighborhood: r.last_neighborhood,
    neighborhoodsVisited: r.neighborhoods || [],
  }));
}

/**
 * Fetches chronological location pings for a specific user to draw their movement path
 */
export async function getUserLocationPings(
  actorId: string,
  isUserId: boolean,
  range: DateRangeFilter = "all"
): Promise<UserPingHistoryItem[]> {
  const dateClause = dateRangeClause("me", range);
  const params: any[] = [actorId];

  const userCondition = isUserId
    ? "me.user_id::text = $1"
    : "me.anon_id = $1";

  const res = await query<{
    id: string;
    latitude: number;
    longitude: number;
    neighborhood: string | null;
    event_name: string;
    screen: string | null;
    occurred_at: string;
    context: any;
  }>(
    `SELECT
       me.id,
       me.latitude,
       me.longitude,
       me.neighborhood,
       me.event_name,
       COALESCE(me.screen, me.context->>'screen') as screen,
       me.occurred_at::text,
       me.context
     FROM public.mobile_events me
     WHERE me.latitude IS NOT NULL
       AND me.longitude IS NOT NULL
       AND ${userCondition}
       ${dateClause}
     ORDER BY me.occurred_at ASC
     LIMIT 300`,
    params
  );

  return res.rows.map((r) => ({
    id: r.id,
    lat: Number(r.latitude),
    lng: Number(r.longitude),
    neighborhood: r.neighborhood,
    eventName: r.event_name,
    screen: r.screen,
    occurredAt: r.occurred_at,
    context: r.context || {},
  }));
}
