import "dotenv/config";
import { Pool } from "pg";

/**
 * Seeds a set of demo events so the Events surfaces (mobile Events tab, web
 * listing) have enough on the calendar to show their real structure — today,
 * this week, this weekend and further out — instead of the two rows the live
 * catalogue currently has.
 *
 *   npx tsx scripts/seed-demo-events.ts            # upsert the demo set
 *   npx tsx scripts/seed-demo-events.ts --remove   # delete it again
 *
 * Every row it writes is slugged `demo-…`, which is what `--remove` matches,
 * so the seed can never take a real event with it. Dates are computed from the
 * day the script runs (Asia/Karachi), so re-running refreshes the set forward
 * rather than leaving it stranded in the past; slugs are stable, so re-running
 * updates the same ten events instead of piling up copies.
 */

const SLUG_PREFIX = "demo-";

/** Karachi is UTC+5 year-round — no DST to account for. */
const KARACHI_OFFSET_HOURS = 5;

type TicketDef = {
  name: string;
  price: number;
  quantity: number;
  maxPerPerson: number;
  description?: string;
};

type DemoEvent = {
  slug: string;
  name: string;
  description: string;
  /** Days from today, or a pin to the coming weekend. */
  day: number | "sat" | "sun";
  startHour: number;
  startMinute?: number;
  durationHours: number;
  locationName: string;
  address: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  isFeatured?: boolean;
  /** Verified to resolve — a dead URL renders as a blank card, not a fallback. */
  imageUrl: string;
  tickets: TicketDef[];
};

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=1600&h=1200&fit=crop&auto=format&q=80`;

const DEMO_EVENTS: DemoEvent[] = [
  {
    slug: "demo-open-mic-night-t2f",
    name: "Open Mic Night at T2F",
    description:
      "Poetry, stand-up and acoustic sets from whoever signs up at the door. Doors at 7, sign-up sheet closes at 7:30.",
    day: 0,
    startHour: 19,
    durationHours: 3,
    locationName: "The Second Floor (T2F)",
    address: "10-C, Sunset Lane 5, Phase II Ext, DHA, Karachi",
    latitude: 24.8007,
    longitude: 67.0645,
    maxCapacity: 120,
    imageUrl: IMG("photo-1493225457124-a3eb161ffa5f"),
    tickets: [
      { name: "Entry", price: 500, quantity: 120, maxPerPerson: 4 },
      { name: "Performer Pass", price: 0, quantity: 20, maxPerPerson: 1, description: "Free entry for anyone on the sign-up sheet." },
    ],
  },
  {
    slug: "demo-rooftop-qawwali-do-darya",
    name: "Rooftop Qawwali Sessions",
    description:
      "A late-night qawwali set over the water, with chai and rooftop seating. Bring a jacket — the sea breeze picks up after eleven.",
    day: 0,
    startHour: 21,
    durationHours: 3,
    locationName: "Do Darya",
    address: "Do Darya, DHA Phase VIII, Karachi",
    latitude: 24.7803,
    longitude: 67.0419,
    maxCapacity: 300,
    imageUrl: IMG("photo-1514525253161-7a46d19cd819"),
    tickets: [
      { name: "General Seating", price: 1500, quantity: 240, maxPerPerson: 6 },
      { name: "Front Row Cushions", price: 3000, quantity: 40, maxPerPerson: 4 },
    ],
  },
  {
    slug: "demo-karachi-book-fair-preview",
    name: "Karachi Book Fair — Preview Evening",
    description:
      "First look at the fair before the weekend crowds, with publisher stalls open and three author readings on the hour.",
    day: 2,
    startHour: 18,
    startMinute: 30,
    durationHours: 4,
    locationName: "Karachi Expo Centre",
    address: "University Road, Gulshan-e-Iqbal, Karachi",
    latitude: 24.9111,
    longitude: 67.0895,
    maxCapacity: 800,
    imageUrl: IMG("photo-1524594152303-9fd13543fe6e"),
    tickets: [{ name: "Preview Entry", price: 300, quantity: 800, maxPerPerson: 8 }],
  },
  {
    slug: "demo-stand-up-karachi-showcase",
    name: "Stand-Up Karachi: Comedy Showcase",
    description:
      "Six comics, twelve minutes each, one headliner. Strictly no phones out during sets.",
    day: 3,
    startHour: 20,
    durationHours: 2,
    locationName: "The Comedy Club, DHA",
    address: "Khayaban-e-Shahbaz, DHA Phase VI, Karachi",
    latitude: 24.8073,
    longitude: 67.0621,
    maxCapacity: 150,
    imageUrl: IMG("photo-1516450360452-9312f5e86fc7"),
    tickets: [
      { name: "Standard", price: 1200, quantity: 130, maxPerPerson: 6 },
      { name: "Front Table (Group of 4)", price: 6000, quantity: 12, maxPerPerson: 2 },
    ],
  },
  {
    slug: "demo-seaview-sunset-yoga",
    name: "Seaview Sunset Yoga",
    description:
      "An hour of slow flow on the sand as the sun goes down. Mats provided; come barefoot.",
    day: "sat",
    startHour: 17,
    startMinute: 30,
    durationHours: 2,
    locationName: "Seaview, Clifton",
    address: "Beach Avenue, Clifton Block 2, Karachi",
    latitude: 24.7987,
    longitude: 67.0286,
    maxCapacity: 60,
    imageUrl: IMG("photo-1517457373958-b7bdd4587205"),
    tickets: [{ name: "Drop-in", price: 800, quantity: 60, maxPerPerson: 4 }],
  },
  {
    slug: "demo-indie-music-night-base-rock",
    name: "Indie Music Night",
    description:
      "Four Karachi bands, no covers, one long set each. Kitchen stays open till midnight.",
    day: "sun",
    startHour: 19,
    startMinute: 30,
    durationHours: 4,
    locationName: "Base Rock Cafe",
    address: "Khayaban-e-Bukhari, DHA Phase VI, Karachi",
    latitude: 24.8118,
    longitude: 67.0561,
    maxCapacity: 200,
    imageUrl: IMG("photo-1533174072545-7a4b6ad7a6c3"),
    tickets: [
      { name: "Early Bird", price: 1000, quantity: 80, maxPerPerson: 4 },
      { name: "Door Entry", price: 1500, quantity: 120, maxPerPerson: 6 },
    ],
  },
  {
    slug: "demo-vintage-car-meetup",
    name: "Karachi Vintage Car Meetup",
    description:
      "Sunday-morning meet for pre-1990 cars and the people who keep them running. Free to walk through; registration is for exhibitors.",
    day: 10,
    startHour: 10,
    durationHours: 4,
    locationName: "Beach Luxury Hotel",
    address: "M.T. Khan Road, Karachi",
    latitude: 24.8433,
    longitude: 67.0092,
    maxCapacity: 400,
    imageUrl: IMG("photo-1511578314322-379afb476865"),
    tickets: [
      { name: "Visitor Entry", price: 0, quantity: 350, maxPerPerson: 6 },
      { name: "Exhibitor Slot", price: 2500, quantity: 50, maxPerPerson: 1 },
    ],
  },
  {
    slug: "demo-coastal-food-truck-festival",
    name: "Coastal Food Truck Festival",
    description:
      "Twenty trucks along the promenade, from bun kababs to Korean corn dogs, with live music from eight.",
    day: 13,
    startHour: 17,
    durationHours: 6,
    locationName: "Dolmen Mall Clifton",
    address: "Marine Drive, Block 4, Clifton, Karachi",
    latitude: 24.8009,
    longitude: 67.0281,
    maxCapacity: 1500,
    imageUrl: IMG("photo-1555939594-58d7cb561ad1"),
    tickets: [
      { name: "Entry", price: 400, quantity: 1200, maxPerPerson: 8 },
      { name: "Tasting Pass (6 trucks)", price: 2200, quantity: 300, maxPerPerson: 4 },
    ],
  },
  {
    slug: "demo-startup-weekend-karachi",
    name: "Startup Weekend Karachi",
    description:
      "Fifty-four hours from pitch to demo day, with mentors from the local ecosystem. Teams form on Friday night.",
    day: 21,
    startHour: 10,
    durationHours: 10,
    locationName: "NIC Karachi",
    address: "NED University City Campus, Maulana Din Mohammad Wafai Road, Karachi",
    latitude: 24.8607,
    longitude: 67.0104,
    maxCapacity: 250,
    imageUrl: IMG("photo-1540575467063-178a50c2df87"),
    tickets: [
      { name: "Participant", price: 3500, quantity: 200, maxPerPerson: 2 },
      { name: "Student", price: 1500, quantity: 50, maxPerPerson: 1 },
    ],
  },
  {
    slug: "demo-sufi-night-frere-hall",
    name: "Sufi Night at Frere Hall",
    description:
      "An evening of Sufi music on the lawns, with food stalls from six and the main set at eight.",
    day: 34,
    startHour: 18,
    durationHours: 5,
    locationName: "Frere Hall",
    address: "Abdullah Haroon Road, Saddar, Karachi",
    latitude: 24.8478,
    longitude: 67.0311,
    maxCapacity: 2000,
    isFeatured: true,
    imageUrl: IMG("photo-1552664730-d307ca884978"),
    tickets: [
      { name: "Lawn Entry", price: 1000, quantity: 1600, maxPerPerson: 8 },
      { name: "Reserved Seating", price: 3500, quantity: 300, maxPerPerson: 4 },
      { name: "Patron Pass", price: 8000, quantity: 100, maxPerPerson: 2 },
    ],
  },
];

/** Today's calendar date *in Karachi*, regardless of where this runs. */
function karachiToday(): { year: number; month: number; date: number; weekday: number } {
  const shifted = new Date(Date.now() + KARACHI_OFFSET_HOURS * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** A wall-clock Karachi time, `dayOffset` days from today, as a real instant. */
function karachiTime(dayOffset: number, hour: number, minute = 0): Date {
  const today = karachiToday();
  return new Date(
    Date.UTC(today.year, today.month, today.date + dayOffset, hour - KARACHI_OFFSET_HOURS, minute),
  );
}

/** Days until the next given weekday — always 1–7, so it stays in the future. */
function daysUntilWeekday(weekday: number): number {
  const today = karachiToday();
  return ((weekday - today.weekday + 7) % 7) || 7;
}

function dayOffsetOf(day: DemoEvent["day"]): number {
  if (day === "sat") return daysUntilWeekday(6);
  if (day === "sun") return daysUntilWeekday(0);
  return day;
}

async function resolveOrganizerId(pool: Pool): Promise<string> {
  if (process.env.DEMO_ORGANIZER_ID) return process.env.DEMO_ORGANIZER_ID;

  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM profiles WHERE role = 'organizer' ORDER BY created_at ASC LIMIT 1`,
  );
  if (!rows[0]) {
    throw new Error(
      "No profile with role 'organizer' found — pass DEMO_ORGANIZER_ID=<uuid> to pick one.",
    );
  }
  return rows[0].id;
}

