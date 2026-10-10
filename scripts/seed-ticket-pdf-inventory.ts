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
  extractExternalId,
  syncTicketTypeQuantityAvailable,
  uploadPdfToInventory,
} from "../lib/ticketing/pdf-inventory-upload";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
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
      const absolute = path.join(dir, filename);
      const body = fs.readFileSync(absolute);
      const result = await uploadPdfToInventory({
        ticketTypeId,
        buffer: body,
        filename,
        externalId: extractExternalId(filename),
      });

      if (result.status === "ok") {
        inserted += 1;
        console.log(
          `Uploaded ${filename} -> inventory #${result.inventory_id}`,
        );
      } else {
        skipped += 1;
        console.log(
          `${result.status}: ${filename}${result.message ? ` (${result.message})` : ""}`,
        );
      }
    }

    // syncTicketTypeQuantityAvailable uses the app pool; for the CLI we sync here too
    // via the shared helper which also uses DATABASE_URL through @/lib/db.
    const available = await syncTicketTypeQuantityAvailable(ticketTypeId);

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
