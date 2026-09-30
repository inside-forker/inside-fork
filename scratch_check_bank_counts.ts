import { query } from "./lib/db";

async function checkBankPlacesVsDeals() {
  try {
    const { rows } = await query(`
      SELECT 
        b.name as bank_name,
        COUNT(d.id) as total_live_deals,
        COUNT(DISTINCT l.id) as distinct_places_with_deals
      FROM banks b
      LEFT JOIN deals d
        ON d.bank_id = b.id
       AND d.is_active = true
       AND d.listing_id IS NOT NULL
       AND (d.end_date IS NULL OR d.end_date::timestamptz >= NOW())
      LEFT JOIN listings l
        ON l.id = d.listing_id
       AND l.status = 'published'
      GROUP BY b.id, b.name
      ORDER BY distinct_places_with_deals DESC, b.name ASC
    `);

    console.log("Real DB numbers (Deals vs Distinct Places):");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkBankPlacesVsDeals();
