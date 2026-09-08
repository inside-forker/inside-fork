-- New notification category for "you've reached a new rank" events, fired
-- from checkAndProcessRankUp() in lib/gamification.ts. Previously no
-- server-side rank-up notification existed at all (only a client-side toast
-- tied to one specific award endpoint) -- this seeds the category that
-- notification now targets.

INSERT INTO public.notification_categories
  (slug, label, audience_roles, is_mandatory, default_channel_config)
VALUES
  (
    'public_rank_up',
    'Rank up',
    ARRAY['public_user']::public.user_role[],
    false,
    '{"bell": true, "email": false, "push": true}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
