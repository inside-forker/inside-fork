-- Group tickets with a range ("2-3 members per team").
--
-- ticket_types.people_per_ticket stays the MAX people one ticket admits;
-- min_people_per_ticket is how many of them are required at checkout. The
-- rest are optional: a pass is issued only for each person actually entered.
-- NULL = fixed size (min = max), so existing group tickets keep their meaning.
-- Requires 20261021_group_tickets_attendee_fields.sql.

ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS min_people_per_ticket integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_types_min_people_per_ticket_check'
  ) THEN
    ALTER TABLE public.ticket_types
      ADD CONSTRAINT ticket_types_min_people_per_ticket_check
      CHECK (
        min_people_per_ticket IS NULL
        OR (min_people_per_ticket >= 1 AND min_people_per_ticket <= people_per_ticket)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.ticket_types.min_people_per_ticket IS
  'People required per ticket (NULL = people_per_ticket, i.e. fixed size). People above this up to people_per_ticket are optional; passes are issued only for those entered.';
