-- Prismfest was stored as overnight UTC (showed as ~2–9 AM PKT / mismatched
-- SSR vs browser). Correct wall clock: 5:00 PM – 10:00 PM Asia/Karachi on
-- Sat 24 Oct 2026. Does not touch tickets, coupons, or booking flows.

UPDATE events
SET start_time = TIMESTAMPTZ '2026-10-24 17:00:00+05',
    end_time   = TIMESTAMPTZ '2026-10-24 22:00:00+05'
WHERE lower(slug) = 'prismfest-26';
