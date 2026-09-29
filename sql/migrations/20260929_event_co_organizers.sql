-- Migration: Event Co-Organizers Table
-- Allows multiple organizers to co-manage the same event with equal permissions and display them on the event page.

CREATE TABLE IF NOT EXISTS public.event_co_organizers (
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_event_co_organizers_organizer_id ON public.event_co_organizers(organizer_id);
CREATE INDEX IF NOT EXISTS idx_event_co_organizers_event_id ON public.event_co_organizers(event_id);
