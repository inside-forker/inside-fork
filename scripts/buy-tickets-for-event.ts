import "dotenv/config";
import { Pool } from "pg";
import crypto from "crypto";

function hashCnic(cnic: string): string {
  const clean = cnic.replace(/\D/g, "");
  return crypto.createHash("sha256").update(clean).digest("hex");
}

function cnicLast4(cnic: string): string {
  const clean = cnic.replace(/\D/g, "");
  return clean.slice(-4);
}

function generatePassCode(): string {
  return `IK-${Date.now().toString(36).slice(-4).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in environment.");
    process.exit(1);
  }

  const cleanConnectionString = connectionString.split("?")[0];
  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 15_000,
  });

  const client = await pool.connect();

  try {
    // 1. Target Event (ID 102 - "Tster event for devs only")
    const { rows: latestEvents } = await client.query(`
      SELECT id, name, status, start_time, organizer_id, created_at
      FROM events
      ORDER BY id DESC
      LIMIT 1
    `);
    const targetEvent = latestEvents[0];
    const targetEventId = Number(targetEvent.id);
    const targetEventName = targetEvent.name;

    console.log(`\nTarget Event: ID ${targetEventId} - "${targetEventName}"`);

    // Ensure event is published
    await client.query(`UPDATE events SET status = 'published' WHERE id = $1`, [targetEventId]);

    // 2. Check ticket types for this event
    let { rows: ticketTypes } = await client.query(`
      SELECT id, event_id, name, price, quantity_available, sale_starts_at, sale_ends_at, max_per_person
      FROM ticket_types
      WHERE event_id = $1
      ORDER BY id ASC
    `, [targetEventId]);

    const selectedTicket = ticketTypes[0];
    await client.query(`
      UPDATE ticket_types
      SET quantity_available = COALESCE(quantity_available, 0) + 20
      WHERE id = $1
    `, [selectedTicket.id]);

    const { rows: userAccounts } = await client.query(`
      SELECT p.id, p.full_name, p.username, p.phone, u.email
      FROM profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      ORDER BY p.created_at ASC
      LIMIT 8
    `);

    console.log(`\n--- Creating ticket purchases for 8 accounts on "${targetEventName}" (Ticket: ${selectedTicket.name} - Rs. ${selectedTicket.price}) ---`);

    for (let idx = 0; idx < userAccounts.length; idx++) {
      const user = userAccounts[idx];
      const buyerName = user.full_name || user.username || `Attendee ${idx + 1}`;
      const buyerEmail = user.email || `attendee_${idx + 1}@insidekhi.test`;
      const buyerPhone = user.phone || `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
      const rawCnic = `42101${Math.floor(10000000 + Math.random() * 90000000)}`;
      const cnicH = hashCnic(rawCnic);
      const cnicL4 = cnicLast4(rawCnic);
      const bookingRef = `IK-${Date.now().toString(36).slice(-4).toUpperCase()}-${crypto.randomBytes(2).toString("hex").slice(0, 3).toUpperCase()}`;
      const verificationSeed = crypto.randomBytes(12).toString("hex");

      const ticketPrice = Number(selectedTicket.price) || 0;
      const quantity = 1;
      const totalAmount = ticketPrice * quantity;

      await client.query("BEGIN");

      // Insert booking
      const { rows: bookingRows } = await client.query(`
        INSERT INTO bookings (
          user_id, event_id, total_amount, status, payment_status, booking_reference,
          verification_seed, expires_at, cnic_hash, cnic_last4,
          customer_name, customer_email, customer_phone,
          created_at
        )
        VALUES ($1, $2, $3, 'confirmed', 'paid', $4, $5, NOW() + INTERVAL '30 days', $6, $7, $8, $9, $10, NOW())
        RETURNING id
      `, [
        user.id,
        targetEventId,
        totalAmount,
        bookingRef,
        verificationSeed,
        cnicH,
        cnicL4,
        buyerName,
        buyerEmail,
        buyerPhone,
      ]);

      const bookingId = Number(bookingRows[0].id);

      // Insert booking item
      await client.query(`
        INSERT INTO booking_items (booking_id, ticket_type_id, quantity, price_per_ticket)
        VALUES ($1, $2, $3, $4)
      `, [bookingId, selectedTicket.id, quantity, ticketPrice]);

      // Insert ticket pass
      const passCode = generatePassCode();
      const signature = crypto.createHmac("sha256", verificationSeed).update(`${bookingId}:${passCode}`).digest("hex");

      await client.query(`
        INSERT INTO ticket_passes (
          booking_id, event_id, ticket_type_id, quantity_index, code,
          signature, status, issued_at, guest_name, cnic_last4
        )
        VALUES ($1, $2, $3, 0, $4, $5, 'issued', NOW(), $6, $7)
      `, [
        bookingId,
        targetEventId,
        selectedTicket.id,
        passCode,
        signature,
        buyerName,
        cnicL4,
      ]);

      // Decrement available quantity
      await client.query(`
        UPDATE ticket_types
        SET quantity_available = GREATEST(0, quantity_available - $1)
        WHERE id = $2
      `, [quantity, selectedTicket.id]);

      await client.query("COMMIT");

      console.log(`✔ [${idx + 1}/8] Confirmed Ticket for ${buyerName} (${buyerEmail}) | Booking ID: ${bookingId} | Pass: ${passCode}`);
    }

    console.log(`\n🎉 Successfully completed 8 ticket purchases for event "${targetEventName}" (ID ${targetEventId})!`);

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error creating ticket purchases:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
