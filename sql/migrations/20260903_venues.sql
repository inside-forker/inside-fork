-- Venue entity, linked from events via a nullable venue_id. Additive only:
-- an event with no venue_id keeps behaving exactly as before (inline
-- location_name/address/lat/lng, "open in Maps" on tap). Linking a venue is
-- opt-in per event, done via direct SQL / the existing admin events PATCH
-- for the first batch - no admin venue-authoring UI yet.

CREATE TABLE IF NOT EXISTS public.venues (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  description     text NULL,
  address         text NULL,
  latitude        double precision NULL,
  longitude       double precision NULL,
  phone           text NULL,
  website         text NULL,
  -- Manually curated for launch - there's no review system on venues to
  -- derive this from (events aren't linked to listings/reviews).
  rating          numeric(2,1) NULL,
  facilities      text[] NOT NULL DEFAULT '{}',
  cover_image_url text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id bigint NULL REFERENCES public.venues(id);

CREATE INDEX IF NOT EXISTS events_venue_idx ON public.events (venue_id) WHERE venue_id IS NOT NULL;

COMMENT ON TABLE public.venues IS
  'Physical venues events can optionally link to (events.venue_id, nullable). Not the same as listings - a venue has no owner/organizer account and no review system.';
