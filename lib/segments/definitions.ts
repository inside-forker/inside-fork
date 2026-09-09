import {
  CONSUMER_ROLES,
  MERCHANT_ROLES,
  SEGMENT_SIGNUP_NO_BOOKING_MIN_DAYS,
  SEGMENT_SILENT_AFTER_ACTIVE_MIN_DAYS,
  SEGMENT_HIGH_SPENDER_CUTOFF_PKR,
  SEGMENT_MERCHANT_DASHBOARD_INACTIVE_MIN_DAYS,
  SEGMENT_HIGH_BILL_REDEEM_CUTOFF_PKR,
  SEGMENT_MERCHANT_GMV_COMPARE_DAYS,
  SEGMENT_MERCHANT_GMV_DECLINE_MIN_PRIOR_REDEMPTIONS,
  SEGMENT_UNMET_DEMAND_MIN_ZERO_SEARCHES,
  SEGMENT_CROSS_SELL_PROPENSITY_MIN,
} from "@/lib/scoring/thresholds";

/**
 * A segment query: a SELECT returning one `user_id uuid` column per
 * currently-qualifying user. `params` are positional and referenced from
 * `sql` as $1, $2, ... - lib/segments/refresh.ts appends the segment slug
 * as the next placeholder when it wraps this into an upsert/reconcile
 * statement, so keep `sql`'s placeholders contiguous starting at $1.
 */
export interface SegmentQuery {
  slug: string;
  sql: string;
  params: unknown[];
}

/** Segment 1: signed up 7+ days ago, still no booking. */
export const SIGNED_UP_NO_BOOKING_7D: SegmentQuery = {
  slug: "signed_up_no_booking_7d",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.role::text = ANY($1::text[])
      AND p.created_at <= now() - INTERVAL '${SEGMENT_SIGNUP_NO_BOOKING_MIN_DAYS} days'
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.user_id = p.id
      )
  `,
  params: [CONSUMER_ROLES],
};

export const WAS_ACTIVE_NOW_SILENT_21D: SegmentQuery = {
  slug: "was_active_now_silent_21d",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.days_since_last_activity >= ${SEGMENT_SILENT_AFTER_ACTIVE_MIN_DAYS}
      AND (
        ues.last_login_at IS NOT NULL
        OR ues.last_booking_at IS NOT NULL
        OR ues.last_engagement_at IS NOT NULL
      )
  `,
  params: [],
};

export const HIGH_SPENDERS: SegmentQuery = {
  slug: "high_spenders",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.total_booking_spend >= ${SEGMENT_HIGH_SPENDER_CUTOFF_PKR}
  `,
  params: [],
};

export const MERCHANT_DASHBOARD_INACTIVE_21D: SegmentQuery = {
  slug: "merchant_dashboard_inactive_21d",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.role::text = ANY($1::text[])
      AND NOT EXISTS (
        SELECT 1 FROM public.audit_logs a
        WHERE a.user_id = p.id
          AND a.action = 'user_login'
          AND a.created_at >= now() - INTERVAL '${SEGMENT_MERCHANT_DASHBOARD_INACTIVE_MIN_DAYS} days'
      )
  `,
  params: [MERCHANT_ROLES],
};

// ---- Phase 2 additions ----

