-- Index for published event feeds ordered by soonest start (homepage + mobile).
CREATE INDEX IF NOT EXISTS events_published_end_start_idx
  ON public.events (end_time, start_time)
  WHERE status = 'published';
