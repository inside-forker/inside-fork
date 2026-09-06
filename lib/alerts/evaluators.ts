import { query } from "@/lib/db";
import { createNotification, resolveCategorySlugForRole } from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";
import type { Json } from "@/types/database";
import {
  ADMIN_ALERT_RECIPIENT_ROLES,
  ALERT_PAYMENT_FAILURE_BASELINE_DAYS,
  ALERT_PAYMENT_FAILURE_SPIKE_MULTIPLIER,
  ALERT_PAYMENT_FAILURE_MIN_COUNT,
  ALERT_RATING_TRAILING_SHORT_DAYS,
  ALERT_RATING_TRAILING_LONG_DAYS,
  ALERT_RATING_DROP_MIN_REVIEWS,
  ALERT_RATING_DROP_MIN_DELTA,
  ALERT_ZERO_RESULT_SPIKE_MULTIPLIER,
  ALERT_ZERO_RESULT_MIN_COUNT,
  ALERT_REDEMPTIONS_DROP_RATIO,
  ALERT_REDEMPTIONS_DROP_MIN_PRIOR,
} from "@/lib/scoring/thresholds";

export interface EvaluateAdminAlertsResult {
  alertType: string;
  opened: number;
  resolved: number;
  stillOpen: number;
  notified: number;
}

interface QualifyingSubject {
  subjectKey: string;
  title: string;
  details: Record<string, unknown>;
  severity?: string;
}

/**
 * Reconciles admin_alerts rows for one alert_type against who/what
 * currently qualifies: opens new incidents, refreshes still-open ones
 * (last_seen_at/title/details), and auto-resolves incidents whose
 * condition has cleared. Returns which subject_keys are newly opened vs.
 * newly resolved so the caller can decide what to notify about (only new
 * opens - a persisting condition must not re-notify every run).
 */
async function reconcileAlerts(
  alertType: string,
  qualifying: QualifyingSubject[]
): Promise<{ opened: string[]; resolved: string[]; stillOpen: string[] }> {
  const qualifyingKeys = qualifying.map((q) => q.subjectKey);

  const { rows: resolvedRows } = await query(
    `UPDATE public.admin_alerts
     SET status = 'resolved', resolved_at = now()
     WHERE alert_type = $1 AND status = 'open' AND NOT (subject_key = ANY($2::text[]))
     RETURNING subject_key`,
    [alertType, qualifyingKeys]
  );

  const opened: string[] = [];
  const stillOpen: string[] = [];

  for (const item of qualifying) {
    const { rows } = await query(
      `INSERT INTO public.admin_alerts (alert_type, subject_key, status, severity, title, details, opened_at, last_seen_at)
       VALUES ($1, $2, 'open', $3, $4, $5, now(), now())
       ON CONFLICT (alert_type, subject_key) WHERE status = 'open'
       DO UPDATE SET last_seen_at = now(), title = EXCLUDED.title, details = EXCLUDED.details
       RETURNING (xmax = 0) AS is_new`,
      [alertType, item.subjectKey, item.severity ?? "warning", item.title, item.details]
    );

    if (rows[0]?.is_new) {
      opened.push(item.subjectKey);
    } else {
      stillOpen.push(item.subjectKey);
    }
  }

  return {
    opened,
    resolved: (resolvedRows as { subject_key: string }[]).map((r) => r.subject_key),
    stillOpen,
  };
}

/** Notifies admin/super_admin accounts (createNotification, one call per recipient - email/push only, no SMS/WhatsApp channel exists). */
async function notifyAdmins(
  title: string,
  body: string,
  metadata: Record<string, Json>
): Promise<number> {
  const { rows: admins } = await query(
    `SELECT id, role FROM public.profiles WHERE role::text = ANY($1::text[])`,
    [ADMIN_ALERT_RECIPIENT_ROLES]
  );

  let notified = 0;
  for (const admin of admins as { id: string; role: NotificationUserRole }[]) {
    try {
      const categorySlug = await resolveCategorySlugForRole(admin.role, "general");
      await createNotification({
        recipientId: admin.id,
        roleScope: admin.role,
        categorySlug,
        title,
        body,
        priority: "high",
        ctaLabel: "Open admin",
        ctaUrl: "/admin",
        metadata,
      });
      notified += 1;
    } catch (error) {
      console.error("evaluateAdminAlerts: failed to notify admin", admin.id, error);
    }
  }
  return notified;
}

