-- Add custom tier-level Parchi student pricing columns to ticket_types
ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS parchi_price NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parchi_original_price NUMERIC(10, 2) DEFAULT NULL;
