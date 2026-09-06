import { query } from "@/lib/db";
import {
  CONSUMER_ROLES,
  LOGIN_LOOKBACK_DAYS,
  BOOKING_LOOKBACK_DAYS,
  ENGAGEMENT_LOOKBACK_DAYS,
  REDEMPTION_LOOKBACK_DAYS,
  RECENCY_DECAY_WINDOW_DAYS,
  LOGIN_FREQUENCY_CAP_30D,
  BOOKING_FREQUENCY_CAP_90D,
  ENGAGEMENT_FREQUENCY_CAP_30D,
  REDEMPTION_FREQUENCY_CAP_90D,
  BOOKING_MONETARY_CAP_PKR,
  SCORE_WEIGHT_LOGIN_RECENCY,
  SCORE_WEIGHT_LOGIN_FREQUENCY,
  SCORE_WEIGHT_BOOKING_RECENCY,
  SCORE_WEIGHT_BOOKING_FREQUENCY,
  SCORE_WEIGHT_BOOKING_MONETARY,
  SCORE_WEIGHT_ENGAGEMENT_RECENCY,
  SCORE_WEIGHT_ENGAGEMENT_FREQUENCY,
  SCORE_WEIGHT_REDEMPTION_RECENCY,
  SCORE_WEIGHT_REDEMPTION_FREQUENCY,
  LIFECYCLE_NEW_ACCOUNT_MAX_AGE_DAYS,
  LIFECYCLE_ACTIVE_MAX_DAYS,
  LIFECYCLE_AT_RISK_MAX_DAYS,
  LIFECYCLE_DORMANT_MAX_DAYS,
} from "@/lib/scoring/thresholds";

/**
 * SQL-side computation of user_engagement_scores (see
 * sql/migrations/20260812_user_engagement_scores.sql). Deliberately does
 * NOT follow the lib/analytics/admin.ts pattern of fetching capped rows and
 * reducing in Node - these source tables (audit_logs, bookings,
 * analytics_events, user_listing_events, mobile_events, redemptions) will
 * grow past what a Node-side reduction can handle, so all aggregation
 * happens in Postgres via CTEs and a single batched upsert.
 */

/** Days-since-X as a whole-number-of-days expression, safe for any interval size (no month ambiguity). */
function daysAgoExpr(column: string): string {
  return `FLOOR(EXTRACT(EPOCH FROM (now() - ${column})) / 86400)`;
}

/** 0-100 recency sub-score: 100 at "just now", linearly decaying to 0 at RECENCY_DECAY_WINDOW_DAYS. NULL column -> 0 (never happened). */
function recencySubscoreExpr(column: string): string {
  return `CASE WHEN ${column} IS NULL THEN 0 ELSE GREATEST(0, 100 - (${daysAgoExpr(
    column
  )} * 100.0 / ${RECENCY_DECAY_WINDOW_DAYS})) END`;
}

/** 0-100 frequency sub-score: linear up to `cap`, then clamped at 100. */
function frequencySubscoreExpr(column: string, cap: number): string {
  return `LEAST(100, ${column} * 100.0 / ${cap})`;
}

export interface RefreshUserEngagementScoresResult {
  usersScored: number;
  usersRemoved: number;
  durationMs: number;
}

