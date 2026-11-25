-- INSID-281: Parchi-members-only events (the beach rave).
--
-- An event with status 'parchi_only' is left out of every Inside listing (they
-- all filter on status = 'published'). Its page opens only from the Parchi
-- app's link, and a booking needs an approved Parchi verification: the buyer
-- confirms their Parchi ID in the Parchi app at checkout.
--
-- The booking rule is a trigger on booking_items, so every booking RPC (web
-- create_booking_atomic, mobile create_booking_with_reservation) is covered
-- without redefining them. create_booking_atomic links the verification to the
-- booking before it inserts the items. The message starts with "Parchi:" so
-- the web route surfaces it.

-- 1. New status. Safe inside the runner's transaction (PG 12+): nothing below
--    uses it as an enum literal, the triggers compare status::text.
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'parchi_only';

-- 2. A Parchi-only event always has the Parchi switch on: create_booking_atomic
--    only checks a verification on parchi_enabled events. The event's Parchi %
--    still decides the discount (none when it's empty).
CREATE OR REPLACE FUNCTION public.parchi_only_forces_parchi()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text = 'parchi_only' THEN
    NEW.parchi_enabled := true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS events_parchi_only_forces_parchi ON public.events;
CREATE TRIGGER events_parchi_only_forces_parchi
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.parchi_only_forces_parchi();

UPDATE public.events SET parchi_enabled = true
WHERE status::text = 'parchi_only' AND parchi_enabled IS DISTINCT FROM true;

-- 3. A booking on a Parchi-only event needs an approved Parchi verification.
CREATE OR REPLACE FUNCTION public.enforce_parchi_only_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT e.status::text INTO v_status
  FROM bookings b JOIN events e ON e.id = b.event_id
  WHERE b.id = NEW.booking_id;

  IF v_status IS DISTINCT FROM 'parchi_only' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM parchi_verifications v WHERE v.booking_id = NEW.booking_id
  ) THEN
    RAISE EXCEPTION 'Parchi: this event is only for Parchi members. Verify your Parchi ID at checkout to book.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS booking_items_parchi_only_guard ON public.booking_items;
CREATE TRIGGER booking_items_parchi_only_guard
  AFTER INSERT ON public.booking_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_parchi_only_booking();
