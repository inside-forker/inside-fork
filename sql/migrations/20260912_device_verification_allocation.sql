-- Migration: Add assigned_gate_index to ticket_passes and create event_device_operators table

-- 1. Add assigned_gate_index to ticket_passes (0 = Device 1, 1 = Device 2, etc.)
ALTER TABLE public.ticket_passes 
ADD COLUMN IF NOT EXISTS assigned_gate_index SMALLINT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_passes_event_assigned_gate
ON public.ticket_passes(event_id, assigned_gate_index);

-- 2. Create event_device_operators table to link Scanner Operators (eo_gate_pass profiles) to event device slots
CREATE TABLE IF NOT EXISTS public.event_device_operators (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  device_index SMALLINT NOT NULL,
  operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_event_device UNIQUE (event_id, device_index)
);

CREATE INDEX IF NOT EXISTS idx_event_device_operators_event
ON public.event_device_operators(event_id);

CREATE INDEX IF NOT EXISTS idx_event_device_operators_operator
ON public.event_device_operators(operator_id);
