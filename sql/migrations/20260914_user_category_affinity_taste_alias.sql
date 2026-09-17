-- Adds a `taste` column to user_category_affinity as a friendlier-named,
-- always-in-sync alias of `affinity`. Deliberately a GENERATED (STORED)
-- column rather than a second value refresh-intelligence has to remember to
-- write: Postgres keeps it equal to `affinity` automatically on every
-- insert/update, so lib/analytics/taste-graph.ts needs no code change and
-- the two values can never drift apart.
--
-- Purely additive - `affinity` is untouched, nothing else needs updating.

ALTER TABLE public.user_category_affinity
  ADD COLUMN IF NOT EXISTS taste numeric(8, 4) GENERATED ALWAYS AS (affinity) STORED;

COMMENT ON COLUMN public.user_category_affinity.taste IS
  'Generated alias of `affinity` (same value, always in sync) - the "taste graph" score under a friendlier column name.';
