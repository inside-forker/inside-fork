-- INSID-245: invite-only events.
--
-- An event with status 'invite_only' is left out of every public listing
-- (they all filter on status = 'published'). Guests get a personal link with a
-- one-time code (event_invites). The first logged-in account to accept the
-- code owns it; only that account can book, one ticket per invite.
--
-- Booking rules are enforced by triggers on bookings / booking_items, so every
-- booking RPC (web create_booking_atomic, mobile create_booking_with_reservation)
-- is covered without redefining them. Messages start with "Invite:" so the
-- web route can surface them.

-- 1. New status. Safe inside the runner's transaction (PG 12+): nothing below
--    uses it as an enum literal, the triggers compare status::text.
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'invite_only';

-- 2. Invite codes.
CREATE TABLE IF NOT EXISTS public.event_invites (
  id          bigserial PRIMARY KEY,
  event_id    bigint NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  label       text,
  claimed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_invites_event_idx ON public.event_invites (event_id);

-- One invite per account per event, so one person can't burn several codes.
CREATE UNIQUE INDEX IF NOT EXISTS event_invites_event_claimer_uidx
  ON public.event_invites (event_id, claimed_by)
  WHERE claimed_by IS NOT NULL;

-- 3. A booking on an invite-only event needs this user's claimed invite and no
--    other live booking (paid, or awaiting payment inside its window).
CREATE OR REPLACE FUNCTION public.enforce_invite_only_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT status::text INTO v_status FROM events WHERE id = NEW.event_id;
  IF v_status IS DISTINCT FROM 'invite_only' THEN
    RETURN NEW;
  END IF;

  -- Row lock serialises concurrent checkouts by the same guest.
  PERFORM 1 FROM event_invites
  WHERE event_id = NEW.event_id AND claimed_by = NEW.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite: this event is invite only. Open your invite link to get access.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.event_id = NEW.event_id
      AND b.user_id = NEW.user_id
      AND (
        b.payment_status = 'paid'
        OR (b.payment_status = 'awaiting_payment'
            AND (b.expires_at IS NULL OR b.expires_at > now()))
      )
  ) THEN
    RAISE EXCEPTION 'Invite: your invite already has a ticket booked. Check My Tickets.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bookings_invite_only_guard ON public.bookings;
CREATE TRIGGER bookings_invite_only_guard
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only_booking();

-- 4. One ticket per invite.
CREATE OR REPLACE FUNCTION public.enforce_invite_only_quantity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_total  int;
BEGIN
  SELECT e.status::text INTO v_status
  FROM bookings b JOIN events e ON e.id = b.event_id
  WHERE b.id = NEW.booking_id;

  IF v_status IS DISTINCT FROM 'invite_only' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM booking_items WHERE booking_id = NEW.booking_id;

  IF v_total > 1 THEN
    RAISE EXCEPTION 'Invite: one ticket per invite.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS booking_items_invite_only_guard ON public.booking_items;
CREATE TRIGGER booking_items_invite_only_guard
  AFTER INSERT ON public.booking_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only_quantity();
