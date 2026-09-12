-- Migration: Add audit columns to ticket_passes and create scan_audit_log for offline reconciliation

-- 1. Add audit columns to ticket_passes
ALTER TABLE public.ticket_passes
ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS checked_in_device_id TEXT,
ADD COLUMN IF NOT EXISTS checked_in_device_time TIMESTAMPTZ;

-- 2. Create scan_audit_log table for tracking every individual scan attempt across all devices
CREATE TABLE IF NOT EXISTS public.scan_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT NOT NULL,
  ticket_pass_id BIGINT REFERENCES public.ticket_passes(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  scanned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  duplicate_of UUID REFERENCES public.scan_audit_log(id) ON DELETE SET NULL,
  status TEXT NOT NULL, -- 'valid', 'already_used', 'invalid_signature', 'revoked', 'unpaid', 'event_mismatch', 'not_found'
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast lookup and reconciliation sweeps
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_event_code ON public.scan_audit_log(event_id, ticket_code);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_scanned_by ON public.scan_audit_log(scanned_by);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_device_id ON public.scan_audit_log(device_id);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_scanned_at ON public.scan_audit_log(scanned_at);
CREATE INDEX IF NOT EXISTS idx_scan_audit_log_event_id ON public.scan_audit_log(event_id);