export const LIFECYCLE_AT_RISK: SegmentQuery = {
  slug: "lifecycle_at_risk",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.lifecycle_stage = 'at_risk'
  `,
  params: [],
};

export const LIFECYCLE_CHURNED: SegmentQuery = {
  slug: "lifecycle_churned",
  sql: `
    SELECT ues.user_id
    FROM public.user_engagement_scores ues
    WHERE ues.lifecycle_stage = 'churned'
  `,
  params: [],
};

export const REDEEMED_ONCE_30D: SegmentQuery = {
  slug: "redeemed_once_30d",
  sql: `
    SELECT r.user_id
    FROM public.redemptions r
    WHERE r.status = 'validated'
      AND r.validated_at >= now() - INTERVAL '30 days'
    GROUP BY r.user_id
    HAVING COUNT(*) = 1
  `,
  params: [],
};

export const REDEEMED_REPEAT_90D: SegmentQuery = {
  slug: "redeemed_repeat_90d",
  sql: `
    SELECT r.user_id
    FROM public.redemptions r
    WHERE r.status = 'validated'
      AND r.validated_at >= now() - INTERVAL '90 days'
    GROUP BY r.user_id
    HAVING COUNT(*) >= 2
  `,
  params: [],
};

export const HIGH_BILL_REDEEMERS: SegmentQuery = {
  slug: "high_bill_redeemers",
  sql: `
    SELECT r.user_id
    FROM public.redemptions r
    WHERE r.status = 'validated'
      AND r.validated_at >= now() - INTERVAL '90 days'
    GROUP BY r.user_id
    HAVING COALESCE(SUM(r.bill_value), 0) >= ${SEGMENT_HIGH_BILL_REDEEM_CUTOFF_PKR}
  `,
  params: [],
};

export const DEAL_BROWSERS_NO_REDEEM_14D: SegmentQuery = {
  slug: "deal_browsers_no_redeem_14d",
  sql: `
    SELECT DISTINCT me.user_id
    FROM public.mobile_events me
    WHERE me.user_id IS NOT NULL
      AND me.occurred_at >= now() - INTERVAL '14 days'
      AND (
        me.event_name = 'offer_viewed'
        OR (me.event_name = 'search_performed' AND me.source_context = 'deals')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.redemptions r
        WHERE r.user_id = me.user_id AND r.status = 'validated'
      )
  `,
  params: [],
};

export const CORE_PROFILE_INCOMPLETE: SegmentQuery = {
  slug: "core_profile_incomplete",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.role::text = ANY($1::text[])
      AND (
        p.home_area_label IS NULL OR btrim(p.home_area_label) = ''
        OR p.age_band IS NULL OR btrim(p.age_band) = ''
        OR p.declared_interests IS NULL OR cardinality(p.declared_interests) = 0
      )
  `,
  params: [CONSUMER_ROLES],
};

export const MERCHANT_NO_REDEMPTIONS_30D: SegmentQuery = {
  slug: "merchant_no_redemptions_30d",
  sql: `
    SELECT DISTINCT l.owner_id AS user_id
    FROM public.listings l
    INNER JOIN public.deals d ON d.listing_id = l.id AND d.is_active = true
    WHERE l.status = 'published'
      AND l.owner_id IS NOT NULL
      AND l.owner_id IN (
        SELECT id FROM public.profiles WHERE role::text = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.redemptions r
        WHERE r.owner_id = l.owner_id
          AND r.status = 'validated'
          AND r.validated_at >= now() - INTERVAL '30 days'
      )
  `,
  params: [MERCHANT_ROLES],
};

export const MERCHANT_GMV_DECLINING: SegmentQuery = {
  slug: "merchant_gmv_declining",
  sql: `
    WITH windows AS (
      SELECT
        r.owner_id AS user_id,
        COALESCE(SUM(r.bill_value) FILTER (
          WHERE r.validated_at >= now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS} days'
        ), 0) AS recent_gmv,
        COALESCE(SUM(r.bill_value) FILTER (
          WHERE r.validated_at >= now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS * 2} days'
            AND r.validated_at < now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS} days'
        ), 0) AS prior_gmv,
        COUNT(*) FILTER (
          WHERE r.validated_at >= now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS * 2} days'
            AND r.validated_at < now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS} days'
        ) AS prior_count
      FROM public.redemptions r
      WHERE r.status = 'validated'
        AND r.owner_id IS NOT NULL
        AND r.validated_at >= now() - INTERVAL '${SEGMENT_MERCHANT_GMV_COMPARE_DAYS * 2} days'
      GROUP BY 1
    )
    SELECT user_id
    FROM windows
    WHERE prior_count >= ${SEGMENT_MERCHANT_GMV_DECLINE_MIN_PRIOR_REDEMPTIONS}
      AND prior_gmv > 0
      AND recent_gmv < prior_gmv * 0.5
  `,
  params: [],
};

