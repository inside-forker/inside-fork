-- Phase 2 foundation: marketplace health daily snapshot + segment library expansion.

-- ---------------------------------------------------------------------------
-- A) Marketplace health daily snapshot
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marketplace_health_daily (
  day                           date PRIMARY KEY,
  dau                           integer NOT NULL DEFAULT 0,
  wau                           integer NOT NULL DEFAULT 0,
  search_zero_count_7d          integer NOT NULL DEFAULT 0,
  search_total_7d               integer NOT NULL DEFAULT 0,
  search_zero_result_rate_7d    numeric(8, 4) NOT NULL DEFAULT 0,
  validated_redemptions_7d      integer NOT NULL DEFAULT 0,
  bill_gmv_7d                   numeric NOT NULL DEFAULT 0,
  listings_with_redemption_30d  integer NOT NULL DEFAULT 0,
  published_listings            integer NOT NULL DEFAULT 0,
  redemption_listing_rate_30d   numeric(8, 4) NOT NULL DEFAULT 0,
  computed_at                   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.marketplace_health_daily IS
  'Nightly marketplace health snapshot (DAU/WAU, search zero-result rate, redemption GMV, listing redemption coverage). Refreshed by /api/cron/refresh-marketplace-health.';

-- ---------------------------------------------------------------------------
-- B) Segment definitions for Phase 2 library (~13 total with originals)
-- ---------------------------------------------------------------------------

INSERT INTO public.segment_definitions (slug, label, description) VALUES
  (
    'lifecycle_at_risk',
    'Lifecycle at risk',
    'Consumers whose user_engagement_scores.lifecycle_stage is at_risk.'
  ),
  (
    'lifecycle_churned',
    'Lifecycle churned',
    'Consumers whose user_engagement_scores.lifecycle_stage is churned.'
  ),
  (
    'redeemed_once_30d',
    'Redeemed once (30d)',
    'Exactly one validated offer redemption in the last 30 days.'
  ),
  (
    'redeemed_repeat_90d',
    'Repeat redeemers (90d)',
    'Two or more validated offer redemptions in the last 90 days.'
  ),
  (
    'high_bill_redeemers',
    'High bill redeemers',
    'Validated bill_value sum over 90d at/above SEGMENT_HIGH_BILL_REDEEM_CUTOFF_PKR.'
  ),
  (
    'deal_browsers_no_redeem_14d',
    'Deal browsers, never redeemed',
    'Saw deals (offer_viewed / deals search) in 14d with zero validated redemptions ever.'
  ),
  (
    'core_profile_incomplete',
    'CORE profile incomplete',
    'Consumers missing home area, age band, or declared interests.'
  ),
  (
    'merchant_no_redemptions_30d',
    'Merchant no redemptions (30d)',
    'Business owners with a published listing + active deal and zero validated redemptions in 30d.'
  ),
  (
    'merchant_gmv_declining',
    'Merchant GMV declining',
    'Bill GMV last 14d is under 50% of the prior 14d, with a minimum prior redemption floor.'
  )
ON CONFLICT (slug) DO NOTHING;