async function remove(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ id: number; name: string }>(
    `DELETE FROM events WHERE slug LIKE $1 RETURNING id, name`,
    [`${SLUG_PREFIX}%`],
  );
  // event_images and ticket_types cascade; bookings are ON DELETE RESTRICT, so
  // a demo event someone actually booked fails loudly here rather than
  // vanishing out from under a real ticket.
  console.log(`Removed ${rows.length} demo event(s).`);
  for (const row of rows) console.log(`  - [${row.id}] ${row.name}`);
}

async function seed(pool: Pool): Promise<void> {
  const organizerId = await resolveOrganizerId(pool);
  const { rows: categoryRows } = await pool.query<{ id: number }>(
    `SELECT id FROM categories WHERE name = 'Entertainment & Recreation' LIMIT 1`,
  );
  const categoryId = categoryRows[0]?.id ?? null;

  console.log(`Organizer: ${organizerId}`);
  console.log(`Category:  ${categoryId ?? "none"}\n`);

  for (const def of DEMO_EVENTS) {
    const offset = dayOffsetOf(def.day);
    const startTime = karachiTime(offset, def.startHour, def.startMinute ?? 0);
    const endTime = new Date(startTime.getTime() + def.durationHours * 3600_000);

    const { rows } = await pool.query<{ id: number }>(
      `INSERT INTO events (
         name, slug, description, start_time, end_time,
         location_name, address, latitude, longitude,
         category_id, organizer_id, max_capacity,
         is_featured, is_commission_based, status, require_guest_details
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,'published',false)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         location_name = EXCLUDED.location_name,
         address = EXCLUDED.address,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         category_id = EXCLUDED.category_id,
         max_capacity = EXCLUDED.max_capacity,
         is_featured = EXCLUDED.is_featured,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id`,
      [
        def.name,
        def.slug,
        def.description,
        startTime.toISOString(),
        endTime.toISOString(),
        def.locationName,
        def.address,
        def.latitude,
        def.longitude,
        categoryId,
        organizerId,
        def.maxCapacity,
        def.isFeatured ?? false,
      ],
    );
    const eventId = rows[0].id;

    // Children are rewritten wholesale so a re-run can't leave a stale image
    // or a ticket type that was renamed in this file.
    await pool.query(`DELETE FROM event_images WHERE event_id = $1`, [eventId]);
    await pool.query(
      `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
       VALUES ($1, $2, $3, 1, true)`,
      [eventId, def.imageUrl, def.name],
    );

    await pool.query(`DELETE FROM ticket_types WHERE event_id = $1`, [eventId]);
    for (const ticket of def.tickets) {
      await pool.query(
        `INSERT INTO ticket_types (
           event_id, name, description, price, quantity_available,
           sale_starts_at, sale_ends_at, max_per_person
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          eventId,
          ticket.name,
          ticket.description ?? null,
          ticket.price,
          ticket.quantity,
          new Date().toISOString(),
          endTime.toISOString(),
          ticket.maxPerPerson,
        ],
      );
    }

    const horizon = offset === 0 ? "today" : offset <= 7 ? "this week" : "later";
    console.log(
      `[${String(eventId).padStart(3)}] ${def.name}` +
        `\n        ${startTime.toISOString()} (+${offset}d, ${horizon})` +
        `${def.isFeatured ? " · featured" : ""}` +
        ` · ${def.tickets.length} ticket type(s)`,
    );
  }
}

async function main() {
  const rawConn = process.env.DATABASE_URL;
  if (!rawConn) {
    console.error("Error: DATABASE_URL environment variable is missing.");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: rawConn.split("?")[0],
    ssl: { rejectUnauthorized: false },
  });

  const host = new URL(rawConn).host;
  const removing = process.argv.includes("--remove");
  console.log(`${removing ? "Removing" : "Seeding"} demo events on ${host}\n`);

  try {
    if (removing) await remove(pool);
    else await seed(pool);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
