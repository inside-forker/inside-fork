-- Releases unpaid booking holds that have lapsed, so an abandoned checkout no
-- longer blocks the same person from booking again.
--
-- The bug: a buyer fills in their CNIC, continues to PayFast, and leaves
-- without paying. That booking stays `awaiting_payment` forever (nothing ever
-- expires it), and every checkout uses a fresh basket_id, so the idempotency
-- check never reuses it. The per-person check in create_booking_atomic (web)
-- and create_booking_with_reservation (mobile) counts `awaiting_payment`
-- bookings against the CNIC, so on an event with max_per_person = 1 the buyer
-- comes back and gets "Per-person limit exceeded" for a ticket they never
-- bought. The per-user coupon / Parchi counts have the same blind spot.
--
-- The checkout routes call this immediately before creating a NEW booking (not
-- on basket reuse). For this event it marks as `expired` every unpaid booking
-- of the same user, plus any lapsed hold (expires_at in the past) on the same
-- CNIC made from another account, and returns the
-- stock those holds took from ticket_types.quantity_available (except on
-- PDF-inventory tiers, whose stock is recomputed from free PDFs). Once expired,
-- the existing checks stop counting them and the resume flow refuses them
-- (lib/checkout/resume.ts treats `expired` as gone), so a superseded hold
-- can't be revived and paid alongside the new booking.
--
-- Another account's live hold on the same CNIC is left alone and still counts.
-- Known edge: if a buyer opens PayFast for booking A, starts booking B, then
-- completes A's payment anyway, the PayFast callback still marks A paid (it
-- only refuses paid/refunded rows), so they can end up one over the limit.

CREATE OR REPLACE FUNCTION public.release_lapsed_booking_holds(
  p_event_id bigint,
  p_cnic_hash text,
  p_user_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_released int := 0;
BEGIN
  WITH lapsed AS (
    UPDATE bookings
       SET payment_status = 'expired'
     WHERE event_id = p_event_id
       AND payment_status IN ('awaiting_payment', 'pending')
       AND (
         -- The buyer's own unpaid bookings: starting a new checkout abandons
         -- them, however recent (a buyer back within the 30-min hold was
         -- still blocked otherwise).
         user_id = p_user_id
         -- Someone else's hold on this CNIC: only once it has lapsed.
         OR (cnic_hash = p_cnic_hash AND expires_at IS NOT NULL AND expires_at < now())
       )
    RETURNING id
  ),
  returned AS (
    SELECT bi.ticket_type_id, SUM(bi.quantity)::int AS qty
      FROM booking_items bi
      JOIN lapsed l ON l.id = bi.booking_id
     GROUP BY bi.ticket_type_id
  ),
  -- Data-modifying CTEs always run to completion, referenced or not.
  restock AS (
    UPDATE ticket_types tt
       SET quantity_available = tt.quantity_available + r.qty
      FROM returned r
     WHERE tt.id = r.ticket_type_id
       AND tt.quantity_available IS NOT NULL
       -- PDF-inventory tiers derive stock from free PDF rows instead
       -- (lib/ticketing/sellable-quantity.ts), so a refund here would overcount.
       AND NOT EXISTS (
         SELECT 1 FROM ticket_pdf_inventory i WHERE i.ticket_type_id = tt.id
       )
  )
  SELECT COUNT(*) INTO v_released FROM lapsed;

  RETURN v_released;
END;
$function$;

-- Only the app's own DB role calls this (from the checkout routes).
REVOKE ALL ON FUNCTION public.release_lapsed_booking_holds(bigint, text, uuid) FROM PUBLIC;
