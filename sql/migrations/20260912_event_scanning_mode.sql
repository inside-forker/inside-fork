-- Migration: Add scanning_mode and total_gates to events table

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS scanning_mode TEXT NOT NULL DEFAULT 'single',
ADD COLUMN IF NOT EXISTS total_gates SMALLINT NOT NULL DEFAULT 1;

-- Also update events_with_details view if it exists
CREATE OR REPLACE VIEW public.events_with_details AS
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    e.slug AS event_slug,
    e.description AS event_description,
    e.start_time,
    e.end_time,
    e.status AS event_status,
    e.created_at,
    e.updated_at,
    e.category_id,
    e.max_capacity,
    e.is_featured,
    e.featured_rank,
    e.is_commission_based,
    e.commission_rate,
    e.require_guest_details,
    e.organizer_id,
    p.full_name AS organizer_name,
    p.avatar_url AS organizer_avatar,
    e.location_name,
    e.address,
    e.latitude,
    e.longitude,
    e.scanning_mode,
    e.total_gates
FROM public.events e
LEFT JOIN public.profiles p ON e.organizer_id = p.id;
