-- Migration: Allow NULL operator_id in event_device_operators
-- Allows admins to configure and save custom device/gate labels (e.g. GATE A, GATE B)
-- even before assigning a specific scanner operator account.

ALTER TABLE IF EXISTS public.event_device_operators
  ALTER COLUMN operator_id DROP NOT NULL;
