-- Favorites for events, sibling to favorite_listings rather than a
-- polymorphic entity_type/entity_id table - same reasoning as
-- 20260729_user_listing_events.sql: events and listings already have
-- separate query/API surfaces, so a shared table would only buy an
-- abstraction neither side needs, at the cost of every query needing a
-- discriminator filter.

CREATE TABLE IF NOT EXISTS public.favorite_events (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id   bigint      NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS favorite_events_event_idx ON public.favorite_events (event_id);

COMMENT ON TABLE public.favorite_events IS
  'User-favorited events, mirroring favorite_listings. Composite PK (user_id, event_id) - no surrogate id column, same as favorite_listings.';
