-- Bank/card offers on events, sibling to `deals` (which is hard-tied to
-- listing_id NOT NULL) rather than loosening that column to nullable with an
-- XOR check - same "separate table per entity" reasoning as favorite_events.
-- Columns deliberately mirror `deals` 1:1 so existing formatting/weighting
-- logic (lib/mobile/deal-format.ts) works unchanged against either table.

CREATE TABLE IF NOT EXISTS public.event_deals (
  id                  bigserial PRIMARY KEY,
  event_id            bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  bank_id             bigint NULL REFERENCES public.banks(id),
  deal_type           public.deal_type NOT NULL,
  title               text NOT NULL,
  description         text NULL,
  discount_value      text NULL,
  valid_card_variants bigint[] NULL,
  start_date          timestamptz NULL,
  end_date            timestamptz NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_deals_event_idx ON public.event_deals (event_id) WHERE is_active;

COMMENT ON TABLE public.event_deals IS
  'Bank/card offers on events - sibling to deals (listings), not a shared polymorphic table. Content is entered directly via SQL for now; no admin UI yet.';
