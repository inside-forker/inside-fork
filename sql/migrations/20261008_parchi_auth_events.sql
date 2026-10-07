-- Website sign-ups / sign-ins that came from the Parchi app.
--
-- The Parchi app's "Get tickets" link (?ref=parchi_app&parchiId=XXX) leaves a
-- marker cookie (ik_from_parchi) in the browser; the next email / Google /
-- Apple sign-up or sign-in records a row here and clears the marker
-- (lib/parchi/attribution.ts). "Did this user come from Parchi?" =
-- EXISTS a row for their user_id. Additive only - safe to apply any time.

CREATE TABLE IF NOT EXISTS public.parchi_auth_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event       text NOT NULL CHECK (event IN ('signup', 'signin')),
  method      text NOT NULL CHECK (method IN ('email', 'google', 'apple')),
  -- The Parchi ID from the link, when it had one.
  parchi_id   text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parchi_auth_events_user_idx
  ON public.parchi_auth_events (user_id);
CREATE INDEX IF NOT EXISTS parchi_auth_events_created_idx
  ON public.parchi_auth_events (created_at DESC);

COMMENT ON TABLE public.parchi_auth_events IS
  'Website sign-ups/sign-ins that followed a visit from the Parchi app (marker cookie ik_from_parchi). See lib/parchi/attribution.ts.';
