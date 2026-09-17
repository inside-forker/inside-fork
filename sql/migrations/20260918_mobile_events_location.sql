-- Migration: Add location telemetry columns to mobile_events for Snapchat Maps-style intelligence
-- Phase 1: Add columns for coordinates, accuracy, neighborhood, city

ALTER TABLE public.mobile_events
  ADD COLUMN IF NOT EXISTS latitude double precision NULL,
  ADD COLUMN IF NOT EXISTS longitude double precision NULL,
  ADD COLUMN IF NOT EXISTS accuracy real NULL,
  ADD COLUMN IF NOT EXISTS neighborhood text NULL,
  ADD COLUMN IF NOT EXISTS city text NULL DEFAULT 'Karachi';

-- Spatial and neighborhood indexing for fast geospatial aggregation
CREATE INDEX IF NOT EXISTS me_location_coords_idx
  ON public.mobile_events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS me_neighborhood_time_idx
  ON public.mobile_events (neighborhood, occurred_at DESC)
  WHERE neighborhood IS NOT NULL;

COMMENT ON COLUMN public.mobile_events.latitude IS 'User GPS latitude at the time of event';
COMMENT ON COLUMN public.mobile_events.longitude IS 'User GPS longitude at the time of event';
COMMENT ON COLUMN public.mobile_events.accuracy IS 'GPS horizontal accuracy in meters';
COMMENT ON COLUMN public.mobile_events.neighborhood IS 'Resolved Karachi neighborhood/area (e.g. Gulshan-e-Iqbal, Clifton, DHA Phase 5, Johar)';
COMMENT ON COLUMN public.mobile_events.city IS 'City name, default Karachi';
