-- Denormalized favorite counts for feed ranking (hidden-gems, etc.).
-- Maintained by triggers so queries can LEFT JOIN instead of GROUP BY
-- the entire favorite_listings table on every request.

CREATE TABLE IF NOT EXISTS public.listing_stats (
  listing_id bigint PRIMARY KEY REFERENCES public.listings (id) ON DELETE CASCADE,
  favorite_count integer NOT NULL DEFAULT 0
    CHECK (favorite_count >= 0)
);

CREATE INDEX IF NOT EXISTS listing_stats_favorite_count_idx
  ON public.listing_stats (favorite_count);

-- Backfill from current favorites.
INSERT INTO public.listing_stats (listing_id, favorite_count)
SELECT listing_id, COUNT(*)::integer
FROM public.favorite_listings
GROUP BY listing_id
ON CONFLICT (listing_id) DO UPDATE
SET favorite_count = EXCLUDED.favorite_count;

CREATE OR REPLACE FUNCTION public.listing_stats_favorite_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.listing_stats (listing_id, favorite_count)
  VALUES (NEW.listing_id, 1)
  ON CONFLICT (listing_id) DO UPDATE
  SET favorite_count = public.listing_stats.favorite_count + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.listing_stats_favorite_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.listing_stats
  SET favorite_count = GREATEST(favorite_count - 1, 0)
  WHERE listing_id = OLD.listing_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS listing_stats_on_favorite_insert ON public.favorite_listings;
CREATE TRIGGER listing_stats_on_favorite_insert
  AFTER INSERT ON public.favorite_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_stats_favorite_insert();

DROP TRIGGER IF EXISTS listing_stats_on_favorite_delete ON public.favorite_listings;
CREATE TRIGGER listing_stats_on_favorite_delete
  AFTER DELETE ON public.favorite_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_stats_favorite_delete();

COMMENT ON TABLE public.listing_stats IS
  'Per-listing counters. favorite_count kept in sync with favorite_listings via triggers.';