export const UNMET_DEMAND_COHORT: SegmentQuery = {
  slug: "unmet_demand_cohort",
  sql: `
    SELECT me.user_id
    FROM public.mobile_events me
    WHERE me.user_id IS NOT NULL
      AND me.occurred_at >= now() - INTERVAL '14 days'
      AND me.event_name IN ('search_performed', 'filters_applied')
      AND (me.context->>'hasResults') = 'false'
    GROUP BY me.user_id
    HAVING COUNT(*) >= ${SEGMENT_UNMET_DEMAND_MIN_ZERO_SEARCHES}
  `,
  params: [],
};

export const EVENT_FIRST: SegmentQuery = {
  slug: "event_first",
  sql: `
    SELECT DISTINCT b.user_id
    FROM public.bookings b
    WHERE (b.payment_status = 'paid' OR b.status IN ('confirmed', 'completed'))
      AND NOT EXISTS (
        SELECT 1 FROM public.redemptions r
        WHERE r.user_id = b.user_id AND r.status = 'validated'
      )
  `,
  params: [],
};

export const VENUE_FIRST: SegmentQuery = {
  slug: "venue_first",
  sql: `
    SELECT DISTINCT r.user_id
    FROM public.redemptions r
    WHERE r.status = 'validated' AND r.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.user_id = r.user_id
          AND (b.payment_status = 'paid' OR b.status IN ('confirmed', 'completed'))
      )
  `,
  params: [],
};

export const CROSS_SELL_TO_TICKETS: SegmentQuery = {
  slug: "cross_sell_to_tickets",
  sql: `
    SELECT ups.user_id
    FROM public.user_propensity_scores ups
    WHERE ups.cross_sell_to_ticket >= ${SEGMENT_CROSS_SELL_PROPENSITY_MIN}
  `,
  params: [],
};

export const CROSS_SELL_TO_VENUES: SegmentQuery = {
  slug: "cross_sell_to_venues",
  sql: `
    SELECT ups.user_id
    FROM public.user_propensity_scores ups
    WHERE ups.cross_sell_to_venue >= ${SEGMENT_CROSS_SELL_PROPENSITY_MIN}
  `,
  params: [],
};

export const RESEARCH_PANEL_OPTED_IN: SegmentQuery = {
  slug: "research_panel_opted_in",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.research_panel_opt_in = true
      AND p.role::text = ANY($1::text[])
  `,
  params: [CONSUMER_ROLES],
};

export const CREATOR_ATTRIBUTED: SegmentQuery = {
  slug: "creator_attributed",
  sql: `
    SELECT p.id AS user_id
    FROM public.profiles p
    WHERE p.attributed_creator_code IS NOT NULL
      AND p.role::text = ANY($1::text[])
  `,
  params: [CONSUMER_ROLES],
};

export const ALL_SEGMENT_QUERIES: SegmentQuery[] = [
  SIGNED_UP_NO_BOOKING_7D,
  WAS_ACTIVE_NOW_SILENT_21D,
  HIGH_SPENDERS,
  MERCHANT_DASHBOARD_INACTIVE_21D,
  LIFECYCLE_AT_RISK,
  LIFECYCLE_CHURNED,
  REDEEMED_ONCE_30D,
  REDEEMED_REPEAT_90D,
  HIGH_BILL_REDEEMERS,
  DEAL_BROWSERS_NO_REDEEM_14D,
  CORE_PROFILE_INCOMPLETE,
  MERCHANT_NO_REDEMPTIONS_30D,
  MERCHANT_GMV_DECLINING,
  UNMET_DEMAND_COHORT,
  EVENT_FIRST,
  VENUE_FIRST,
  CROSS_SELL_TO_TICKETS,
  CROSS_SELL_TO_VENUES,
  RESEARCH_PANEL_OPTED_IN,
  CREATOR_ATTRIBUTED,
];