/** Alert 1: reuses segment_membership.merchant_dashboard_inactive_21d directly (does not re-query audit_logs). */
async function evaluateMerchantDashboardInactive(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "merchant_dashboard_inactive";

  const { rows } = await query(
    `SELECT sm.user_id::text AS subject_key, p.full_name
     FROM public.segment_membership sm
     JOIN public.profiles p ON p.id = sm.user_id
     WHERE sm.segment_slug = 'merchant_dashboard_inactive_21d'`
  );

  const qualifying: QualifyingSubject[] = (
    rows as { subject_key: string; full_name: string | null }[]
  ).map((r) => ({
    subjectKey: r.subject_key,
    title: `Merchant dashboard inactive: ${r.full_name ?? r.subject_key}`,
    details: { user_id: r.subject_key, full_name: r.full_name },
  }));

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    notified = await notifyAdmins(
      `${opened.length} merchant${opened.length === 1 ? "" : "s"} inactive on dashboard 21+ days`,
      `Business owner account(s) have not logged in for 21+ days: ${opened
        .slice(0, 5)
        .join(", ")}${opened.length > 5 ? ` and ${opened.length - 5} more` : ""}.`,
      { alert_type: alertType, subject_keys: opened }
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

/** Alert 2: trailing-24h failed-payment count vs. a 7-day rolling baseline, from booking_status_history. */
async function evaluatePaymentFailureSpike(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "payment_failure_spike";

  const { rows } = await query(`
    WITH last_24h AS (
      SELECT COUNT(*)::int AS failures
      FROM public.booking_status_history
      WHERE new_status = 'failed' AND created_at >= now() - INTERVAL '24 hours'
    ),
    baseline AS (
      SELECT COUNT(*)::int AS failures
      FROM public.booking_status_history
      WHERE new_status = 'failed'
        AND created_at >= now() - INTERVAL '${ALERT_PAYMENT_FAILURE_BASELINE_DAYS + 1} days'
        AND created_at < now() - INTERVAL '24 hours'
    )
    SELECT
      last_24h.failures AS last_24h_failures,
      ROUND(baseline.failures::numeric / ${ALERT_PAYMENT_FAILURE_BASELINE_DAYS}, 2) AS baseline_daily_avg
    FROM last_24h, baseline
  `);

  const last24hFailures = Number(rows[0]?.last_24h_failures ?? 0);
  const baselineDailyAvg = Number(rows[0]?.baseline_daily_avg ?? 0);
  const isSpiking =
    last24hFailures >= ALERT_PAYMENT_FAILURE_MIN_COUNT &&
    last24hFailures >= baselineDailyAvg * ALERT_PAYMENT_FAILURE_SPIKE_MULTIPLIER;

  const qualifying: QualifyingSubject[] = isSpiking
    ? [
        {
          subjectKey: "global",
          title: `Payment failure spike: ${last24hFailures} in 24h (baseline ~${baselineDailyAvg}/day)`,
          details: { last_24h_failures: last24hFailures, baseline_daily_avg: baselineDailyAvg },
          severity: "critical",
        },
      ]
    : [];

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    notified = await notifyAdmins(
      "Payment failure rate spike detected",
      `${last24hFailures} failed payments in the last 24h vs. a ~${baselineDailyAvg}/day baseline over the trailing ${ALERT_PAYMENT_FAILURE_BASELINE_DAYS} days.`,
      { alert_type: alertType, last_24h_failures: last24hFailures, baseline_daily_avg: baselineDailyAvg }
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

/** Alert 3: trailing-7-day average rating vs. trailing-30-day average, per listing, from approved reviews. */
async function evaluateVenueRatingDrop(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "venue_rating_drop";

  const { rows } = await query(`
    WITH recent AS (
      SELECT listing_id, AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS review_count
      FROM public.reviews
      WHERE status = 'approved' AND created_at >= now() - INTERVAL '${ALERT_RATING_TRAILING_SHORT_DAYS} days'
      GROUP BY listing_id
    ),
    baseline AS (
      SELECT listing_id, AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*)::int AS review_count
      FROM public.reviews
      WHERE status = 'approved' AND created_at >= now() - INTERVAL '${ALERT_RATING_TRAILING_LONG_DAYS} days'
      GROUP BY listing_id
    )
    SELECT
      r.listing_id::text AS subject_key,
      l.name AS listing_name,
      r.avg_rating AS recent_avg,
      r.review_count AS recent_count,
      b.avg_rating AS baseline_avg,
      (b.avg_rating - r.avg_rating) AS rating_drop
    FROM recent r
    JOIN baseline b ON b.listing_id = r.listing_id
    JOIN public.listings l ON l.id = r.listing_id
    WHERE r.review_count >= ${ALERT_RATING_DROP_MIN_REVIEWS}
      AND (b.avg_rating - r.avg_rating) >= ${ALERT_RATING_DROP_MIN_DELTA}
  `);

  const qualifying: QualifyingSubject[] = (
    rows as {
      subject_key: string;
      listing_name: string;
      recent_avg: string;
      recent_count: number;
      baseline_avg: string;
      rating_drop: string;
    }[]
  ).map((row) => ({
    subjectKey: row.subject_key,
    title: `Rating drop: ${row.listing_name} (${Number(row.recent_avg).toFixed(2)} vs ${Number(
      row.baseline_avg
    ).toFixed(2)} baseline)`,
    details: {
      listing_id: row.subject_key,
      listing_name: row.listing_name,
      recent_avg: Number(row.recent_avg),
      recent_count: Number(row.recent_count),
      baseline_avg: Number(row.baseline_avg),
      rating_drop: Number(row.rating_drop),
    },
  }));

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    const openedNames = qualifying
      .filter((q) => opened.includes(q.subjectKey))
      .map((q) => String(q.details.listing_name));
    notified = await notifyAdmins(
      `${opened.length} venue${opened.length === 1 ? "" : "s"} with a rating drop`,
      `Trailing-${ALERT_RATING_TRAILING_SHORT_DAYS}-day rating fell ${ALERT_RATING_DROP_MIN_DELTA}+ points below the ${ALERT_RATING_TRAILING_LONG_DAYS}-day baseline for: ${openedNames
        .slice(0, 5)
        .join(", ")}${openedNames.length > 5 ? ` and ${openedNames.length - 5} more` : ""}.`,
      { alert_type: alertType, subject_keys: opened }
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

/** Alert 4: zero-result search volume this week vs prior week (live events). */
async function evaluateZeroResultSpike(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "search_zero_result_spike";

  const { rows } = await query(`
    WITH counts AS (
      SELECT
        (
          SELECT COUNT(*)::int FROM public.mobile_events
          WHERE event_name IN ('search_performed', 'filters_applied')
            AND (context->>'hasResults') = 'false'
            AND occurred_at >= now() - INTERVAL '7 days'
        ) + (
          SELECT COUNT(*)::int FROM public.analytics_events
          WHERE event_type = 'search_performed'
            AND (
              (context->>'hasResults') = 'false'
              OR (context->>'has_results') = 'false'
              OR COALESCE((context->>'resultCount')::int, (context->>'result_count')::int, -1) = 0
            )
            AND occurred_at >= now() - INTERVAL '7 days'
        ) AS current_7d,
        (
          SELECT COUNT(*)::int FROM public.mobile_events
          WHERE event_name IN ('search_performed', 'filters_applied')
            AND (context->>'hasResults') = 'false'
            AND occurred_at >= now() - INTERVAL '14 days'
            AND occurred_at < now() - INTERVAL '7 days'
        ) + (
          SELECT COUNT(*)::int FROM public.analytics_events
          WHERE event_type = 'search_performed'
            AND (
              (context->>'hasResults') = 'false'
              OR (context->>'has_results') = 'false'
              OR COALESCE((context->>'resultCount')::int, (context->>'result_count')::int, -1) = 0
            )
            AND occurred_at >= now() - INTERVAL '14 days'
            AND occurred_at < now() - INTERVAL '7 days'
        ) AS prior_7d
    )
    SELECT current_7d, prior_7d FROM counts
  `);

  const current7d = Number(rows[0]?.current_7d ?? 0);
  const prior7d = Number(rows[0]?.prior_7d ?? 0);
  const isSpiking =
    current7d >= ALERT_ZERO_RESULT_MIN_COUNT &&
    prior7d > 0 &&
    current7d >= prior7d * ALERT_ZERO_RESULT_SPIKE_MULTIPLIER;

  const qualifying: QualifyingSubject[] = isSpiking
    ? [
        {
          subjectKey: "global",
          title: `Search zero-result spike: ${current7d} vs ${prior7d} prior week`,
          details: {
            current_7d: current7d,
            prior_7d: prior7d,
            multiplier: ALERT_ZERO_RESULT_SPIKE_MULTIPLIER,
          },
          severity: "warning",
        },
      ]
    : [];

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    notified = await notifyAdmins(
      "Search zero-result rate spike",
      `${current7d} zero-result searches in the last 7 days vs ${prior7d} in the prior week (≥${ALERT_ZERO_RESULT_SPIKE_MULTIPLIER}x).`,
      {
        alert_type: alertType,
        current_7d: current7d,
        prior_7d: prior7d,
      },
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

/** Alert 5: validated redemptions down >50% week-over-week (min prior volume). */
async function evaluateRedemptionsWowDrop(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "redemptions_wow_drop";

  const { rows } = await query(`
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'validated' AND validated_at >= now() - INTERVAL '7 days'
      )::int AS current_7d,
      COUNT(*) FILTER (
        WHERE status = 'validated'
          AND validated_at >= now() - INTERVAL '14 days'
          AND validated_at < now() - INTERVAL '7 days'
      )::int AS prior_7d
    FROM public.redemptions
  `);

  const current7d = Number(rows[0]?.current_7d ?? 0);
  const prior7d = Number(rows[0]?.prior_7d ?? 0);
  const isDropping =
    prior7d >= ALERT_REDEMPTIONS_DROP_MIN_PRIOR &&
    current7d < prior7d * ALERT_REDEMPTIONS_DROP_RATIO;

  const qualifying: QualifyingSubject[] = isDropping
    ? [
        {
          subjectKey: "global",
          title: `Redemptions WoW drop: ${current7d} vs ${prior7d} prior week`,
          details: {
            current_7d: current7d,
            prior_7d: prior7d,
            drop_ratio: ALERT_REDEMPTIONS_DROP_RATIO,
          },
          severity: "critical",
        },
      ]
    : [];

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    notified = await notifyAdmins(
      "Platform redemptions down week-over-week",
      `Validated redemptions fell to ${current7d} from ${prior7d} in the prior 7 days (>${Math.round(
        (1 - ALERT_REDEMPTIONS_DROP_RATIO) * 100,
      )}% drop).`,
      {
        alert_type: alertType,
        current_7d: current7d,
        prior_7d: prior7d,
      },
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

/** Alert 6: reuse lifecycle_churned segment — notify on newly qualified (24h) cohort. */
async function evaluateLifecycleChurned(): Promise<EvaluateAdminAlertsResult> {
  const alertType = "lifecycle_churned";

  const { rows } = await query(
    `SELECT COUNT(*)::int AS newly_qualified
     FROM public.segment_membership
     WHERE segment_slug = 'lifecycle_churned'
       AND first_qualified_at >= now() - INTERVAL '24 hours'`,
  );

  const newlyQualified = Number(rows[0]?.newly_qualified ?? 0);
  const dayKey = new Date().toISOString().slice(0, 10);

  const qualifying: QualifyingSubject[] =
    newlyQualified > 0
      ? [
          {
            subjectKey: dayKey,
            title: `${newlyQualified} user(s) newly churned (lifecycle)`,
            details: { newly_qualified: newlyQualified, day: dayKey },
          },
        ]
      : [];

  const { opened, resolved, stillOpen } = await reconcileAlerts(alertType, qualifying);

  let notified = 0;
  if (opened.length > 0) {
    notified = await notifyAdmins(
      `${newlyQualified} user${newlyQualified === 1 ? "" : "s"} entered churned lifecycle`,
      `${newlyQualified} consumer account(s) newly qualified for lifecycle_churned in the last 24 hours.`,
      { alert_type: alertType, newly_qualified: newlyQualified, day: dayKey },
    );
  }

  return {
    alertType,
    opened: opened.length,
    resolved: resolved.length,
    stillOpen: stillOpen.length,
    notified,
  };
}

export async function evaluateAdminAlerts(): Promise<EvaluateAdminAlertsResult[]> {
  return [
    await evaluateMerchantDashboardInactive(),
    await evaluatePaymentFailureSpike(),
    await evaluateVenueRatingDrop(),
    await evaluateZeroResultSpike(),
    await evaluateRedemptionsWowDrop(),
    await evaluateLifecycleChurned(),
  ];
}
