import "dotenv/config";
import { Pool } from "pg";
import crypto from "crypto";

const ORGANIZER_ID = "8c6c05e1-f62f-435a-90c6-d0edd9d0c2d3"; // The 'Test' organizer created in Sprint 1

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET || "insidekhi-default-secret-change-in-prod";

  const pool = new Pool({
    connectionString: connectionString.split("?")[0],
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("Seeding test event for Organizer ID:", ORGANIZER_ID);

    // 1. Check/Insert Event
    const slug = "karachi-tech-music-fest-2026";
    const { rows: existingEvent } = await client.query(
      `SELECT id FROM public.events WHERE slug = $1`,
      [slug],
    );

    let eventId: number;

    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(18, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(23, 0, 0, 0);

    if (existingEvent.length > 0) {
      eventId = Number(existingEvent[0].id);
      console.log("Existing event found with ID:", eventId);
      // Clean up previous test bookings/passes for this event so we have fresh clean state
      await client.query(`DELETE FROM public.ticket_passes WHERE event_id = $1`, [eventId]);
      await client.query(`DELETE FROM public.bookings WHERE event_id = $1`, [eventId]);
    } else {
      const { rows: newEvent } = await client.query(
        `INSERT INTO public.events (
          organizer_id, name, slug, description, start_time, end_time,
          location_name, address, max_capacity, status, created_at, updated_at
        ) VALUES (
          $1, 'Karachi Tech & Music Fest 2026', $2,
          'Exclusive evening of live indie music, electronic beats, and tech showcase at Beach View Park.',
          $3, $4, 'Beach View Park, Clifton', 'Sea View Rd, Clifton Block 4, Karachi', 500, 'published', NOW(), NOW()
        ) RETURNING id`,
        [ORGANIZER_ID, slug, startTime.toISOString(), endTime.toISOString()],
      );
      eventId = Number(newEvent[0].id);
      console.log("Created event with ID:", eventId);
    }

    // 2. Insert Ticket Types
    let vipTypeId: number;
    let gaTypeId: number;

    const { rows: existingTypes } = await client.query(
      `SELECT id, name FROM public.ticket_types WHERE event_id = $1`,
      [eventId],
    );

    if (existingTypes.length > 0) {
      vipTypeId = Number(existingTypes.find((t) => t.name.includes("VIP"))?.id || existingTypes[0].id);
      gaTypeId = Number(existingTypes.find((t) => t.name.includes("General"))?.id || existingTypes[0].id);
    } else {
      const now = new Date();
      const saleEnd = new Date();
      saleEnd.setDate(saleEnd.getDate() + 7);

      const { rows: vipRow } = await client.query(
        `INSERT INTO public.ticket_types (event_id, name, description, price, quantity_available, max_per_person, sale_starts_at, sale_ends_at)
         VALUES ($1, 'VIP All-Access Pass', 'Front-row stage access and VIP lounge pass', 3500, 50, 4, $2, $3)
         RETURNING id`,
        [eventId, now.toISOString(), saleEnd.toISOString()],
      );
      vipTypeId = Number(vipRow[0].id);

      const { rows: gaRow } = await client.query(
        `INSERT INTO public.ticket_types (event_id, name, description, price, quantity_available, max_per_person, sale_starts_at, sale_ends_at)
         VALUES ($1, 'General Admission', 'Full access to main concert ground', 1500, 250, 6, $2, $3)
         RETURNING id`,
        [eventId, now.toISOString(), saleEnd.toISOString()],
      );
      gaTypeId = Number(gaRow[0].id);
    }

    // Helper to generate HMAC signature
    function computeSignature(code: string, eId: number, bId: number) {
      const payload = `${code}:${eId}:${bId}`;
      return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex").substring(0, 16);
    }

    // 3. Customer 1: Ali Raza (VIP Pass)
    const bookingRef1 = `BK-TECH-${Math.floor(100000 + Math.random() * 900000)}`;
    const { rows: booking1 } = await client.query(
      `INSERT INTO public.bookings (
        user_id, event_id, total_amount, status, payment_status, booking_reference,
        customer_name, customer_email, customer_phone, created_at
      ) VALUES (
        $1, $2, 3500, 'confirmed', 'paid', $3,
        'Ali Raza', 'ali.raza@example.com', '+92 300 1112233', NOW()
      ) RETURNING id`,
      [ORGANIZER_ID, eventId, bookingRef1],
    );
    const bookingId1 = Number(booking1[0].id);

    const ticketCode1 = "IK-ALIRAZA-VIP01";
    const signature1 = computeSignature(ticketCode1, eventId, bookingId1);

    await client.query(
      `INSERT INTO public.ticket_passes (
        booking_id, event_id, ticket_type_id, quantity_index, code, signature, status,
        guest_name, issued_at
      ) VALUES ($1, $2, $3, 0, $4, $5, 'issued', 'Ali Raza', NOW())`,
      [bookingId1, eventId, vipTypeId, ticketCode1, signature1],
    );

    // 4. Customer 2: Zainab Fatima (General Admission)
    const bookingRef2 = `BK-TECH-${Math.floor(100000 + Math.random() * 900000)}`;
    const { rows: booking2 } = await client.query(
      `INSERT INTO public.bookings (
        user_id, event_id, total_amount, status, payment_status, booking_reference,
        customer_name, customer_email, customer_phone, created_at
      ) VALUES (
        $1, $2, 1500, 'confirmed', 'paid', $3,
        'Zainab Fatima', 'zainab.f@example.com', '+92 321 4445566', NOW()
      ) RETURNING id`,
      [ORGANIZER_ID, eventId, bookingRef2],
    );
    const bookingId2 = Number(booking2[0].id);

    const ticketCode2 = "IK-ZAINAB-GA02";
    const signature2 = computeSignature(ticketCode2, eventId, bookingId2);

    await client.query(
      `INSERT INTO public.ticket_passes (
        booking_id, event_id, ticket_type_id, quantity_index, code, signature, status,
        guest_name, issued_at
      ) VALUES ($1, $2, $3, 0, $4, $5, 'issued', 'Zainab Fatima', NOW())`,
      [bookingId2, eventId, gaTypeId, ticketCode2, signature2],
    );

    console.log("\n=======================================================");
    console.log("✔ TEST EVENT & ATTENDEES SUCCESSFULLY SEEDED!");
    console.log("=======================================================");
    console.log(`Event: "Karachi Tech & Music Fest 2026" (ID: ${eventId})`);
    console.log(`Organizer ID: ${ORGANIZER_ID}`);
    console.log("\nRegistered Attendee 1:");
    console.log(`  Name: Ali Raza`);
    console.log(`  Type: VIP All-Access Pass`);
    console.log(`  Ticket Code: ${ticketCode1}`);
    console.log(`  Signature: ${signature1}`);
    console.log("\nRegistered Attendee 2:");
    console.log(`  Name: Zainab Fatima`);
    console.log(`  Type: General Admission`);
    console.log(`  Ticket Code: ${ticketCode2}`);
    console.log(`  Signature: ${signature2}`);
    console.log("=======================================================\n");
  } catch (err) {
    console.error("Error seeding event:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
