-- Raw event log for event-recommendation personalization ("habits"), the
-- calendar-events sibling to user_listing_events. Deliberately a dedicated
-- table rather than a generic entity-agnostic one (e.g. widening
-- user_listing_events to accept either a listing_id or event_id) for the same
-- reasons user_listing_events itself gives (see its own migration header):
-- no entity-type discriminator to safely add after the fact, and analytics_events'
-- enum event_type would need an irreversible ALTER TYPE ADD VALUE. Same
-- reasoning already produced favorite_events as a sibling to favorite_listings.

CREATE TABLE IF NOT EXISTS public.user_event_events (
  id             bigserial PRIMARY KEY,
  user_id        uuid   NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_id        text   NULL,
  event_id       bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_type     text   NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  context        jsonb  NOT NULL DEFAULT '{}'::jsonb,
  session_id     text   NULL,
  source_context text   NULL,
  device_id      text   NULL,
  CONSTRAINT uee_actor_present CHECK (user_id IS NOT NULL OR anon_id IS NOT NULL),
  CONSTRAINT uee_type CHECK (event_type IN (
    'view','view_long','favorite','unfavorite','share','rec_impression','rec_click'))
);

CREATE INDEX IF NOT EXISTS uee_user_created_idx
  ON public.user_event_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS uee_anon_created_idx
  ON public.user_event_events (anon_id, created_at DESC) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS uee_event_created_idx
  ON public.user_event_events (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS uee_session_created_idx
  ON public.user_event_events (session_id, created_at DESC) WHERE session_id IS NOT NULL;

COMMENT ON TABLE public.user_event_events IS
  'Raw per-actor calendar-event interaction log driving event recommendation affinity (lib/recommendations/affinity.ts, getEventCategoryAffinity). text event_type + CHECK, not an enum - see migration header for why. Sibling to user_listing_events.';
