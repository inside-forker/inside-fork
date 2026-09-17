import "dotenv/config";
import { query } from "../lib/db";

async function main() {
  console.log("Purging all synthetic/backfilled location coordinates from mobile_events...");

  // Reset any event that was backfilled with synthetic coordinates
  // Real mobile app telemetry will send live events with device_id / live context through /api/mobile/v1/analytics-events
  const updateRes = await query(
    `UPDATE public.mobile_events
     SET latitude = NULL,
         longitude = NULL,
         neighborhood = NULL,
         accuracy = NULL
     WHERE city = 'Karachi' AND (device_id IS NULL OR source_context = 'mobile_app')`
  );
  console.log(`Reset ${updateRes.rowCount} events with backfilled coordinates.`);

  const statsRes = await query<{ total: string; with_coords: string }>(
    `SELECT
       COUNT(*)::text as total,
       COUNT(latitude)::text as with_coords
     FROM public.mobile_events`
  );
  console.log(`Current mobile_events: Total ${statsRes.rows[0]?.total}, Events with active GPS: ${statsRes.rows[0]?.with_coords}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  });
