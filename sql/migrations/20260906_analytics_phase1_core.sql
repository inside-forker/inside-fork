-- Phase 1 CORE analytics: event envelope columns, consent ledger, profile CORE
-- fields, redemptions (with bill value), and search zero-result daily rollup.

-- ---------------------------------------------------------------------------
-- A) Event envelope: device_id on mobile_events; session/source/device on
--    user_listing_events; source_context/device_id/screen on analytics_events
-- ---------------------------------------------------------------------------

ALTER TABLE public.mobile_events
  ADD COLUMN IF NOT EXISTS device_id text NULL;

CREATE INDEX IF NOT EXISTS me_device_occurred_idx
  ON public.mobile_events (device_id, occurred_at DESC)
  WHERE device_id IS NOT NULL;

ALTER TABLE public.user_listing_events
  ADD COLUMN IF NOT EXISTS session_id text NULL,
  ADD COLUMN IF NOT EXISTS source_context text NULL,
  ADD COLUMN IF NOT EXISTS device_id text NULL;

CREATE INDEX IF NOT EXISTS ule_session_created_idx
  ON public.user_listing_events (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS source_context text NULL,
  ADD COLUMN IF NOT EXISTS device_id text NULL,
  ADD COLUMN IF NOT EXISTS screen text NULL;

CREATE INDEX IF NOT EXISTS ae_source_context_occurred_idx
  ON public.analytics_events (source_context, occurred_at DESC)
  WHERE source_context IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B) Search zero-result daily rollup (web + mobile)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.search_zero_results_daily (
  id           bigserial PRIMARY KEY,
  day          date NOT NULL,
  platform     text NOT NULL CHECK (platform IN ('mobile', 'web', 'all')),
  query        text NOT NULL,
  zero_count   integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, platform, query)
);

CREATE INDEX IF NOT EXISTS szrd_day_count_idx
  ON public.search_zero_results_daily (day DESC, zero_count DESC);

COMMENT ON TABLE public.search_zero_results_daily IS
  'Daily rollup of zero-result search queries from mobile_events + analytics_events. Seed for demand-gap product; not a sellable export.';

-- ---------------------------------------------------------------------------
-- D) Consent ledger (append-only) + CORE profile fields
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consent_ledger (
  id                      bigserial PRIMARY KEY,
  user_id                 uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recorded_at             timestamptz NOT NULL DEFAULT now(),
  source                  text NOT NULL DEFAULT 'settings',
  terms_version           text NULL,
  privacy_version         text NULL,
  marketing_push          boolean NULL,
  marketing_sms           boolean NULL,
  marketing_whatsapp      boolean NULL,
  marketing_email         boolean NULL,
  location_permission     text NULL,
  personalisation_opt_in  boolean NULL,
  meta                    jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS consent_ledger_user_recorded_idx
  ON public.consent_ledger (user_id, recorded_at DESC);

COMMENT ON TABLE public.consent_ledger IS
  'Append-only consent / permission ledger. Never update rows; insert a new row on every change.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_area_label text NULL,
  ADD COLUMN IF NOT EXISTS age_band text NULL,
  ADD COLUMN IF NOT EXISTS declared_interests text[] NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.home_area_label IS
  'Self-selected neighbourhood / area label (not a street address). CORE declared profile field.';
COMMENT ON COLUMN public.profiles.age_band IS
  'Age band only (e.g. 18-24). Never store full DOB year alongside birthday day/month for analytics.';
COMMENT ON COLUMN public.profiles.declared_interests IS
  'Cold-start category/cuisine interest tags from onboarding or settings.';

-- ---------------------------------------------------------------------------
-- C) Redemptions — money loop with required bill_value at validate
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.redemptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id      bigint NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  deal_id         bigint NULL REFERENCES public.deals(id) ON DELETE SET NULL,
  owner_id        uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_id        uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'validated', 'voided', 'expired')),
  code            text NOT NULL,
  code_expires_at timestamptz NOT NULL,
  bill_value      numeric(12, 2) NULL,
  discount_value  numeric(12, 2) NULL,
  currency        text NOT NULL DEFAULT 'PKR',
  channel         text NOT NULL DEFAULT 'in_app'
                    CHECK (channel IN ('in_app', 'staff')),
  void_reason     text NULL,
  session_id      text NULL,
  source_context  text NULL,
  device_id       text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  validated_at    timestamptz NULL,
  voided_at       timestamptz NULL,
  CONSTRAINT redemptions_bill_when_validated CHECK (
    status <> 'validated' OR bill_value IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS redemptions_code_uidx
  ON public.redemptions (code);

CREATE INDEX IF NOT EXISTS redemptions_user_created_idx
  ON public.redemptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS redemptions_listing_status_idx
  ON public.redemptions (listing_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS redemptions_owner_validated_idx
  ON public.redemptions (owner_id, validated_at DESC)
  WHERE status = 'validated';

COMMENT ON TABLE public.redemptions IS
  'Offer redemptions. Never DELETE — only void with a reason. bill_value required at validate for GMV.';
