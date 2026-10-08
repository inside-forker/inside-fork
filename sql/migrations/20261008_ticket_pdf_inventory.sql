-- Pre-uploaded Ticketwala (or other organizer) PDF inventory per ticket_type.
-- When a ticket_type has rows here, paid seats consume one PDF each instead of
-- issuing IK QR ticket_passes for that line item.
--
-- Stock: keep ticket_types.quantity_available in sync with unassigned rows
-- (seed/upload scripts set both). Assignment is one-way: booking_id once set
-- never cleared by normal sale flow.

CREATE TABLE IF NOT EXISTS public.ticket_pdf_inventory (
  id                  bigserial PRIMARY KEY,
  ticket_type_id      bigint NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  external_ticket_id  text NOT NULL,
  storage_key         text NOT NULL,
  original_filename   text NULL,
  -- booking_items has no surrogate id (booking_id + ticket_type_id).
  booking_id          bigint NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  assigned_at         timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_pdf_inventory_external_ticket_id_key UNIQUE (external_ticket_id),
  CONSTRAINT ticket_pdf_inventory_storage_key_key UNIQUE (storage_key),
  CONSTRAINT ticket_pdf_inventory_assigned_consistency_chk CHECK (
    (booking_id IS NULL AND assigned_at IS NULL)
    OR (booking_id IS NOT NULL AND assigned_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS ticket_pdf_inventory_type_available_idx
  ON public.ticket_pdf_inventory (ticket_type_id)
  WHERE booking_id IS NULL;

CREATE INDEX IF NOT EXISTS ticket_pdf_inventory_booking_idx
  ON public.ticket_pdf_inventory (booking_id)
  WHERE booking_id IS NOT NULL;

COMMENT ON TABLE public.ticket_pdf_inventory IS
  'Organizer PDF ticket pool. One unassigned row = one sellable seat for that ticket_type; assignment is permanent for sale tracking.';

-- Parchi students who paid for a PDF-inventory tier (e.g. Prism Fam):
--   SELECT v.parchi_id, v.user_id, v.booking_id, b.payment_status,
--          i.external_ticket_id, i.assigned_at, tt.name AS ticket_type_name
--   FROM parchi_verifications v
--   JOIN bookings b ON b.id = v.booking_id
--   JOIN booking_items bi ON bi.booking_id = b.id
--   JOIN ticket_types tt ON tt.id = bi.ticket_type_id
--   LEFT JOIN ticket_pdf_inventory i
--     ON i.booking_id = b.id AND i.ticket_type_id = tt.id
--   WHERE v.status = 'approved'
--     AND b.payment_status = 'paid'
--     AND EXISTS (
--       SELECT 1 FROM ticket_pdf_inventory inv WHERE inv.ticket_type_id = tt.id
--     );

-- Cap Prism Fam on Prismfest to match the initial 20-PDF pool when the tier exists.
-- Safe no-op if the event/tier is missing. Does not overwrite a tighter stock.
UPDATE public.ticket_types tt
SET quantity_available = 20
FROM public.events e
WHERE e.id = tt.event_id
  AND lower(e.slug) = 'prismfest-26'
  AND tt.name ILIKE 'Prism Fam%'
  AND (tt.quantity_available IS NULL OR tt.quantity_available > 20);
