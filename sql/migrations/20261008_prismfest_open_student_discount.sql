-- Allow create_booking_atomic to accept an Inside Karachi "open" student
-- discount on Prismfest when the API has verified the shopper is logged in
-- and NOT on the Parchi app channel. Parchi-channel shoppers still require
-- claim_parchi_discount via p_parchi_request_id.

DROP FUNCTION IF EXISTS public.create_booking_atomic(
  uuid, bigint, numeric, text, text, text, timestamp with time zone,
  text, text, text, text, text, jsonb, uuid, numeric
);

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
  p_items jsonb,
  p_parchi_request_id uuid DEFAULT NULL::uuid,
  p_discount_amount numeric DEFAULT 0,
  p_allow_open_student_discount boolean DEFAULT false
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
  v_subtotal             numeric(12,2) := 0;
  v_coupon_id            bigint := NULL;
  v_discount             numeric(12,2) := 0;
  v_claim                record;
  v_coupon               record;
  v_event_slug           text;
BEGIN
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::int;

    IF v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid ticket quantity';
    END IF;

    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type not found';
    END IF;

    IF v_ticket.event_id <> p_event_id THEN
      RAISE EXCEPTION 'Ticket does not belong to this event';
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

    v_subtotal := v_subtotal + (v_ticket.price * v_quantity);
  END LOOP;

  IF p_parchi_request_id IS NOT NULL THEN
    SELECT * INTO v_claim
    FROM claim_parchi_discount(p_parchi_request_id, p_user_id, p_event_id, v_subtotal);
    v_coupon_id := v_claim.o_coupon_id;
    v_discount := v_claim.o_discount;

    IF abs(v_discount - COALESCE(p_discount_amount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Parchi: the student discount changed. Please review your order and try again.';
    END IF;
  ELSIF COALESCE(p_discount_amount, 0) <> 0 THEN
    IF NOT COALESCE(p_allow_open_student_discount, false) THEN
      RAISE EXCEPTION 'Invalid discount without a Parchi verification';
    END IF;

    SELECT slug INTO v_event_slug FROM events WHERE id = p_event_id;
    IF v_event_slug IS DISTINCT FROM 'prismfest-26' THEN
      RAISE EXCEPTION 'Student discount is not available for this event';
    END IF;

    SELECT id, discount_type, discount_value, max_discount_amount
    INTO v_coupon
    FROM coupons
    WHERE requires_parchi = true
      AND is_active = true
      AND (event_id IS NULL OR event_id = p_event_id)
      AND (starts_at IS NULL OR starts_at <= v_now)
      AND (ends_at IS NULL OR ends_at >= v_now)
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    ORDER BY event_id NULLS LAST, id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student discount is not available';
    END IF;

    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := round(v_subtotal * v_coupon.discount_value) / 100;
      IF v_coupon.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_coupon.max_discount_amount);
      END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    v_discount := LEAST(v_discount, v_subtotal);
    v_coupon_id := v_coupon.id;

    IF abs(v_discount - COALESCE(p_discount_amount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Student discount changed. Please review your order and try again.';
    END IF;

    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon_id;
  END IF;

  INSERT INTO public.bookings (
    user_id, event_id, total_amount, basket_id,
    booking_reference, verification_seed, expires_at,
    cnic_hash, cnic_last4,
    customer_name, customer_email, customer_phone,
    status, payment_status,
    coupon_id, discount_amount
  )
  VALUES (
    p_user_id, p_event_id, p_total_amount, p_basket_id,
    p_booking_reference, p_verification_seed, p_expires_at,
    p_cnic_hash, p_cnic_last4,
    p_customer_name, p_customer_email, p_customer_phone,
    'pending', 'awaiting_payment',
    v_coupon_id, v_discount
  )
  ON CONFLICT (user_id, basket_id) DO NOTHING
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    IF p_parchi_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Booking already in progress for this basket';
    END IF;

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

  IF p_parchi_request_id IS NOT NULL THEN
    UPDATE parchi_verifications
    SET booking_id = v_booking_id, updated_at = v_now
    WHERE request_id = p_parchi_request_id;
  END IF;

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
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'create_booking_atomic failed: %', SQLERRM;
END;
$function$;
