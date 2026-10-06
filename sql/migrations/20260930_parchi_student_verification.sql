-- Parchi student discount at event checkout (web + mobile).
--
-- Flow: the shopper enters their Parchi ID, our backend opens a verification
-- request with Parchi (lib/parchi), the student approves it in the Parchi app,
-- and the approved request unlocks a discount on exactly one booking.
--
-- 1. coupons.requires_parchi - the discount itself is an ordinary coupon row
--    (same %/fixed/cap/event/window/usage rules) flagged as Parchi-only. Such
--    a row can NEVER be redeemed by typing its code; only via an approved
--    Parchi verification. Content is entered via SQL, like other coupons:
--
--      INSERT INTO coupons (code, requires_parchi, discount_type, discount_value,
--                           max_discount_amount, per_user_limit)
--      VALUES ('PARCHI-STUDENT', true, 'percentage', 20, 1000, 1);
--
--    event_id NULL = every event; an event-specific Parchi row wins over the
--    global one.
--
-- 2. parchi_verifications - one row per Parchi request (PK = Parchi's
--    requestId). Status is only ever written from Parchi's own responses.
--    booking_id is set when a booking consumes the approval; UNIQUE so one
--    approval = one booking.
--
-- 3. claim_parchi_discount - shared helper both booking RPCs call inside their
--    own transaction. Row-locks the verification (so two concurrent checkouts
--    can't both consume it) and the Parchi coupon (usage_limit), and returns
--    the discount.
--
-- 4. create_booking_with_reservation (mobile) and create_booking_atomic (web)
--    each gain an optional p_parchi_request_id (plus p_discount_amount on web,
--    whose total is computed in the API layer). Both new params default to
--    NULL/0, so existing named-arg callers keep working: this migration is
--    safe to apply BEFORE the route changes deploy.
--
-- A Parchi discount and a normal coupon can't be combined (bookings has one
-- coupon_id); passing both raises.

