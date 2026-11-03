-- INSID-236: the event's Parchi % applies to every ticket.
--
-- Student price per tier: round(price * (100 - parchi_discount_percent) / 100)
-- when the event has a %, otherwise the ticket's own parchi_price. (Was: the
-- ticket's parchi_price overrode the event %.) Same expression as
-- studentPriceSql() in lib/parchi/discount.ts. Only the price expression in
-- create_booking_atomic changes; the rest is as in 20261103_event_parchi_toggle.

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
  v_ver                  record;
  v_tier_parchi_discount numeric(12,2) := 0;
  v_parchi_enabled      boolean := false;
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

  SELECT COALESCE(parchi_enabled, false) INTO v_parchi_enabled
  FROM events WHERE id = p_event_id;

  -- Per-tier student discount on a parchi_enabled event: price minus the
  -- student price (tier override, else the event's %). The whole discount,
  -- for Parchi-verified and Inside Karachi (open) shoppers alike.
  SELECT COALESCE(SUM(GREATEST(0, (x.price - x.student_price) * x.qty)), 0)
  INTO v_tier_parchi_discount
  FROM (
    SELECT tt.price,
           (v_item_sub->>'quantity')::int AS qty,
           (CASE WHEN e.parchi_enabled THEN
              CASE WHEN e.parchi_discount_percent > 0
                THEN round(tt.price * (100 - e.parchi_discount_percent) / 100)
                ELSE tt.parchi_price END END) AS student_price
    FROM jsonb_array_elements(p_items) v_item_sub
    JOIN ticket_types tt ON tt.id = (v_item_sub->>'ticket_type_id')::bigint
    JOIN events e ON e.id = tt.event_id
  ) x
  WHERE x.student_price IS NOT NULL AND x.student_price < x.price;

  IF p_parchi_request_id IS NOT NULL THEN
    IF v_parchi_enabled THEN
      SELECT * INTO v_ver
      FROM parchi_verifications
      WHERE request_id = p_parchi_request_id
      FOR UPDATE;

      IF NOT FOUND OR v_ver.user_id <> p_user_id THEN
        RAISE EXCEPTION 'Parchi: student verification not found. Please verify again.';
      END IF;
      IF v_ver.status <> 'approved' THEN
        RAISE EXCEPTION 'Parchi: student verification is not approved yet.';
      END IF;
      IF v_ver.event_id <> p_event_id THEN
        RAISE EXCEPTION 'Parchi: student verification was for a different event. Please verify again.';
      END IF;
      IF v_ver.booking_id IS NOT NULL THEN
        RAISE EXCEPTION 'Parchi: this student verification was already used. Please verify again.';
      END IF;
      IF v_ver.approved_at IS NULL OR v_ver.approved_at < v_now - INTERVAL '1 hour' THEN
        RAISE EXCEPTION 'Parchi: student verification has expired. Please verify again.';
      END IF;

      v_discount := LEAST(v_tier_parchi_discount, v_subtotal);
    ELSE
      -- Legacy: a requires_parchi coupon row (no toggle).
      SELECT * INTO v_claim
      FROM claim_parchi_discount(p_parchi_request_id, p_user_id, p_event_id, v_subtotal);
      v_coupon_id := v_claim.o_coupon_id;
      v_discount := v_claim.o_discount;
    END IF;

    IF abs(v_discount - COALESCE(p_discount_amount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Parchi: the student discount changed. Please review your order and try again.';
    END IF;
  ELSIF COALESCE(p_discount_amount, 0) <> 0 THEN
    -- Open Inside Karachi discount: logged-in shoppers who did not arrive
    -- from the Parchi app, on a parchi_enabled event.
    IF NOT COALESCE(p_allow_open_student_discount, false) THEN
      RAISE EXCEPTION 'Invalid discount without a Parchi verification';
    END IF;

    IF NOT v_parchi_enabled THEN
      RAISE EXCEPTION 'Student discount is not available for this event';
    END IF;

    v_discount := LEAST(v_tier_parchi_discount, v_subtotal);

    IF abs(v_discount - COALESCE(p_discount_amount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Student discount changed. Please review your order and try again.';
    END IF;
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
