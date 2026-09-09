-- Phase 3 Intelligence foundation (Postgres): taste graph rollup, propensity
-- scores, research panel opt-in, creator attribution codes. No warehouse.

-- ---------------------------------------------------------------------------
-- A) Category affinity rollup (taste graph seed)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_category_affinity (
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_id   integer NOT NULL,
  affinity      numeric(8, 4) NOT NULL DEFAULT 0,
  event_count   integer NOT NULL DEFAULT 0,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS uca_user_affinity_idx
  ON public.user_category_affinity (user_id, affinity DESC);

COMMENT ON TABLE public.user_category_affinity IS
  'Nightly category affinity (0-1) per consumer from user_listing_events + redemptions. Phase 3 taste-graph seed.';

-- ---------------------------------------------------------------------------
-- B) Propensity scores
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_propensity_scores (
  user_id              uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeem_propensity    numeric(8, 4) NOT NULL DEFAULT 0,
  ticket_propensity    numeric(8, 4) NOT NULL DEFAULT 0,
  cross_sell_to_ticket numeric(8, 4) NOT NULL DEFAULT 0,
  cross_sell_to_venue  numeric(8, 4) NOT NULL DEFAULT 0,
  computed_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_propensity_scores IS
  'Nightly propensity / cross-sell scores (0-1). redeem vs ticket behaviour.';

-- ---------------------------------------------------------------------------
-- C) Research panel opt-in (consent ledger + profile convenience flag)
-- ---------------------------------------------------------------------------

ALTER TABLE public.consent_ledger
  ADD COLUMN IF NOT EXISTS research_panel_opt_in boolean NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS research_panel_opt_in boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.research_panel_opt_in IS
  'Latest research-panel opt-in (Part 11.4). Ledger remains source of truth for history.';

-- ---------------------------------------------------------------------------
-- D) Creator attribution codes (basic)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creator_attribution_codes (
  code          text PRIMARY KEY,
  label         text NOT NULL,
  creator_id    uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  notes         text NULL
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS attributed_creator_code text NULL
    REFERENCES public.creator_attribution_codes(code) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_attributed_creator_idx
  ON public.profiles (attributed_creator_code)
  WHERE attributed_creator_code IS NOT NULL;

COMMENT ON TABLE public.creator_attribution_codes IS
  'Unique creator/campaign codes for install→signup attribution. Phase 3 basic; not full influencer CRM.';

-- ---------------------------------------------------------------------------
-- E) Phase 3 segments
-- ---------------------------------------------------------------------------

INSERT INTO public.segment_definitions (slug, label, description) VALUES
  (
    'unmet_demand_cohort',
    'Unmet demand (zero-result repeat)',
    'Consumers with 2+ zero-result searches in 14d.'
  ),
  (
    'event_first',
    'Event-first (no venue redeem)',
    'Has a paid/confirmed booking, zero validated redemptions.'
  ),
  (
    'venue_first',
    'Venue-first (no tickets)',
    'Has validated redemption, zero bookings.'
  ),
  (
    'cross_sell_to_tickets',
    'Cross-sell to tickets',
    'High cross_sell_to_ticket propensity from nightly scores.'
  ),
  (
    'cross_sell_to_venues',
    'Cross-sell to venues',
    'High cross_sell_to_venue propensity from nightly scores.'
  ),
  (
    'research_panel_opted_in',
    'Research panel opted in',
    'profiles.research_panel_opt_in = true.'
  ),
  (
    'creator_attributed',
    'Creator-attributed users',
    'Signed up with a creator attribution code.'
  )
ON CONFLICT (slug) DO NOTHING;
