-- Group tickets + organizer-defined attendee fields.
--
-- * ticket_types.people_per_ticket: how many people one ticket admits. A
--   "Group of 3" ticket is sold and stocked as ONE ticket, but issues three
--   passes (one QR per person, each with its own name + CNIC).
-- * events.attendee_fields / ticket_types.attendee_fields: extra questions the
--   buyer answers at checkout (e.g. "University name"). Event-level fields
--   apply to every ticket of the event; ticket-level ones only to that tier.
--   Each field: { id, label, type, options?, required, scope }, where scope is
--   'person' (asked for every pass holder) or 'order' (asked once per booking).
-- * bookings.attendee_details: what was entered at checkout, kept until the
--   passes are issued (mobile + PayFast bookings get their passes only after
--   payment). Shape: { order: Answer[], holders: { "<ticket_type_id>": Holder[] } }
--   with holders indexed by pass quantity_index. Only CNIC last 4 is kept.
-- * Per-pass answers + group position live in ticket_passes.metadata (existing,
--   previously unused column), so no pass schema change is needed.

ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS people_per_ticket integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS attendee_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_types_people_per_ticket_check'
  ) THEN
    ALTER TABLE public.ticket_types
      ADD CONSTRAINT ticket_types_people_per_ticket_check
      CHECK (people_per_ticket BETWEEN 1 AND 10);
  END IF;
END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS attendee_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS attendee_details jsonb NULL;

COMMENT ON COLUMN public.ticket_types.people_per_ticket IS
  'People admitted by one ticket. >1 = group ticket: one sale, one pass (QR) per person.';
COMMENT ON COLUMN public.ticket_types.attendee_fields IS
  'Extra checkout questions for this tier only (see events.attendee_fields).';
COMMENT ON COLUMN public.events.attendee_fields IS
  'Extra checkout questions for every ticket of the event: [{id,label,type,options,required,scope}].';
COMMENT ON COLUMN public.bookings.attendee_details IS
  'Checkout answers + holder names/CNIC last4 per pass slot, used when issuing passes.';
