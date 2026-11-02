/**
 * Multi-City Foundation Migration Script
 * Runs each DDL step independently (no single transaction) to avoid deadlocks
 * from concurrent app connections reading listings_with_details / events_with_details.
 *
 * Run: npx tsx scripts/multi-city-migration.ts
 */

import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!.split("?")[0];
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
});

async function step(name: string, sql: string) {
  console.log(`\n▶  ${name}...`);
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log(`   ✔ Done`);
  } catch (err: unknown) {
    const pg = err as { code?: string; message?: string };
    // 42701 = column already exists  42P07 = relation already exists  42710 = object already exists
    if (["42701", "42P07", "42710"].includes(pg.code ?? "")) {
      console.log(`   ⚠  Skipped (already exists)`);
    } else {
      console.error(`   ✖ FAILED: ${pg.message}`);
      throw err;
    }
  } finally {
    client.release();
  }
}

async function main() {
  console.log("=== Multi-City Foundation Migration ===\n");

  // ─── 1. CITIES TABLE ────────────────────────────────────────────────────────
  await step(
    "Create cities table",
    `CREATE TABLE IF NOT EXISTS cities (
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
    );`
  );

  await step(
    "Seed Karachi, Lahore, Islamabad",
    `INSERT INTO cities (slug, name, short_code, country_code, currency, timezone, center_lat, center_lng, is_active)
    VALUES 
      ('karachi',   'Karachi',   'KHI', 'PK', 'PKR', 'Asia/Karachi', 24.8607, 67.0011, true),
      ('lahore',    'Lahore',    'LHR', 'PK', 'PKR', 'Asia/Karachi', 31.5204, 74.3587, true),
      ('islamabad', 'Islamabad', 'ISB', 'PK', 'PKR', 'Asia/Karachi', 33.6844, 73.0479, false)
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name, short_code = EXCLUDED.short_code,
        center_lat = EXCLUDED.center_lat, center_lng = EXCLUDED.center_lng,
        is_active = EXCLUDED.is_active;`
  );

  // ─── 2. EVENTS: ticketing type enum + new columns ───────────────────────────
  await step(
    "Create event_ticketing_type enum",
    `DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_ticketing_type') THEN
        CREATE TYPE event_ticketing_type AS ENUM ('inside_native', 'partner_prism', 'external_social');
      END IF;
    END $$;`
  );

  for (const [col, def] of [
    ["city_id",               "BIGINT REFERENCES cities(id)"],
    ["ticketing_type",        "event_ticketing_type DEFAULT 'inside_native'"],
    ["external_ticket_url",   "TEXT"],
    ["external_social_url",   "TEXT"],
    ["gate_allocation_config","JSONB"],
  ] as const) {
    await step(
      `events.${col}`,
      `ALTER TABLE events ADD COLUMN IF NOT EXISTS ${col} ${def};`
    );
  }

  await step(
    "Backfill events city_id → Karachi",
    `UPDATE events
     SET city_id = (SELECT id FROM cities WHERE slug = 'karachi')
     WHERE city_id IS NULL;`
  );

  await step(
    "Index idx_events_city_id",
    `CREATE INDEX IF NOT EXISTS idx_events_city_id ON events(city_id);`
  );

  // ─── 3. LISTINGS: city_id ───────────────────────────────────────────────────
  await step(
    "listings.city_id",
    `ALTER TABLE listings ADD COLUMN IF NOT EXISTS city_id BIGINT REFERENCES cities(id);`
  );

  await step(
    "Backfill listings city_id → Karachi",
    `UPDATE listings
     SET city_id = (SELECT id FROM cities WHERE slug = 'karachi')
     WHERE city_id IS NULL;`
  );

  await step(
    "Index idx_listings_city_id",
    `CREATE INDEX IF NOT EXISTS idx_listings_city_id ON listings(city_id);`
  );

  // ─── 4. DEALS: multi-city + voucher display columns ────────────────────────
  for (const [col, def] of [
    ["city_id",     "BIGINT REFERENCES cities(id)"],
    ["badge_text",  "VARCHAR(50)"],
    ["promo_code",  "VARCHAR(50)"],
    ["is_featured", "BOOLEAN DEFAULT false"],
  ] as const) {
    await step(
      `deals.${col}`,
      `ALTER TABLE deals ADD COLUMN IF NOT EXISTS ${col} ${def};`
    );
  }

  await step(
    "Backfill deals city_id from listing's city",
    `UPDATE deals d
     SET city_id = l.city_id
     FROM listings l
     WHERE d.listing_id = l.id AND d.city_id IS NULL;`
  );

  await step(
    "Backfill remaining deals city_id → Karachi",
    `UPDATE deals
     SET city_id = (SELECT id FROM cities WHERE slug = 'karachi')
     WHERE city_id IS NULL;`
  );

  await step(
    "Backfill deals.badge_text from discount_value",
    `UPDATE deals
     SET badge_text = LEFT(discount_value, 50)
     WHERE badge_text IS NULL AND discount_value IS NOT NULL;`
  );

  await step(
    "Index idx_deals_city_id",
    `CREATE INDEX IF NOT EXISTS idx_deals_city_id ON deals(city_id);`
  );

  await step(
    "Index idx_deals_active_featured",
    `CREATE INDEX IF NOT EXISTS idx_deals_active_featured ON deals(city_id, is_active, is_featured);`
  );

  // ─── 5. REFRESH VIEWS (safe: appends new columns at end) ────────────────────
  await step(
    "Refresh events_with_details view",
    `CREATE OR REPLACE VIEW events_with_details AS
     SELECT
       e.id                    AS event_id,
       e.name                  AS event_name,
       e.slug                  AS event_slug,
       e.description           AS event_description,
       e.start_time,
       e.end_time,
       e.status                AS event_status,
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
       p.full_name             AS organizer_name,
       p.avatar_url            AS organizer_avatar,
       e.location_name,
       e.address,
       e.latitude,
       e.longitude,
       e.scanning_mode,
       e.total_gates,
       -- new multi-city & ticketing columns
       e.city_id,
       c.slug                  AS city_slug,
       c.name                  AS city_name,
       e.ticketing_type,
       e.external_ticket_url,
       e.external_social_url,
       e.gate_allocation_config
     FROM events e
       LEFT JOIN profiles p ON e.organizer_id = p.id
       LEFT JOIN cities  c ON e.city_id = c.id;`
  );

  await step(
    "Refresh listings_with_details view",
    `CREATE OR REPLACE VIEW listings_with_details AS
     SELECT
       l.id,
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
       COALESCE(
         AVG(rev.rating) FILTER (WHERE rev.status = 'approved'), 0
       )::numeric                               AS avg_rating,
       COUNT(rev.id) FILTER (WHERE rev.status = 'approved') AS review_count,
       (
         l.show_member_badge
         OR EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.listing_id = l.id
             AND s.status = 'active'::subscription_status
             AND s.end_date > NOW()
         )
       )                                        AS is_member,
       -- new multi-city columns
       l.city_id,
       c.slug  AS city_slug,
       c.name  AS city_name
     FROM listings l
       LEFT JOIN categories cat ON l.category_id = cat.id
       LEFT JOIN reviews     rev ON l.id = rev.listing_id
       LEFT JOIN cities      c   ON l.city_id = c.id
     GROUP BY
       l.id, l.name, l.slug, l.description, l.address,
       l.latitude, l.longitude, l.place_id, l.phone_number, l.website,
       l.email, l.status, l.is_featured, l.owner_id, l.category_id,
       l.created_at, l.updated_at, l.show_member_badge, l.custom_attributes,
       l.menu_pdf_url, l.facebook_url, l.instagram_url, l.whatsapp_number,
       l.youtube_url, l.google_maps_url, l.parking_information, l.parking_amenities,
       cat.name, l.display_order, l.city_id, c.slug, c.name;`
  );

  console.log("\n✅ Migration complete! cities, events, listings, deals all updated.\n");
  await pool.end();
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});

