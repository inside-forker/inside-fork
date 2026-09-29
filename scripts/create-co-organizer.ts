import "dotenv/config";
import { query } from "../lib/db";
import { hashPassword } from "../lib/auth/password";
import { v4 as uuidv4 } from "uuid";

async function main() {
  const email = "prismfest.co@insidekarachi.com";
  const fullName = "PRISMFEST Team";
  const username = "prismfest_team";
  const password = "Prismfest2026!Eo";
  const company = "PRISMFEST";
  const bio = "Official co-organizer and event operations team for PRISMFEST 2026.";

  const { rows: existingAuth } = await query(
    "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1)",
    [email]
  );

  let userId: string;
  const now = new Date().toISOString();

  if (existingAuth.length > 0) {
    userId = String(existingAuth[0].id);
    const hashedPassword = await hashPassword(password);
    await query(
      "UPDATE auth.users SET encrypted_password = $1, updated_at = $2 WHERE id = $3",
      [hashedPassword, now, userId]
    );
    console.log("Updated existing auth.users password for id:", userId);
  } else {
    userId = uuidv4();
    const hashedPassword = await hashPassword(password);
    await query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
       VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
      [userId, email.toLowerCase(), hashedPassword, now, now, now]
    );
    console.log("Created auth.users record:", userId);
  }

  // Insert or update profiles
  const { rows: existingProfile } = await query(
    "SELECT id FROM public.profiles WHERE id = $1",
    [userId]
  );

  if (existingProfile.length > 0) {
    await query(
      `UPDATE public.profiles SET
        full_name = $1,
        username = $2,
        role = 'organizer',
        active_role = 'organizer',
        organizer_company = $3,
        organizer_bio = $4,
        is_verified_organizer = true,
        updated_at = $5
       WHERE id = $6`,
      [fullName, username, company, bio, now, userId]
    );
    console.log("Updated profile for:", userId);
  } else {
    await query(
      `INSERT INTO public.profiles (
        id, full_name, username, role, active_role,
        organizer_company, organizer_bio, is_verified_organizer,
        membership_plan, created_at, updated_at
      ) VALUES ($1, $2, $3, 'organizer', 'organizer', $4, $5, true, 'pro', $6, $7)`,
      [userId, fullName, username, company, bio, now, now]
    );
    console.log("Created profile for:", userId);
  }

  // Link to event 101 (PRISMFEST'26)
  await query(
    `INSERT INTO public.event_co_organizers (event_id, organizer_id)
     VALUES (101, $1)
     ON CONFLICT (event_id, organizer_id) DO NOTHING`,
    [userId]
  );
  console.log("Linked to event 101 in event_co_organizers!");

  // Query and print all organizers of PRISMFEST'26
  const { rows: eventDetails } = await query(
    `SELECT e.id, e.name, e.slug, p.full_name as primary_organizer
     FROM events e
     LEFT JOIN profiles p ON p.id = e.organizer_id
     WHERE e.id = 101`
  );

  const { rows: coOrganizers } = await query(
    `SELECT eco.event_id, p.full_name, p.username, p.role, p.organizer_company
     FROM event_co_organizers eco
     JOIN profiles p ON p.id = eco.organizer_id
     WHERE eco.event_id = 101`
  );

  console.log("\n--- Event & Organizers Summary ---");
  console.log("Event:", eventDetails[0]);
  console.log("Co-Organizers:", coOrganizers);
  console.log("Login Credentials:");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("---------------------------------\n");
}

main().catch((err) => {
  console.error("Error in main:", err);
  process.exit(1);
});
