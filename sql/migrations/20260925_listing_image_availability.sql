-- Listing image health: persist Spaces probe results so browse covers can
-- exclude confirmed-dead objects without HEADing on every list request.

ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listing_images_availability_check'
  ) THEN
    ALTER TABLE public.listing_images
      ADD CONSTRAINT listing_images_availability_check
      CHECK (availability IN ('unknown', 'ok', 'dead'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listing_images_availability_idx
  ON public.listing_images (listing_id)
  WHERE availability IS DISTINCT FROM 'dead';

COMMENT ON COLUMN public.listing_images.availability IS
  'Spaces probe result: unknown (default), ok (reachable), dead (403/404/5xx). Browse covers exclude dead.';

COMMENT ON COLUMN public.listing_images.last_checked_at IS
  'When availability was last probed by audit script or nightly cron.';
