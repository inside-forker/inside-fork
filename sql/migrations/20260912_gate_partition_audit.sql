-- Migration: Add gate partition columns to scan_audit_log for multi-gate offline tracking

ALTER TABLE public.scan_audit_log
ADD COLUMN IF NOT EXISTS gate_index SMALLINT,
ADD COLUMN IF NOT EXISTS total_gates SMALLINT;
