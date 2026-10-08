/**
 * Upload organizer PDF tickets into Spaces (private) and insert
 * ticket_pdf_inventory rows for a ticket_type.
 *
 * Usage:
 *   npx tsx scripts/seed-ticket-pdf-inventory.ts \
 *     --event-slug prismfest-26 \
 *     --tier "Prism Fam" \
 *     --dir scripts/data/ticket-pdfs/prism-fam
 *
 * Filename should contain the Ticketwala id near the end, e.g.
 *   002_Prism_Fam_2586389.pdf
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  TICKET_PDF_INVENTORY_PREFIX,
  uploadPrefixedFile,
} from "../lib/storage/spaces";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

function extractExternalId(filename: string): string | null {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/(\d{6,})$/);
  return match?.[1] ?? null;
}

async function main() {
  const eventSlug = (argValue("--event-slug") || "prismfest-26").trim();
  const tier = (argValue("--tier") || "Prism Fam").trim();
  const dirArg = argValue("--dir") || "scripts/data/ticket-pdfs/prism-fam";
  const dir = path.resolve(process.cwd(), dirArg);

  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined.");
    process.exit(1);
  }

  const pdfFiles = fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();

  if (pdfFiles.length === 0) {
    console.error(`No PDF files in ${dir}`);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: connectionString.split("?")[0],
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const client = await pool.connect();
  try {
    const { rows: typeRows } = await client.query(
      `SELECT tt.id, tt.name, tt.quantity_available
       FROM ticket_types tt
       INNER JOIN events e ON e.id = tt.event_id
       WHERE lower(e.slug) = lower($1)
         AND tt.name ILIKE $2
       ORDER BY tt.id ASC
       LIMIT 5`,
      [eventSlug, `${tier}%`],
    );

    if (typeRows.length === 0) {
      console.error(
        `No ticket_type matching event=${eventSlug} name ILIKE '${tier}%'`,
      );
      process.exit(1);
    }
    if (typeRows.length > 1) {
      console.warn(
        "Multiple matching ticket types; using the first:",
        typeRows.map((r) => `${r.id}:${r.name}`).join(", "),
      );
    }

    const ticketTypeId = Number(typeRows[0].id);
    console.log(
      `Seeding ${pdfFiles.length} PDFs for ticket_type ${ticketTypeId} (${typeRows[0].name})`,
    );

    let inserted = 0;
    let skipped = 0;

    for (const filename of pdfFiles) {
      const externalId = extractExternalId(filename);
      if (!externalId) {
        console.warn(`Skip (no ticket id in name): ${filename}`);
        skipped += 1;
        continue;
      }

      const { rows: existing } = await client.query(
        `SELECT id FROM ticket_pdf_inventory WHERE external_ticket_id = $1`,
        [externalId],
      );
      if (existing.length > 0) {
        console.log(`Exists: ${externalId} -> inventory #${existing[0].id}`);
        skipped += 1;
        continue;
      }

      const absolute = path.join(dir, filename);
      const body = fs.readFileSync(absolute);
      const relativePath = `${ticketTypeId}/${externalId}.pdf`;

      const uploaded = await uploadPrefixedFile(
        TICKET_PDF_INVENTORY_PREFIX,
        relativePath,
        body,
        { contentType: "application/pdf", isPublic: false },
      );

      await client.query(
        `INSERT INTO ticket_pdf_inventory
           (ticket_type_id, external_ticket_id, storage_key, original_filename)
         VALUES ($1, $2, $3, $4)`,
        [ticketTypeId, externalId, uploaded.path, filename],
      );
      inserted += 1;
      console.log(`Uploaded ${filename} -> ${uploaded.path}`);
    }

    const { rows: availRows } = await client.query(
      `SELECT COUNT(*)::int AS available
       FROM ticket_pdf_inventory
       WHERE ticket_type_id = $1 AND booking_id IS NULL`,
      [ticketTypeId],
    );
    const available = Number(availRows[0]?.available ?? 0);

    await client.query(
      `UPDATE ticket_types SET quantity_available = $1 WHERE id = $2`,
      [available, ticketTypeId],
    );

    console.log(
      `\nDone. inserted=${inserted} skipped=${skipped} quantity_available=${available}`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
