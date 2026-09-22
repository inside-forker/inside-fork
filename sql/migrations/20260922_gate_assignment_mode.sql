-- Migration: Per-event Manual vs Auto gate assignment on ticket purchase

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS gate_assignment_mode TEXT NOT NULL DEFAULT 'manual';

-- Preserve existing multi-gate behaviour (always load-balanced on purchase)
UPDATE public.events
SET gate_assignment_mode = 'auto'
WHERE scanning_mode = 'multi_gate'
  AND gate_assignment_mode = 'manual';

COMMENT ON COLUMN public.events.gate_assignment_mode IS
  'manual = admin assigns lanes after purchase; auto = assign least-loaded gate when passes are issued';
