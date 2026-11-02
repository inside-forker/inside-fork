-- Multi-City Platform Foundation Migration
-- 1. Create cities table
CREATE TABLE IF NOT EXISTS cities (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  short_code VARCHAR(10) NOT NULL,
  country_code VARCHAR(5) DEFAULT 'PK',
  currency VARCHAR(10) DEFAULT 'PKR',
  timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
  center_lat DECIMAL(10, 7) NOT NULL,
  center_lng DECIMAL(10, 7) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Karachi & Lahore
INSERT INTO cities (slug, name, short_code, country_code, currency, timezone, center_lat, center_lng, is_active)
VALUES 
  ('karachi', 'Karachi', 'KHI', 'PK', 'PKR', 'Asia/Karachi', 24.8607, 67.0011, true),
  ('lahore', 'Lahore', 'LHR', 'PK', 'PKR', 'Asia/Karachi', 31.5204, 74.3587, true),
  ('islamabad', 'Islamabad', 'ISB', 'PK', 'PKR', 'Asia/Karachi', 33.6844, 73.0479, false)
ON CONFLICT (slug) DO UPDATE 
SET 
  name = EXCLUDED.name,
  short_code = EXCLUDED.short_code,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  is_active = EXCLUDED.is_active;

-- 2. Enhanced Events: Ticketing Types & City
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_ticketing_type') THEN
    CREATE TYPE event_ticketing_type AS ENUM ('inside_native', 'partner_prism', 'external_social');
  END IF;
END $$;

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS ticketing_type event_ticketing_type DEFAULT 'inside_native',
  ADD COLUMN IF NOT EXISTS external_ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS external_social_url TEXT,
  ADD COLUMN IF NOT EXISTS gate_allocation_config JSONB;

-- Backfill events with Karachi
UPDATE events 
SET city_id = (SELECT id FROM cities WHERE slug = 'karachi') 
WHERE city_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_city_id ON events(city_id);

-- 3. Listings: Add city_id
ALTER TABLE listings 
  ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id);

-- Backfill listings with Karachi
UPDATE listings 
SET city_id = (SELECT id FROM cities WHERE slug = 'karachi') 
WHERE city_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_city_id ON listings(city_id);

-- 4. Deals & Discounts: Multi-city & voucher styling
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id),
  ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50),
  ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Backfill deals city_id from listings
UPDATE deals d 
SET city_id = l.city_id 
FROM listings l 
WHERE d.listing_id = l.id AND d.city_id IS NULL;

-- Fallback to Karachi if any deal is still null
UPDATE deals 
SET city_id = (SELECT id FROM cities WHERE slug = 'karachi') 
WHERE city_id IS NULL;

-- Generate badge_text from discount_value if not present
UPDATE deals
SET badge_text = discount_value
WHERE badge_text IS NULL AND discount_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_city_id ON deals(city_id);
CREATE INDEX IF NOT EXISTS idx_deals_active_featured ON deals(city_id, is_active, is_featured);

-- 5. Refresh Views with City and Ticketing metadata (columns appended at end to preserve pg view compatibility)
CREATE OR REPLACE VIEW events_with_details AS
 SELECT e.id AS event_id,
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
    e.total_gates,
    e.city_id,
    c.slug AS city_slug,
    c.name AS city_name,
    e.ticketing_type,
    e.external_ticket_url,
    e.external_social_url,
    e.gate_allocation_config
   FROM events e
     LEFT JOIN profiles p ON e.organizer_id = p.id
     LEFT JOIN cities c ON e.city_id = c.id;

CREATE OR REPLACE VIEW listings_with_details AS
 SELECT l.id,
    l.name,
    l.slug,
    l.description,
    l.address,
    l.latitude,
    l.longitude,
    l.place_id,
    l.phone_number,
    l.website,
    l.email,
    l.status,
    l.is_featured,
    l.owner_id,
    l.category_id,
    l.created_at,
    l.updated_at,
    l.show_member_badge,
    l.display_order,
    l.custom_attributes,
    l.menu_pdf_url,
    l.facebook_url,
    l.instagram_url,
    l.whatsapp_number,
    l.youtube_url,
    l.google_maps_url,
    l.parking_information,
    l.parking_amenities,
    cat.name AS category_name,
    COALESCE(avg(rev.rating) FILTER (WHERE (rev.status = 'approved'::text)), (0)::numeric) AS avg_rating,
    count(rev.id) FILTER (WHERE (rev.status = 'approved'::text)) AS review_count,
    (l.show_member_badge OR (EXISTS ( SELECT 1
           FROM subscriptions s
          WHERE ((s.listing_id = l.id) AND (s.status = 'active'::subscription_status) AND (s.end_date > now()))))) AS is_member,
    l.city_id,
    c.slug AS city_slug,
    c.name AS city_name
   FROM listings l
     LEFT JOIN categories cat ON l.category_id = cat.id
     LEFT JOIN reviews rev ON l.id = rev.listing_id
     LEFT JOIN cities c ON l.city_id = c.id
  GROUP BY l.id, l.name, l.slug, l.description, l.address, l.latitude, l.longitude, l.place_id, l.phone_number, l.website, l.email, l.status, l.is_featured, l.owner_id, l.category_id, l.created_at, l.updated_at, l.show_member_badge, l.custom_attributes, l.menu_pdf_url, l.facebook_url, l.instagram_url, l.whatsapp_number, l.youtube_url, l.google_maps_url, l.parking_information, l.parking_amenities, cat.name, l.display_order, l.city_id, c.slug, c.name;
