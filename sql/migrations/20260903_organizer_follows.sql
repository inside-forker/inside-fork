-- Followers for organizer public profiles. A user cannot follow themselves
-- (organizer_follows_no_self), enforced at the DB layer rather than just the
-- UI, since the public profile route is reachable by anyone with the URL.

CREATE TABLE IF NOT EXISTS public.organizer_follows (
  follower_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organizer_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, organizer_id),
  CONSTRAINT organizer_follows_no_self CHECK (follower_id <> organizer_id)
);

CREATE INDEX IF NOT EXISTS organizer_follows_organizer_idx ON public.organizer_follows (organizer_id);

COMMENT ON TABLE public.organizer_follows IS
  'Users following an organizer''s public profile. follower_id/organizer_id both reference profiles(id) - there is no separate "organizer" entity.';
