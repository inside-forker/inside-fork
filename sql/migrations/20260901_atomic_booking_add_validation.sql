-- Adds the validation `create_booking_with_reservation` (the mobile booking
-- path, sql/migrations/20260812_cnic_hash_hardening.sql) already has, but
-- `create_booking_atomic` (the WEBSITE booking path, called from
-- app/api/bookings/create/route.ts) never did:
--
--   1. Sale-window check (booking outside sale_starts_at/sale_ends_at)
--   2. Inventory check + decrement (quantity_available)
--   3. Per-person limit check, keyed on cnic_hash, scoped to event + ticket type
--   4. `SELECT ... FOR UPDATE` locking on the ticket_type row, so concurrent
--      calls for the same ticket type serialize instead of racing
--
-- Found live in production: one CNIC accumulated 22 "Entry Pass" tickets
-- against a configured max_per_person of 10, entirely via bookings created
-- through this function - the mobile path's check was working the whole
-- time and correctly rejected a later attempt once the same CNIC crossed
-- 10 there too. The website path had simply never been enforcing anything.
--
-- Signature and return shape are UNCHANGED - only the route calling this
-- (app/api/bookings/create/route.ts) needs no changes to keep working; it
-- now additionally needs to handle validation failures that were previously
-- impossible from this function (see the companion TypeScript change that
-- surfaces these instead of a generic 500).
--
-- Rollback: re-run 20260812_baseline_create_booking_atomic.sql to restore
-- the unvalidated version (NOT recommended - that reintroduces this gap).

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  p_user_id uuid,
  p_event_id bigint,
  p_total_amount numeric,
  p_basket_id text,
  p_booking_reference text,
  p_verification_seed text,
  p_expires_at timestamp with time zone,
  p_cnic_hash text,
  p_cnic_last4 text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id          bigint;
  v_item                jsonb;
  v_ticket               record;
  v_quantity             int;
  v_now                  timestamptz := now();
  v_per_person_limit     int;
  v_existing_cnic_count  int;
BEGIN
  -- Idempotency check, unchanged: a retry with the same basket_id returns the
  -- existing unpaid booking rather than creating a duplicate.
  SELECT id INTO v_booking_id
  FROM public.bookings
  WHERE user_id = p_user_id
    AND basket_id = p_basket_id
    AND payment_status IN ('awaiting_payment', 'pending')
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'booking_id',        v_booking_id,
      'booking_reference', p_booking_reference
    );
  END IF;

  -- ==========================================
  -- VALIDATION: lock + check every ticket type before writing anything.
  -- Mirrors create_booking_with_reservation's validation loop exactly, so the
  -- two booking paths can no longer diverge on what's allowed.
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', (v_item->>'ticket_type_id');
    END IF;

    v_quantity := (v_item->>'quantity')::int;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for ticket type %', v_ticket.id;
    END IF;

    IF v_now < v_ticket.sale_starts_at OR v_now > v_ticket.sale_ends_at THEN
      RAISE EXCEPTION 'Sale window closed for %', v_ticket.name;
    END IF;

    IF v_ticket.quantity_available IS NOT NULL AND v_ticket.quantity_available < v_quantity THEN
      RAISE EXCEPTION 'Insufficient quantity for %', v_ticket.name;
    END IF;

    v_per_person_limit := COALESCE(v_ticket.max_per_person, 10);

    SELECT COALESCE(SUM(bi.quantity), 0) INTO v_existing_cnic_count
    FROM bookings b
    JOIN booking_items bi ON bi.booking_id = b.id
    WHERE b.event_id = p_event_id
      AND b.cnic_hash = p_cnic_hash
      AND bi.ticket_type_id = v_ticket.id
      AND b.payment_status IN ('awaiting_payment', 'paid');

    IF v_existing_cnic_count + v_quantity > v_per_person_limit THEN
      RAISE EXCEPTION 'Per-person limit exceeded for % (limit %)', v_ticket.name, v_per_person_limit;
    END IF;
  END LOOP;

  -- ==========================================
  -- CREATE BOOKING: unchanged from the prior version.
  -- ==========================================
  INSERT INTO public.bookings (
    user_id, event_id, total_amount, basket_id,
    booking_reference, verification_seed, expires_at,
    cnic_hash, cnic_last4,
    customer_name, customer_email, customer_phone,
    status, payment_status
  )
  VALUES (
    p_user_id, p_event_id, p_total_amount, p_basket_id,
    p_booking_reference, p_verification_seed, p_expires_at,
    p_cnic_hash, p_cnic_last4,
    p_customer_name, p_customer_email, p_customer_phone,
    'pending', 'awaiting_payment'
  )
  ON CONFLICT (user_id, basket_id) DO NOTHING
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE user_id = p_user_id AND basket_id = p_basket_id
    LIMIT 1;

    IF v_booking_id IS NULL THEN
      RAISE EXCEPTION 'create_booking_atomic: failed to create or retrieve booking for basket %', p_basket_id;
    END IF;

    RETURN jsonb_build_object(
      'booking_id',        v_booking_id,
      'booking_reference', p_booking_reference
    );
  END IF;

  -- ==========================================
  -- BOOKING ITEMS + INVENTORY DECREMENT (new: the decrement).
  -- Ticket types were already locked FOR UPDATE in the validation loop above,
  -- so this decrement is safe against concurrent bookings for the same type.
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO public.booking_items (
      booking_id,
      ticket_type_id,
      quantity,
      price_per_ticket
    )
    VALUES (
      v_booking_id,
      (v_item->>'ticket_type_id')::bigint,
      v_quantity,
      (v_item->>'price_per_ticket')::numeric
    );

    UPDATE ticket_types
    SET quantity_available = quantity_available - v_quantity
    WHERE id = (v_item->>'ticket_type_id')::bigint
      AND quantity_available IS NOT NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'booking_id',        v_booking_id,
    'booking_reference', p_booking_reference
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'create_booking_atomic failed: %', SQLERRM;
END;
$function$;
