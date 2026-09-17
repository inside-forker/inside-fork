import "dotenv/config";
import { query } from "../lib/db";
import { KARACHI_NEIGHBORHOODS } from "../lib/analytics/karachi-areas";

async function main() {
  console.log("Starting Karachi location telemetry backfill & seed...");

  // 1. Fetch some real user IDs and listing IDs
  const profilesRes = await query<{ id: string; username: string }>(
    "SELECT id, username FROM public.profiles LIMIT 25"
  );
  const userIds = profilesRes.rows.map((p) => p.id);

  const listingsRes = await query<{ id: number; name: string }>(
    "SELECT id, name FROM public.listings LIMIT 40"
  );
  const listings = listingsRes.rows;

  const dealsRes = await query<{ id: number; title: string; listing_id: number }>(
    "SELECT id, title, listing_id FROM public.deals LIMIT 25"
  );
  const deals = dealsRes.rows;

  // 2. Backfill existing mobile_events that have NULL latitude
  const nullEventsRes = await query<{ id: string }>(
    "SELECT id FROM public.mobile_events WHERE latitude IS NULL LIMIT 2000"
  );
  console.log(`Found ${nullEventsRes.rows.length} existing events without location coordinates.`);

  for (const row of nullEventsRes.rows) {
    // Pick random neighborhood with weighted bias toward Gulshan, Johar, DHA, Clifton
    const rand = Math.random();
    let n = KARACHI_NEIGHBORHOODS[0]; // Gulshan
    if (rand < 0.35) n = KARACHI_NEIGHBORHOODS[0]; // Gulshan-e-Iqbal
    else if (rand < 0.6) n = KARACHI_NEIGHBORHOODS[1]; // Johar
    else if (rand < 0.75) n = KARACHI_NEIGHBORHOODS[2]; // Clifton
    else if (rand < 0.88) n = KARACHI_NEIGHBORHOODS[3]; // DHA
    else if (rand < 0.94) n = KARACHI_NEIGHBORHOODS[4]; // PECHS
    else n = KARACHI_NEIGHBORHOODS[5]; // North Nazimabad

    // Jitter coordinates within neighborhood radius (~0.015 deg ≈ 1.5km)
    const jitterLat = (Math.random() - 0.5) * 0.025;
    const jitterLng = (Math.random() - 0.5) * 0.025;
    const lat = n.center.lat + jitterLat;
    const lng = n.center.lng + jitterLng;

    await query(
      `UPDATE public.mobile_events
       SET latitude = $1, longitude = $2, neighborhood = $3, city = 'Karachi'
       WHERE id = $4`,
      [lat, lng, n.name, row.id]
    );
  }
  console.log(`Updated existing events with Karachi location coordinates.`);

  // 3. Seed 250 realistic new location events (searches, screen views, deal views, listing visits)
  const sampleSearchesByArea: Record<string, string[]> = {
    "Gulshan-e-Iqbal": [
      "Biryani", "Student Biryani", "Late night chai", "Gyms near Disco Bakery",
      "Pizza Max", "Burgers", "Juice bar", "Sajji", "Al-Habib", "Shawarma"
    ],
    "Gulistan-e-Johar": [
      "Chai Dhaba", "Mandi House", "Soul Bistro", "DUHS Cafeteria",
      "Pizza Max Safoora", "Late night paratha", "Shahwar Cafe", "Continental Bakery"
    ],
    "Clifton": [
      "Boat Basin Breakfast", "Sea View Cafe", "Steakhouse", "Fine Dining",
      "Do Talwar Nihari", "Ocean Mall Food Court", "Italian Restaurant", "Sushi"
    ],
    "DHA (Defence)": [
      "Artisan Coffee", "Specialty Roasters Bukhari", "Boutique Gym", "Zamzama Cafe",
      "Shahbaz Commercial Burgers", "Matcha Latte", "Organic Market", "Korean BBQ"
    ],
    "PECHS & Bahadurabad": [
      "Tariq Road Chaat", "Bahadurabad Falooda", "Zameer Ansari BBQ",
      "Kurta Shops", "Char Minar Chowrangi", "Street Food PECHS"
    ],
    "North Nazimabad": [
      "Hyderi Supermarket", "Sakhi Hassan Kebab", "Five Star Biryani",
      "KDA Chowrangi Ice Cream", "Family Restaurant"
    ],
    "Saddar & Downtown": [
      "Burns Road Food Street", "Waheed Kabab", "Fresco Sweets",
      "Empress Market Spices", "Student Center Cafe"
    ],
  };

  const platforms = ["ios", "android"];
  const screens = [
    "/", "/explore", "/search", "/listings", "/deals", "/events", "/category/food-drink"
  ];

  const now = Date.now();

  for (let i = 0; i < 300; i++) {
    const timeOffsetMs = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // within last 7 days
    const occurredAt = new Date(now - timeOffsetMs);

    // Pick neighborhood
    const rand = Math.random();
    let n = KARACHI_NEIGHBORHOODS[0];
    if (rand < 0.32) n = KARACHI_NEIGHBORHOODS[0]; // Gulshan
    else if (rand < 0.58) n = KARACHI_NEIGHBORHOODS[1]; // Johar
    else if (rand < 0.76) n = KARACHI_NEIGHBORHOODS[2]; // Clifton
    else if (rand < 0.88) n = KARACHI_NEIGHBORHOODS[3]; // DHA
    else if (rand < 0.94) n = KARACHI_NEIGHBORHOODS[4]; // PECHS
    else n = KARACHI_NEIGHBORHOODS[5]; // North Nazimabad

    const jitterLat = (Math.random() - 0.5) * 0.022;
    const jitterLng = (Math.random() - 0.5) * 0.022;
    const lat = n.center.lat + jitterLat;
    const lng = n.center.lng + jitterLng;

    const isSigned = Math.random() > 0.4 && userIds.length > 0;
    const userId = isSigned ? userIds[Math.floor(Math.random() * userIds.length)] : null;
    const anonId = isSigned ? null : `anon_${Math.random().toString(36).substring(2, 10)}`;
    const sessionId = `sess_${Math.random().toString(36).substring(2, 12)}`;
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const screen = screens[Math.floor(Math.random() * screens.length)];

    // Event type
    const eventTypeRoll = Math.random();
    let eventName = "screen_viewed";
    const context: Record<string, unknown> = {
      dwell_seconds: Math.floor(Math.random() * 90) + 15,
    };

    if (eventTypeRoll < 0.4) {
      eventName = "search_performed";
      const areaSearches = sampleSearchesByArea[n.name] || ["Karachi Food", "Deals", "Late Night"];
      const queryText = areaSearches[Math.floor(Math.random() * areaSearches.length)];
      context.query = queryText;
      context.hasResults = Math.random() > 0.15;
      context.resultCount = context.hasResults ? Math.floor(Math.random() * 18) + 1 : 0;
    } else if (eventTypeRoll < 0.7 && listings.length > 0) {
      eventName = "screen_viewed";
      const listing = listings[Math.floor(Math.random() * listings.length)];
      context.listing_id = listing.id;
      context.listing_name = listing.name;
    } else if (eventTypeRoll < 0.85 && deals.length > 0) {
      const deal = deals[Math.floor(Math.random() * deals.length)];
      eventName = Math.random() > 0.4 ? "offer_viewed" : "offer_redeemed";
      context.deal_id = deal.id;
      context.offer_id = deal.id;
      context.offer_title = deal.title;
    } else {
      eventName = "screen_engaged";
    }

    await query(
      `INSERT INTO public.mobile_events
         (event_name, occurred_at, user_id, anon_id, session_id, source_context, screen, platform, app_version, os_version, context, latitude, longitude, accuracy, neighborhood, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        eventName,
        occurredAt,
        userId,
        anonId,
        sessionId,
        "mobile_app",
        screen,
        platform,
        "1.0.0",
        platform === "ios" ? "iOS 18.2" : "Android 15",
        JSON.stringify(context),
        lat,
        lng,
        12.5,
        n.name,
        "Karachi",
      ]
    );
  }

  console.log("✔ Successfully seeded location telemetry events!");
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
