-- Update Prismfest '26 ticket tiers and pricing to match Ticketwala
-- 1. Prism Fam (General) -> Rs 2,999 (Limited time)
-- 2. Prism Her (Girls only) -> Rs 4,800
-- 3. Prism Front (Premium) -> Rs 5,999 (Complimentary Led Bands Included) (Restocked Limited time)
-- 4. Prism Exclusive (Elevated stands) -> Rs 9,999 (Complimentary Led Bands Included) (Limited time)
-- 5. Prism Core -> Rs 99,999 (Complimentary Led Bands Included)

UPDATE ticket_types
SET price = 2999.00,
    description = '(Limited time)'
WHERE event_id = (SELECT id FROM events WHERE lower(slug) = 'prismfest-26' LIMIT 1)
  AND (name ILIKE '%prism fam%' OR id = 101);

UPDATE ticket_types
SET price = 4800.00,
    description = 'Girls only'
WHERE event_id = (SELECT id FROM events WHERE lower(slug) = 'prismfest-26' LIMIT 1)
  AND (name ILIKE '%prism her%' OR id = 108);

UPDATE ticket_types
SET price = 5999.00,
    description = '(Complimentary Led Bands Included) (Restocked Limited time)'
WHERE event_id = (SELECT id FROM events WHERE lower(slug) = 'prismfest-26' LIMIT 1)
  AND (name ILIKE '%prism front%' OR id = 102);

UPDATE ticket_types
SET price = 9999.00,
    description = '(Complimentary Led Bands Included) (Limited time)'
WHERE event_id = (SELECT id FROM events WHERE lower(slug) = 'prismfest-26' LIMIT 1)
  AND (name ILIKE '%prism exclusive%' OR id = 103);

-- Insert Prism Core if not exists
INSERT INTO ticket_types (
  event_id,
  name,
  description,
  price,
  quantity_available,
  sale_starts_at,
  sale_ends_at,
  max_per_person,
  people_per_ticket,
  attendee_fields
)
SELECT
  e.id,
  'Prism Core',
  '(Complimentary Led Bands Included)',
  99999.00,
  10,
  '2026-09-20 13:00:00+00',
  '2026-10-25 02:00:00+00',
  10,
  1,
  '[]'::jsonb
FROM events e
WHERE lower(e.slug) = 'prismfest-26'
  AND NOT EXISTS (
    SELECT 1 FROM ticket_types tt
    WHERE tt.event_id = e.id AND tt.name ILIKE '%prism core%'
  );
