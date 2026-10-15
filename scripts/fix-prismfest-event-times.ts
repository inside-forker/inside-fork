/**
 * Set Prismfest'26 to 5:00 PM – 10:00 PM Asia/Karachi (Sat 24 Oct 2026).
 *
 *   npx tsx scripts/fix-prismfest-event-times.ts
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
    ssl: { rejectUnauthorized: false },
  });

  try {
    const before = await pool.query(
      `SELECT id, slug, start_time, end_time,
              start_time AT TIME ZONE 'Asia/Karachi' AS start_pkt,
              end_time AT TIME ZONE 'Asia/Karachi' AS end_pkt
       FROM events WHERE lower(slug) = 'prismfest-26'`,
    );
    console.log("before:", before.rows);

    const updated = await pool.query(
      `UPDATE events
       SET start_time = TIMESTAMPTZ '2026-10-24 17:00:00+05',
           end_time   = TIMESTAMPTZ '2026-10-24 22:00:00+05'
       WHERE lower(slug) = 'prismfest-26'
       RETURNING id, slug, start_time, end_time,
                 start_time AT TIME ZONE 'Asia/Karachi' AS start_pkt,
                 end_time AT TIME ZONE 'Asia/Karachi' AS end_pkt`,
    );
    console.log("after:", updated.rows);
    if (updated.rowCount === 0) {
      console.error("No event matched slug prismfest-26");
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
