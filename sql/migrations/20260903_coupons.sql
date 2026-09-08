-- Discount codes for event ticket checkout ("Apply Offer"). A coupon is
-- either scoped to one event (event_id set) or platform-wide (event_id
-- NULL). Validation and redemption happen inside
-- create_booking_with_reservation (see the companion migration extending
-- that function) under the same row lock the ticket-inventory checks already
-- use, so a coupon's usage_limit can't be over-redeemed by concurrent
-- checkouts any more than ticket inventory can be oversold.

CREATE TABLE IF NOT EXISTS public.coupons (
  id                   bigserial PRIMARY KEY,
  code                 text NOT NULL UNIQUE,
  event_id             bigint NULL REFERENCES public.events(id) ON DELETE CASCADE,
  discount_type        text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value       numeric(10,2) NOT NULL CHECK (discount_value > 0),
  -- Caps a percentage discount's absolute value; ignored for 'fixed'.
  max_discount_amount  numeric(10,2) NULL,
  usage_limit          integer NULL, -- NULL = unlimited
  usage_count          integer NOT NULL DEFAULT 0,
  per_user_limit       integer NOT NULL DEFAULT 1,
  starts_at            timestamptz NULL,
  ends_at              timestamptz NULL,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON public.coupons (code) WHERE is_active;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS coupon_id       bigint NULL REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON TABLE public.coupons IS
  'Discount codes for event checkout. Content is entered directly via SQL for now; no admin UI yet. Redeemed inside create_booking_with_reservation, not the API layer, so validation happens under the same row lock as ticket inventory.';