export async function refreshUserEngagementScores(): Promise<RefreshUserEngagementScoresResult> {
  const startedAt = Date.now();

  const upsertSql = `
    WITH consumers AS (
      SELECT id AS user_id, created_at
      FROM public.profiles
      WHERE role::text = ANY($1::text[])
    ),
    login_stats AS (
      SELECT
        user_id,
        MAX(created_at) AS last_login_at,
        COUNT(*) FILTER (
          WHERE created_at >= now() - INTERVAL '${LOGIN_LOOKBACK_DAYS} days'
        ) AS login_count_30d
      FROM public.audit_logs
      WHERE action = 'user_login' AND user_id IS NOT NULL
      GROUP BY user_id
    ),
    booking_stats AS (
      SELECT
        user_id,
        MAX(created_at) AS last_booking_at,
        COUNT(*) AS total_bookings,
        COUNT(*) FILTER (
          WHERE created_at >= now() - INTERVAL '${BOOKING_LOOKBACK_DAYS} days'
        ) AS booking_count_90d,
        -- "paid" mirrors lib/analytics/admin.ts summarizeRevenueAnalytics's isPaid definition.
        COALESCE(SUM(total_amount) FILTER (
          WHERE payment_status = 'paid' OR status IN ('confirmed', 'completed')
        ), 0) AS total_booking_spend
      FROM public.bookings
      GROUP BY user_id
    ),
    engagement_raw AS (
      -- Unify web (analytics_events), web listing interactions
      -- (user_listing_events), and mobile (mobile_events) - see migration
      -- header for why these three don't share a schema today.
      SELECT actor_id AS user_id, occurred_at AS event_at
      FROM public.analytics_events
      WHERE actor_id IS NOT NULL
      UNION ALL
      SELECT user_id, created_at AS event_at
      FROM public.user_listing_events
      WHERE user_id IS NOT NULL
      UNION ALL
      SELECT user_id, occurred_at AS event_at
      FROM public.mobile_events
      WHERE user_id IS NOT NULL
    ),
    engagement_stats AS (
      SELECT
        user_id,
        MAX(event_at) AS last_engagement_at,
        COUNT(*) FILTER (
          WHERE event_at >= now() - INTERVAL '${ENGAGEMENT_LOOKBACK_DAYS} days'
        ) AS engagement_count_30d
      FROM engagement_raw
      GROUP BY user_id
    ),
    redemption_stats AS (
      SELECT
        user_id,
        MAX(validated_at) AS last_redemption_at,
        COUNT(*) FILTER (
          WHERE validated_at >= now() - INTERVAL '${REDEMPTION_LOOKBACK_DAYS} days'
        ) AS redemption_count_90d
      FROM public.redemptions
      WHERE status = 'validated' AND user_id IS NOT NULL
      GROUP BY user_id
    ),
    combined AS (
      SELECT
        c.user_id,
        c.created_at,
        l.last_login_at,
        COALESCE(l.login_count_30d, 0) AS login_count_30d,
        b.last_booking_at,
        COALESCE(b.total_bookings, 0) AS total_bookings,
        COALESCE(b.booking_count_90d, 0) AS booking_count_90d,
        COALESCE(b.total_booking_spend, 0) AS total_booking_spend,
        e.last_engagement_at,
        COALESCE(e.engagement_count_30d, 0) AS engagement_count_30d,
        r.last_redemption_at,
        COALESCE(r.redemption_count_90d, 0) AS redemption_count_90d,
        GREATEST(
          l.last_login_at,
          b.last_booking_at,
          e.last_engagement_at,
          r.last_redemption_at,
          c.created_at
        ) AS last_activity_at
      FROM consumers c
      LEFT JOIN login_stats l ON l.user_id = c.user_id
      LEFT JOIN booking_stats b ON b.user_id = c.user_id
      LEFT JOIN engagement_stats e ON e.user_id = c.user_id
      LEFT JOIN redemption_stats r ON r.user_id = c.user_id
    ),
    final AS (
      SELECT
        user_id, last_login_at, login_count_30d, last_booking_at, total_bookings,
        booking_count_90d, total_booking_spend, last_engagement_at, engagement_count_30d,
        last_activity_at,
        ${daysAgoExpr("last_activity_at")}::integer AS days_since_last_activity,
        CASE
          WHEN (now() - created_at) <= INTERVAL '${LIFECYCLE_NEW_ACCOUNT_MAX_AGE_DAYS} days'
            AND total_bookings = 0 THEN 'new'
          WHEN ${daysAgoExpr("last_activity_at")} <= ${LIFECYCLE_ACTIVE_MAX_DAYS} THEN 'active'
          WHEN ${daysAgoExpr("last_activity_at")} <= ${LIFECYCLE_AT_RISK_MAX_DAYS} THEN 'at_risk'
          WHEN ${daysAgoExpr("last_activity_at")} <= ${LIFECYCLE_DORMANT_MAX_DAYS} THEN 'dormant'
          ELSE 'churned'
        END AS lifecycle_stage,
        ROUND((
          ${recencySubscoreExpr("last_login_at")} * ${SCORE_WEIGHT_LOGIN_RECENCY} +
          ${frequencySubscoreExpr("login_count_30d", LOGIN_FREQUENCY_CAP_30D)} * ${SCORE_WEIGHT_LOGIN_FREQUENCY} +
          ${recencySubscoreExpr("last_booking_at")} * ${SCORE_WEIGHT_BOOKING_RECENCY} +
          ${frequencySubscoreExpr("booking_count_90d", BOOKING_FREQUENCY_CAP_90D)} * ${SCORE_WEIGHT_BOOKING_FREQUENCY} +
          ${frequencySubscoreExpr("total_booking_spend", BOOKING_MONETARY_CAP_PKR)} * ${SCORE_WEIGHT_BOOKING_MONETARY} +
          ${recencySubscoreExpr("last_engagement_at")} * ${SCORE_WEIGHT_ENGAGEMENT_RECENCY} +
          ${frequencySubscoreExpr("engagement_count_30d", ENGAGEMENT_FREQUENCY_CAP_30D)} * ${SCORE_WEIGHT_ENGAGEMENT_FREQUENCY} +
          ${recencySubscoreExpr("last_redemption_at")} * ${SCORE_WEIGHT_REDEMPTION_RECENCY} +
          ${frequencySubscoreExpr("redemption_count_90d", REDEMPTION_FREQUENCY_CAP_90D)} * ${SCORE_WEIGHT_REDEMPTION_FREQUENCY}
        ) / 100.0, 2) AS engagement_score
      FROM combined
    )
    INSERT INTO public.user_engagement_scores (
      user_id, last_login_at, login_count_30d, last_booking_at, booking_count_90d,
      total_bookings, total_booking_spend, last_engagement_at, engagement_count_30d,
      last_activity_at, days_since_last_activity, lifecycle_stage, engagement_score, computed_at
    )
    SELECT
      user_id, last_login_at, login_count_30d, last_booking_at, booking_count_90d,
      total_bookings, total_booking_spend, last_engagement_at, engagement_count_30d,
      last_activity_at, days_since_last_activity, lifecycle_stage, engagement_score, now()
    FROM final
    ON CONFLICT (user_id) DO UPDATE SET
      last_login_at = EXCLUDED.last_login_at,
      login_count_30d = EXCLUDED.login_count_30d,
      last_booking_at = EXCLUDED.last_booking_at,
      booking_count_90d = EXCLUDED.booking_count_90d,
      total_bookings = EXCLUDED.total_bookings,
      total_booking_spend = EXCLUDED.total_booking_spend,
      last_engagement_at = EXCLUDED.last_engagement_at,
      engagement_count_30d = EXCLUDED.engagement_count_30d,
      last_activity_at = EXCLUDED.last_activity_at,
      days_since_last_activity = EXCLUDED.days_since_last_activity,
      lifecycle_stage = EXCLUDED.lifecycle_stage,
      engagement_score = EXCLUDED.engagement_score,
      computed_at = EXCLUDED.computed_at
    RETURNING user_id;
  `;

  const { rows } = await query(upsertSql, [CONSUMER_ROLES]);

  // Drop rows for users who are no longer consumers (e.g. role changed to
  // business_owner/organizer/staff). Profile deletion is already handled by
  // the FK's ON DELETE CASCADE; this only handles role transitions.
  const { rows: removedRows } = await query(
    `DELETE FROM public.user_engagement_scores ues
     WHERE NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = ues.user_id AND p.role::text = ANY($1::text[])
     )
     RETURNING user_id`,
    [CONSUMER_ROLES]
  );

  return {
    usersScored: rows.length,
    usersRemoved: removedRows.length,
    durationMs: Date.now() - startedAt,
  };
}
