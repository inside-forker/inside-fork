-- Migration: Event-specific custom payment processing and platform fees
-- Allows events to override universal rates configured in system_config.
-- If NULL, checkout and booking fallback to system_config values.
-- If set to 0, fees are waived.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_processing_fee_percentage NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_processing_fee_fixed NUMERIC(10, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_percentage NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_fixed NUMERIC(10, 2) DEFAULT NULL;

COMMENT ON COLUMN events.payment_processing_fee_percentage IS 'Custom payment processing fee percentage override. NULL = use system_config default.';
COMMENT ON COLUMN events.payment_processing_fee_fixed IS 'Custom fixed payment processing fee in PKR override. NULL = use system_config default.';
COMMENT ON COLUMN events.platform_fee_percentage IS 'Custom platform fee percentage override. NULL = use system_config default.';
COMMENT ON COLUMN events.platform_fee_fixed IS 'Custom fixed platform fee in PKR override. NULL = use system_config default.';

