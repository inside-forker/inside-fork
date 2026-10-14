/**
 * One-shot: ensure Prismfest Parchi coupon is active, and sync every PDF-backed
 * ticket_type.quantity_available to unassigned PDF count (fixes false Sold Out).
 *
 *   npx tsx scripts/fix-prismfest-pricing-stock.ts
 */
import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const cleanConnectionString = databaseUrl.split("?")[0];
  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("ssl=true")
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false },
  });

  try {
    const coupons = await pool.query(
      `SELECT id, code, is_active, usage_count, usage_limit, starts_at, ends_at,
              event_id, discount_type, discount_value, max_discount_amount
       FROM coupons
       WHERE requires_parchi = true
       ORDER BY id`,
    );
    console.log("requires_parchi coupons:", coupons.rows);

    if (coupons.rows.length === 0) {
      console.warn(
        "No requires_parchi coupon found — insert one before open discount works server-side.",
      );
    } else {
      const fix = await pool.query(
        `UPDATE coupons
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
         WHERE requires_parchi = true
         RETURNING id, code, is_active, usage_count, usage_limit, ends_at`,
      );
      console.log("coupon ensure-active:", fix.rows);
    }

    const synced = await pool.query(
      `UPDATE ticket_types tt
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
         AND lower(e.slug) = 'prismfest-26'
       RETURNING tt.id, tt.name, tt.quantity_available`,
    );
    console.log("synced PDF tiers:", synced.rows);

    const all = await pool.query(
      `SELECT tt.id, tt.name, tt.quantity_available,
              (SELECT COUNT(*)::int FROM ticket_pdf_inventory i WHERE i.ticket_type_id = tt.id) AS pdf_total,
              (SELECT COUNT(*)::int FROM ticket_pdf_inventory i WHERE i.ticket_type_id = tt.id AND i.booking_id IS NULL) AS pdf_free
       FROM ticket_types tt
       JOIN events e ON e.id = tt.event_id
       WHERE lower(e.slug) = 'prismfest-26'
       ORDER BY tt.price, tt.id`,
    );
    console.log("prismfest-26 tickets after fix:", all.rows);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
