import { query } from "@/lib/db";
import { CONSUMER_ROLES } from "@/lib/scoring/thresholds";

export type RefreshPropensityResult = {
  usersScored: number;
  durationMs: number;
};

/**
 * Nightly propensity / cross-sell scores (0–1) from bookings vs redemptions.
 * Heuristic — not a fitted model; useful for segments until density exists.
 */
export async function refreshPropensityScores(): Promise<RefreshPropensityResult> {
  const startedAt = Date.now();

  const { rowCount } = await query(
    `
    WITH consumers AS (
      SELECT id AS user_id FROM public.profiles WHERE role::text = ANY($1::text[])
    ),
    booking_stats AS (
      SELECT
        user_id,
        COUNT(*) FILTER (
          WHERE payment_status = 'paid' OR status IN ('confirmed', 'completed')
        )::int AS paid_bookings,
        COUNT(*) FILTER (
          WHERE created_at >= now() - INTERVAL '90 days'
            AND (payment_status = 'paid' OR status IN ('confirmed', 'completed'))
        )::int AS paid_bookings_90d
      FROM public.bookings
      GROUP BY user_id
    ),
    redeem_stats AS (
      SELECT
        user_id,
        COUNT(*) FILTER (WHERE status = 'validated')::int AS validated_redeems,
        COUNT(*) FILTER (
          WHERE status = 'validated' AND validated_at >= now() - INTERVAL '90 days'
        )::int AS validated_redeems_90d
      FROM public.redemptions
      WHERE user_id IS NOT NULL
      GROUP BY user_id
    ),
    offer_views AS (
      SELECT user_id, COUNT(*)::int AS views_90d
      FROM public.mobile_events
      WHERE user_id IS NOT NULL
        AND event_name = 'offer_viewed'
        AND occurred_at >= now() - INTERVAL '90 days'
      GROUP BY user_id
    ),
    scored AS (
      SELECT
        c.user_id,
        LEAST(
          1.0,
          (
            COALESCE(r.validated_redeems_90d, 0) * 1.0
            / GREATEST(1, COALESCE(o.views_90d, 0) + COALESCE(r.validated_redeems_90d, 0))
          )
          + LEAST(0.4, COALESCE(r.validated_redeems, 0) * 0.08)
        )::numeric(8, 4) AS redeem_propensity,
        LEAST(
          1.0,
          COALESCE(b.paid_bookings_90d, 0) * 0.25
          + LEAST(0.5, COALESCE(b.paid_bookings, 0) * 0.1)
        )::numeric(8, 4) AS ticket_propensity,
        CASE
          WHEN COALESCE(r.validated_redeems, 0) >= 1
            AND COALESCE(b.paid_bookings, 0) = 0
          THEN LEAST(1.0, 0.4 + COALESCE(r.validated_redeems_90d, 0) * 0.15)::numeric(8, 4)
          ELSE 0::numeric(8, 4)
        END AS cross_sell_to_ticket,
        CASE
          WHEN COALESCE(b.paid_bookings, 0) >= 1
            AND COALESCE(r.validated_redeems, 0) = 0
          THEN LEAST(1.0, 0.4 + COALESCE(b.paid_bookings_90d, 0) * 0.15)::numeric(8, 4)
          ELSE 0::numeric(8, 4)
        END AS cross_sell_to_venue
      FROM consumers c
      LEFT JOIN booking_stats b ON b.user_id = c.user_id
      LEFT JOIN redeem_stats r ON r.user_id = c.user_id
      LEFT JOIN offer_views o ON o.user_id = c.user_id
    )
    INSERT INTO public.user_propensity_scores (
      user_id, redeem_propensity, ticket_propensity,
      cross_sell_to_ticket, cross_sell_to_venue, computed_at
    )
    SELECT
      user_id, redeem_propensity, ticket_propensity,
      cross_sell_to_ticket, cross_sell_to_venue, now()
    FROM scored
    ON CONFLICT (user_id) DO UPDATE SET
      redeem_propensity = EXCLUDED.redeem_propensity,
      ticket_propensity = EXCLUDED.ticket_propensity,
      cross_sell_to_ticket = EXCLUDED.cross_sell_to_ticket,
      cross_sell_to_venue = EXCLUDED.cross_sell_to_venue,
      computed_at = EXCLUDED.computed_at
    `,
    [CONSUMER_ROLES],
  );

  return {
    usersScored: rowCount ?? 0,
    durationMs: Date.now() - startedAt,
  };
}
