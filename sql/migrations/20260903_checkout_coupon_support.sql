-- Extends create_booking_with_reservation (the mobile checkout RPC, called by
-- app/api/mobile/v1/checkout/route.ts) to accept an optional coupon code and
-- apply its discount atomically alongside the existing ticket-inventory
-- locking. Must ship together with the app/api/mobile/v1/checkout/route.ts
-- change in the same deploy, since the route's RPC call signature has to
-- match this function's signature (same rule as 20260812_cnic_hash_hardening.sql).
--
-- Coupon validation intentionally happens here, inside the row-locked RPC,
-- rather than in the API layer: a coupon's usage_limit is exactly the same
-- kind of "don't oversell a limited resource under concurrency" problem as
-- ticket_types.quantity_available, and this function already holds the
-- right locks at the right time to solve both the same way. A separate
-- read-only GET /coupons/validate endpoint exists for the "Apply Offer" UI
-- to preview the discount before checkout, but it never locks or redeems -
-- this function is the sole source of truth for an actual redemption.
--
-- Postgres identifies functions by (name, parameter types); adding a 9th
-- parameter changes the signature, so CREATE OR REPLACE would silently
-- create a second overloaded function rather than replacing this one. The
-- DROP below is required to actually retire the 8-arg version.
DROP FUNCTION IF EXISTS public.create_booking_with_reservation(uuid, jsonb, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_booking_with_reservation(
  p_user_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_cnic_hash text,
  p_cnic_last4 text,
  p_basket_id text DEFAULT NULL::text,
  p_coupon_code text DEFAULT NULL::text
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_booking_id bigint;
  v_total numeric(12,2) := 0;
  v_now timestamptz := now();
  v_item jsonb;
  v_ticket record;
  v_quantity int;
  v_per_person_limit int;
  v_existing_cnic_count int;
  v_booking_reference text := substr(replace(gen_random_uuid()::text,'-',''),1,12);
  v_verification_seed text := substr(replace(gen_random_uuid()::text,'-',''),1,24);
  v_cnic_hash text;
  v_cnic_last4 text;
  v_event_id bigint := NULL;
  v_coupon record;
  v_coupon_id bigint := NULL;
  v_discount numeric(12,2) := 0;
  v_user_coupon_count int;
BEGIN
  -- Validate inputs
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No ticket items provided';
  END IF;

  IF p_cnic_hash IS NULL OR p_cnic_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid CNIC hash';
  END IF;

  IF p_cnic_last4 IS NULL OR p_cnic_last4 !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid CNIC last4';
  END IF;

  -- CNIC arrives pre-hashed from the API layer (lib/utils/cnic-server.ts) -
  -- this function never sees the raw value.
  v_cnic_hash := p_cnic_hash;
  v_cnic_last4 := p_cnic_last4;

  -- ==========================================
  -- IDEMPOTENCY CHECK: If basket_id provided, check if booking already exists
  -- ==========================================
  IF p_basket_id IS NOT NULL THEN
    SELECT id INTO v_booking_id
    FROM bookings
    WHERE user_id = p_user_id
      AND basket_id = p_basket_id
      AND payment_status IN ('awaiting_payment', 'pending');

    -- If booking exists, return it (idempotent). Note: the coupon (if any)
    -- was already locked in when this basket's booking was first created -
    -- a repeat call with a different p_coupon_code does not re-apply here.
    IF v_booking_id IS NOT NULL THEN
      RAISE NOTICE 'Returning existing booking % for basket %', v_booking_id, p_basket_id;
      RETURN v_booking_id;
    END IF;
  END IF;

  -- ==========================================
  -- VALIDATION: Check all tickets and calculate total
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Lock ticket type row for update to prevent race conditions
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', (v_item->>'ticket_type_id');
    END IF;

    -- Ensure all tickets belong to same event
    IF v_event_id IS NULL THEN
      v_event_id := v_ticket.event_id;
    ELSIF v_event_id <> v_ticket.event_id THEN
      RAISE EXCEPTION 'Mixed event ticket types not allowed';
    END IF;

    -- Validate quantity
    v_quantity := (v_item->>'quantity')::int;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for ticket type %', v_ticket.id;
    END IF;

    -- Check sale window
    IF v_now < v_ticket.sale_starts_at OR v_now > v_ticket.sale_ends_at THEN
      RAISE EXCEPTION 'Sale window closed for %', v_ticket.name;
    END IF;

    -- Check availability
    IF v_ticket.quantity_available IS NOT NULL AND v_ticket.quantity_available < v_quantity THEN
      RAISE EXCEPTION 'Insufficient quantity for %', v_ticket.name;
    END IF;

    -- Check per-person limit
    v_per_person_limit := COALESCE(v_ticket.max_per_person, 10);

    SELECT COALESCE(SUM(bi.quantity),0) INTO v_existing_cnic_count
    FROM bookings b
    JOIN booking_items bi ON bi.booking_id = b.id
    WHERE b.event_id = v_ticket.event_id
      AND b.cnic_hash = v_cnic_hash
      AND bi.ticket_type_id = v_ticket.id
      AND b.payment_status IN ('awaiting_payment','paid');

    IF v_existing_cnic_count + v_quantity > v_per_person_limit THEN
      RAISE EXCEPTION 'Per-person limit exceeded for % (limit %)', v_ticket.name, v_per_person_limit;
    END IF;

    -- Accumulate total
    v_total := v_total + (v_ticket.price * v_quantity);
  END LOOP;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine event_id';
  END IF;

  -- ==========================================
  -- COUPON: validate and compute discount, row-locked against concurrent
  -- redemptions the same way ticket inventory is locked above.
  -- ==========================================
  IF p_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon
    FROM coupons
    WHERE code = p_coupon_code
      AND is_active = true
      AND (event_id IS NULL OR event_id = v_event_id)
      AND (starts_at IS NULL OR starts_at <= v_now)
      AND (ends_at IS NULL OR ends_at >= v_now)
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid coupon: not found, expired, or not valid for this event';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
      RAISE EXCEPTION 'Invalid coupon: usage limit reached';
    END IF;

    SELECT COUNT(*) INTO v_user_coupon_count
    FROM bookings
    WHERE user_id = p_user_id
      AND coupon_id = v_coupon.id
      AND payment_status IN ('awaiting_payment', 'paid');

    IF v_user_coupon_count >= v_coupon.per_user_limit THEN
      RAISE EXCEPTION 'Invalid coupon: you have already used this coupon';
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := round(v_total * (v_coupon.discount_value / 100.0), 2);
      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
      END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;

    -- Never let a discount exceed the ticket total (e.g. a flat Rs. 500 off
    -- a Rs. 300 order should not produce a negative charge).
    v_discount := LEAST(v_discount, v_total);
    v_coupon_id := v_coupon.id;
    v_total := v_total - v_discount;

    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- ==========================================
  -- CREATE BOOKING: Insert with basket_id atomically
  -- ==========================================
  INSERT INTO bookings(
    user_id,
    event_id,
    total_amount,
    status,
    customer_name,
    customer_email,
    customer_phone,
    payment_status,
    booking_reference,
    verification_seed,
    cnic_hash,
    cnic_last4,
    basket_id,
    coupon_id,
    discount_amount,
    expires_at
  ) VALUES (
    p_user_id,
    v_event_id,
    v_total,
    'pending',
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    'awaiting_payment',
    v_booking_reference,
    v_verification_seed,
    v_cnic_hash,
    v_cnic_last4,
    p_basket_id,
    v_coupon_id,
    v_discount,
    v_now + INTERVAL '15 minutes'
  )
  ON CONFLICT (user_id, basket_id) DO NOTHING
  RETURNING id INTO v_booking_id;

  -- ==========================================
  -- HANDLE CONFLICT: If ON CONFLICT triggered, fetch existing booking
  -- ==========================================
  IF v_booking_id IS NULL AND p_basket_id IS NOT NULL THEN
    SELECT id INTO v_booking_id
    FROM bookings
    WHERE user_id = p_user_id AND basket_id = p_basket_id;

    IF v_booking_id IS NOT NULL THEN
      RAISE NOTICE 'Conflict: Returning existing booking % for basket %', v_booking_id, p_basket_id;
      RETURN v_booking_id;
    ELSE
      RAISE EXCEPTION 'Failed to create or retrieve booking';
    END IF;
  END IF;

  -- ==========================================
  -- CREATE BOOKING ITEMS & DECREMENT INVENTORY
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO booking_items(
      booking_id,
      ticket_type_id,
      quantity,
      price_per_ticket
    ) VALUES (
      v_booking_id,
      v_ticket.id,
      v_quantity,
      v_ticket.price
    );

    IF v_ticket.quantity_available IS NOT NULL THEN
      UPDATE ticket_types
      SET quantity_available = quantity_available - v_quantity
      WHERE id = v_ticket.id;
    END IF;
  END LOOP;

  RETURN v_booking_id;
END;
$function$;
