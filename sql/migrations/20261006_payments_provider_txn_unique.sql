-- PayFast webhook uses:
--   ON CONFLICT (provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL) DO NOTHING
-- Postgres only accepts a *partial* unique index as that arbiter when the
-- conflict target carries the same WHERE predicate. Bare
-- ON CONFLICT (provider_transaction_id) raises 42P10 against this index.
--
-- Idempotent: safe if the dump / an earlier env already has the index.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_txn_unique
  ON public.payments (provider_transaction_id)
  WHERE (provider_transaction_id IS NOT NULL);