-- ============================================================
-- 1. coupons.requires_parchi
-- ============================================================
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS requires_parchi boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. parchi_verifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parchi_verifications (
  request_id          uuid PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id            bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  parchi_id           text NOT NULL,
  -- Our own opaque reference sent to Parchi (idempotency + "Resend").
  external_reference  text NOT NULL,
  status              text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  -- Only meaningful while pending; Parchi nulls it afterwards.
  match_code          text NULL,
  verify_web_link     text NOT NULL,
  expires_at          timestamptz NOT NULL,
  approved_at         timestamptz NULL,
  booking_id          bigint NULL UNIQUE REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parchi_verifications_user_event_idx
  ON public.parchi_verifications (user_id, event_id, created_at DESC);

COMMENT ON TABLE public.parchi_verifications IS
  'Parchi student-verification requests (lib/parchi). Status mirrors Parchi responses only; booking_id marks the single booking that consumed an approval.';

-- ============================================================
-- 3. claim_parchi_discount
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_parchi_discount(
  p_request_id uuid,
  p_user_id uuid,
  p_event_id bigint,
  p_subtotal numeric,
  OUT o_coupon_id bigint,
  OUT o_discount numeric
)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ver record;
  v_coupon record;
  v_now timestamptz := now();
  v_user_coupon_count int;
BEGIN
  -- Every failure is prefixed "Parchi:" so both routes can map it to a
  -- shopper-facing 400 with the text after the prefix.
  SELECT * INTO v_ver
  FROM parchi_verifications
  WHERE request_id = p_request_id
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

  -- Parchi approvals never expire on their side; bound how long one can sit
  -- unused so an old approval can't be replayed days later.
  IF v_ver.approved_at IS NULL OR v_ver.approved_at < v_now - INTERVAL '1 hour' THEN
    RAISE EXCEPTION 'Parchi: student verification has expired. Please verify again.';
  END IF;

  SELECT * INTO v_coupon
  FROM coupons
  WHERE requires_parchi = true
    AND is_active = true
    AND (event_id IS NULL OR event_id = p_event_id)
    AND (starts_at IS NULL OR starts_at <= v_now)
    AND (ends_at IS NULL OR ends_at >= v_now)
  ORDER BY event_id NULLS LAST, id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parchi: the student discount is not available for this event.';
  END IF;

  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
    RAISE EXCEPTION 'Parchi: the student discount has been fully claimed.';
  END IF;

  SELECT COUNT(*) INTO v_user_coupon_count
  FROM bookings
  WHERE user_id = p_user_id
    AND coupon_id = v_coupon.id
    AND payment_status IN ('awaiting_payment', 'paid');

  IF v_user_coupon_count >= v_coupon.per_user_limit THEN
    RAISE EXCEPTION 'Parchi: you have already used the student discount.';
  END IF;

  -- Same math as the coupon branch of create_booking_with_reservation.
  IF v_coupon.discount_type = 'percentage' THEN
    o_discount := round(p_subtotal * (v_coupon.discount_value / 100.0), 2);
    IF v_coupon.max_discount_amount IS NOT NULL THEN
      o_discount := LEAST(o_discount, v_coupon.max_discount_amount);
    END IF;
  ELSE
    o_discount := v_coupon.discount_value;
  END IF;
  o_discount := LEAST(o_discount, p_subtotal);
  o_coupon_id := v_coupon.id;

  UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
END;
$function$;

-- ============================================================
-- 4a. create_booking_with_reservation (mobile) - adds p_parchi_request_id.
-- Body identical to 20260903_checkout_coupon_support.sql except where marked
-- "PARCHI".
-- ============================================================
DROP FUNCTION IF EXISTS public.create_booking_with_reservation(uuid, jsonb, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_booking_with_reservation(
  p_user_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_cnic_hash text,
  p_cnic_last4 text,
  p_basket_id text DEFAULT NULL::text,
  p_coupon_code text DEFAULT NULL::text,
  p_parchi_request_id uuid DEFAULT NULL::uuid
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
  v_claim record;
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

  -- PARCHI: one discount per booking.
  IF p_coupon_code IS NOT NULL AND p_parchi_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid coupon: a coupon cannot be combined with the Parchi student discount';
  END IF;

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

    IF v_booking_id IS NOT NULL THEN
      RAISE NOTICE 'Returning existing booking % for basket %', v_booking_id, p_basket_id;
      RETURN v_booking_id;
    END IF;
  END IF;

  -- ==========================================
  -- VALIDATION: Check all tickets and calculate total
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', (v_item->>'ticket_type_id');
    END IF;

    IF v_event_id IS NULL THEN
      v_event_id := v_ticket.event_id;
    ELSIF v_event_id <> v_ticket.event_id THEN
      RAISE EXCEPTION 'Mixed event ticket types not allowed';
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

    v_total := v_total + (v_ticket.price * v_quantity);
  END LOOP;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine event_id';
  END IF;

  -- ==========================================
  -- COUPON
  -- ==========================================
  IF p_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon
    FROM coupons
    WHERE code = p_coupon_code
      AND is_active = true
      AND requires_parchi = false -- PARCHI: Parchi-only rows can't be typed in
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

    v_discount := LEAST(v_discount, v_total);
    v_coupon_id := v_coupon.id;
    v_total := v_total - v_discount;

    UPDATE coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- PARCHI: approved student verification -> Parchi-only coupon.
  IF p_parchi_request_id IS NOT NULL THEN
    SELECT * INTO v_claim
    FROM claim_parchi_discount(p_parchi_request_id, p_user_id, v_event_id, v_total);
    v_coupon_id := v_claim.o_coupon_id;
    v_discount := v_claim.o_discount;
    v_total := v_total - v_discount;
  END IF;

  -- ==========================================
  -- CREATE BOOKING
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

  IF v_booking_id IS NULL AND p_basket_id IS NOT NULL THEN
    -- PARCHI: a concurrent call won. RAISE rather than RETURN so this
    -- transaction's Parchi claim rolls back instead of being consumed
    -- without a booking.
    IF p_parchi_request_id IS NOT NULL THEN
      RAISE EXCEPTION 'Booking already in progress for this basket';
    END IF;

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

  -- PARCHI: consume the approval.
  IF p_parchi_request_id IS NOT NULL THEN
    UPDATE parchi_verifications
    SET booking_id = v_booking_id, updated_at = v_now
    WHERE request_id = p_parchi_request_id;
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

-- ============================================================
-- 4b. create_booking_atomic (web) - adds p_parchi_request_id and
-- p_discount_amount. The web route computes the fee-inclusive total in the
-- API layer, so it previews the Parchi discount there and passes it in; this
-- function re-derives it authoritatively (from locked ticket prices) and
-- rejects the call if the two disagree. Body identical to
-- 20260901_atomic_booking_add_validation.sql except where marked "PARCHI".
-- ============================================================
DROP FUNCTION IF EXISTS public.create_booking_atomic(uuid, bigint, numeric, text, text, text, timestamp with time zone, text, text, text, text, text, jsonb);

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
  p_discount_amount numeric DEFAULT 0
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

    -- PARCHI: subtotal from locked DB prices, not the caller's.
    v_subtotal := v_subtotal + (v_ticket.price * v_quantity);
  END LOOP;

  -- PARCHI: claim and cross-check against the API layer's preview.
  IF p_parchi_request_id IS NOT NULL THEN
    SELECT * INTO v_claim
    FROM claim_parchi_discount(p_parchi_request_id, p_user_id, p_event_id, v_subtotal);
    v_coupon_id := v_claim.o_coupon_id;
    v_discount := v_claim.o_discount;

    IF abs(v_discount - COALESCE(p_discount_amount, 0)) > 0.01 THEN
      RAISE EXCEPTION 'Parchi: the student discount changed. Please review your order and try again.';
    END IF;
  ELSIF COALESCE(p_discount_amount, 0) <> 0 THEN
    RAISE EXCEPTION 'Invalid discount without a Parchi verification';
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
    -- PARCHI: don't let a claimed discount commit without its booking.
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

  -- PARCHI: consume the approval.
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

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'create_booking_atomic failed: %', SQLERRM;
END;
$function$;
