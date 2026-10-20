-- Add optional ticket_url to ticket_types for external ticketing redirects.
-- When set, users buying passes are redirected to this external URL rather than
-- using Inside Karachi's native checkout flow.
ALTER TABLE public.ticket_types
  ADD COLUMN IF NOT EXISTS ticket_url text NULL;

COMMENT ON COLUMN public.ticket_types.ticket_url IS
  'Optional external URL for purchasing this pass. If set, redirects the buyer to the organizer or third-party ticketing provider instead of Inside checkout.';
