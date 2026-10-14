-- Ensure Prismfest student coupon is active and PDF-backed tiers reflect
-- unassigned Ticketwala PDF counts (fixes false Sold Out on the event page).

UPDATE coupons
SET is_active = true,
    usage_limit = CASE
      WHEN usage_limit IS NOT NULL AND usage_count >= usage_limit
      THEN usage_count + 1000
      ELSE usage_limit
    END,
    ends_at = CASE
      WHEN ends_at IS NOT NULL AND ends_at < NOW()
      THEN NOW() + interval '90 days'
      ELSE ends_at
    END
WHERE requires_parchi = true;

UPDATE ticket_types tt
SET quantity_available = sub.available
FROM (
  SELECT i.ticket_type_id,
         COUNT(*) FILTER (WHERE i.booking_id IS NULL)::int AS available
  FROM ticket_pdf_inventory i
  GROUP BY i.ticket_type_id
) sub,
events e
WHERE tt.id = sub.ticket_type_id
  AND e.id = tt.event_id
  AND lower(e.slug) = 'prismfest-26';
