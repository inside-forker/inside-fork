import { query } from "@/lib/db";

export type MarketplaceHealthSnapshot = {
  day: string;
  dau: number;
  wau: number;
  searchZeroCount7d: number;
  searchTotal7d: number;
  searchZeroResultRate7d: number;
  validatedRedemptions7d: number;
  billGmv7d: number;
  listingsWithRedemption30d: number;
  publishedListings: number;
  redemptionListingRate30d: number;
  computedAt: string;
};

/**
 * Upsert today's marketplace health row from live Postgres signals.
 * Timezone for "day" buckets: Asia/Karachi (product local).
 */
export async function refreshMarketplaceHealthDaily(): Promise<MarketplaceHealthSnapshot> {
  const { rows } = await query(`
    WITH bounds AS (
      SELECT
        (now() AT TIME ZONE 'Asia/Karachi')::date AS today_pk,
        (now() AT TIME ZONE 'Asia/Karachi')::date - INTERVAL '1 day' AS yesterday_pk
    ),
    dau AS (
      SELECT COUNT(DISTINCT user_id)::int AS n
      FROM public.audit_logs, bounds
      WHERE action = 'user_login'
        AND user_id IS NOT NULL
        AND (created_at AT TIME ZONE 'Asia/Karachi')::date = bounds.today_pk
    ),
    wau AS (
      SELECT COUNT(DISTINCT user_id)::int AS n
      FROM public.audit_logs
      WHERE action = 'user_login'
        AND user_id IS NOT NULL
        AND created_at >= now() - INTERVAL '7 days'
    ),
    search_totals AS (
      SELECT
        (
          SELECT COUNT(*)::int
          FROM public.mobile_events
          WHERE event_name IN ('search_performed', 'filters_applied')
            AND occurred_at >= now() - INTERVAL '7 days'
        ) + (
          SELECT COUNT(*)::int
          FROM public.analytics_events
          WHERE event_type = 'search_performed'
            AND occurred_at >= now() - INTERVAL '7 days'
        ) AS total_7d,
        (
          SELECT COUNT(*)::int
          FROM public.mobile_events
          WHERE event_name IN ('search_performed', 'filters_applied')
            AND (context->>'hasResults') = 'false'
            AND occurred_at >= now() - INTERVAL '7 days'
        ) + (
          SELECT COUNT(*)::int
          FROM public.analytics_events
          WHERE event_type = 'search_performed'
            AND (
              (context->>'hasResults') = 'false'
              OR (context->>'has_results') = 'false'
              OR COALESCE((context->>'resultCount')::int, (context->>'result_count')::int, -1) = 0
            )
            AND occurred_at >= now() - INTERVAL '7 days'
        ) AS zero_7d
    ),
    redemptions AS (
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'validated' AND validated_at >= now() - INTERVAL '7 days'
        )::int AS validated_7d,
        COALESCE(SUM(bill_value) FILTER (
          WHERE status = 'validated' AND validated_at >= now() - INTERVAL '7 days'
        ), 0)::float AS bill_gmv_7d
      FROM public.redemptions
    ),
    listing_cov AS (
      SELECT
        (SELECT COUNT(*)::int FROM public.listings WHERE status = 'published') AS published,
        (
          SELECT COUNT(DISTINCT listing_id)::int
          FROM public.redemptions
          WHERE status = 'validated'
            AND validated_at >= now() - INTERVAL '30 days'
        ) AS with_redemption_30d
    )
    INSERT INTO public.marketplace_health_daily (
      day, dau, wau,
      search_zero_count_7d, search_total_7d, search_zero_result_rate_7d,
      validated_redemptions_7d, bill_gmv_7d,
      listings_with_redemption_30d, published_listings, redemption_listing_rate_30d,
      computed_at
    )
    SELECT
      bounds.today_pk,
      dau.n,
      wau.n,
      search_totals.zero_7d,
      search_totals.total_7d,
      CASE
        WHEN search_totals.total_7d > 0
          THEN ROUND(search_totals.zero_7d::numeric / search_totals.total_7d, 4)
        ELSE 0
      END,
      redemptions.validated_7d,
      redemptions.bill_gmv_7d,
      listing_cov.with_redemption_30d,
      listing_cov.published,
      CASE
        WHEN listing_cov.published > 0
          THEN ROUND(
            listing_cov.with_redemption_30d::numeric / listing_cov.published,
            4
          )
        ELSE 0
      END,
      now()
    FROM bounds, dau, wau, search_totals, redemptions, listing_cov
    ON CONFLICT (day) DO UPDATE SET
      dau = EXCLUDED.dau,
      wau = EXCLUDED.wau,
      search_zero_count_7d = EXCLUDED.search_zero_count_7d,
      search_total_7d = EXCLUDED.search_total_7d,
      search_zero_result_rate_7d = EXCLUDED.search_zero_result_rate_7d,
      validated_redemptions_7d = EXCLUDED.validated_redemptions_7d,
      bill_gmv_7d = EXCLUDED.bill_gmv_7d,
      listings_with_redemption_30d = EXCLUDED.listings_with_redemption_30d,
      published_listings = EXCLUDED.published_listings,
      redemption_listing_rate_30d = EXCLUDED.redemption_listing_rate_30d,
      computed_at = EXCLUDED.computed_at
    RETURNING
      day::text,
      dau,
      wau,
      search_zero_count_7d,
      search_total_7d,
      search_zero_result_rate_7d,
      validated_redemptions_7d,
      bill_gmv_7d,
      listings_with_redemption_30d,
      published_listings,
      redemption_listing_rate_30d,
      computed_at::text
  `);

  const row = rows[0];
  if (!row) {
    throw new Error("marketplace_health_daily upsert returned no row");
  }

  return mapRow(row);
}

export async function getLatestMarketplaceHealth(): Promise<MarketplaceHealthSnapshot | null> {
  try {
    const { rows } = await query(
      `SELECT
         day::text,
         dau,
         wau,
         search_zero_count_7d,
         search_total_7d,
         search_zero_result_rate_7d,
         validated_redemptions_7d,
         bill_gmv_7d,
         listings_with_redemption_30d,
         published_listings,
         redemption_listing_rate_30d,
         computed_at::text
       FROM public.marketplace_health_daily
       ORDER BY day DESC
       LIMIT 1`,
    );
    if (!rows[0]) return null;
    return mapRow(rows[0]);
  } catch (error) {
    console.error("getLatestMarketplaceHealth failed", error);
    return null;
  }
}

function mapRow(row: Record<string, unknown>): MarketplaceHealthSnapshot {
  return {
    day: String(row.day),
    dau: Number(row.dau ?? 0),
    wau: Number(row.wau ?? 0),
    searchZeroCount7d: Number(row.search_zero_count_7d ?? 0),
    searchTotal7d: Number(row.search_total_7d ?? 0),
    searchZeroResultRate7d: Number(row.search_zero_result_rate_7d ?? 0),
    validatedRedemptions7d: Number(row.validated_redemptions_7d ?? 0),
    billGmv7d: Number(row.bill_gmv_7d ?? 0),
    listingsWithRedemption30d: Number(row.listings_with_redemption_30d ?? 0),
    publishedListings: Number(row.published_listings ?? 0),
    redemptionListingRate30d: Number(row.redemption_listing_rate_30d ?? 0),
    computedAt: String(row.computed_at),
  };
}
