-- Add group_name and group_order to ticket_types
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS group_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS group_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ticket_types_event_group 
  ON ticket_types(event_id, group_order, group_name);


-- Add original_price for slashed/discount pricing on ticket tiers
ALTER TABLE ticket_types
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2) DEFAULT NULL;
