/**
 * Audit (and optionally repair) listing image health against Spaces.
 *
 * Classifies each non-menu image on published listings:
 *   ok | ok_via_alternate | dead
 * Plus empty-gallery listings (with/without borrowable sibling).
 *
 * Usage:
 *   npx tsx scripts/audit-listing-image-health.ts
 *   npx tsx scripts/audit-listing-image-health.ts --primary-only
 *   npx tsx scripts/audit-listing-image-health.ts --limit=500
 *   npx tsx scripts/audit-listing-image-health.ts --apply
 *   npx tsx scripts/audit-listing-image-health.ts --csv=tmp/listing-image-health.csv
 *
 * --apply requires availability/last_checked_at columns (run the migration first).
 * It rewrites ok_via_alternate URLs, marks availability, and reassigns primary
 * when the current primary is dead and another image is ok.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  brandStemFromListingName,
} from "../lib/listings/borrowed-header-image";
import {
  mapProbeToAvailability,
  probeListingImageUrl,
  type ImageProbeStatus,
} from "../lib/listings/image-health";

const APPLY = process.argv.includes("--apply");
const PRIMARY_ONLY = process.argv.includes("--primary-only");
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return null;
  const n = Number(arg.slice("--limit=".length));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
})();
const CSV_PATH = (() => {
  const arg = process.argv.find((a) => a.startsWith("--csv="));
  return arg ? arg.slice("--csv=".length) : "tmp/listing-image-health.csv";
})();
const CONCURRENCY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--concurrency="));
  if (!arg) return 12;
  const n = Number(arg.slice("--concurrency=".length));
  return Number.isFinite(n) && n > 0 ? Math.min(32, Math.floor(n)) : 12;
})();

type ImageRow = {
  id: number;
  listing_id: number;
  url: string;
  is_primary: boolean;
  listing_name: string | null;
};

type CsvRow = {
  listing_id: number;
  image_id: number | "";
  url: string;
  status: ImageProbeStatus | "empty_gallery";
  alternate_url: string;
  listing_name: string;
};

async function createDbClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: raw.split("?")[0],
    ssl: raw.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  return client;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const db = await createDbClient();
  console.log(
    `[audit-listing-image-health] mode=${APPLY ? "APPLY" : "DRY-RUN"} primaryOnly=${PRIMARY_ONLY} limit=${LIMIT ?? "none"} concurrency=${CONCURRENCY}`,
  );

  const imageSql = `
    SELECT li.id,
           li.listing_id,
           li.url,
           COALESCE(li.is_primary, false) AS is_primary,
           l.name AS listing_name
    FROM listing_images li
    INNER JOIN listings l ON l.id = li.listing_id AND l.status = 'published'
    WHERE li.url NOT LIKE '%/menu/%'
      ${PRIMARY_ONLY ? "AND COALESCE(li.is_primary, false) = true" : ""}
    ORDER BY li.listing_id ASC, li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
    ${LIMIT != null ? `LIMIT ${LIMIT}` : ""}
  `;

  const { rows: images } = await db.query<ImageRow>(imageSql);
  console.log(`[audit] probing ${images.length} images…`);

  const probes = await mapPool(images, CONCURRENCY, async (img) => {
    const result = await probeListingImageUrl(img.url);
    return { img, result };
  });

  const counts: Record<ImageProbeStatus, number> = {
    ok: 0,
    ok_via_alternate: 0,
    dead: 0,
  };
  const byPrefix = {
    listing_images: { ok: 0, ok_via_alternate: 0, dead: 0 },
    peekaboo_direct: { ok: 0, ok_via_alternate: 0, dead: 0 },
    other: { ok: 0, ok_via_alternate: 0, dead: 0 },
  };

  const csvRows: CsvRow[] = [];

  for (const { img, result } of probes) {
    counts[result.status] += 1;
    const prefixKey = img.url.includes("/listing-images/")
      ? "listing_images"
      : img.url.includes("/peekaboo/")
        ? "peekaboo_direct"
        : "other";
    byPrefix[prefixKey][result.status] += 1;
    csvRows.push({
      listing_id: img.listing_id,
      image_id: img.id,
      url: img.url,
      status: result.status,
      alternate_url: result.workingUrl ?? "",
      listing_name: img.listing_name ?? "",
    });
  }

  // Empty galleries on published listings.
  const { rows: emptyListings } = await db.query<{
    id: number;
    name: string | null;
  }>(`
    SELECT l.id, l.name
    FROM listings l
    WHERE l.status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM listing_images li
        WHERE li.listing_id = l.id
          AND li.url NOT LIKE '%/menu/%'
      )
    ORDER BY l.id ASC
  `);

  let emptyWithSibling = 0;
  if (emptyListings.length > 0) {
    // getBorrowedHeaderImageUrls uses the app `query` pool — fall back to
    // inline stem check so this script stays self-contained on one client.
    for (const listing of emptyListings) {
      csvRows.push({
        listing_id: listing.id,
        image_id: "",
        url: "",
        status: "empty_gallery",
        alternate_url: "",
        listing_name: listing.name ?? "",
      });
    }

    const stems = emptyListings
      .map((l) => ({
        id: l.id,
        name: l.name,
        stem: brandStemFromListingName(l.name),
      }))
      .filter((l) => l.stem);

    for (const row of stems) {
      const { rows: donors } = await db.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n
         FROM listings d
         INNER JOIN listing_images di ON di.listing_id = d.id
           AND di.url NOT LIKE '%/menu/%'
         WHERE d.id <> $1
           AND d.status IN ('published', 'archived')
           AND d.name ILIKE $2 || '%'
         LIMIT 1`,
        [row.id, row.stem],
      );
      if (Number(donors[0]?.n ?? 0) > 0) emptyWithSibling += 1;
    }
  }

  const summary = {
    images_probed: images.length,
    counts,
    by_prefix: byPrefix,
    empty_galleries: emptyListings.length,
    empty_with_sibling_cover: emptyWithSibling,
    dead_pct:
      images.length === 0
        ? 0
        : Math.round((counts.dead / images.length) * 1000) / 10,
  };
  console.log(JSON.stringify(summary, null, 2));

  const absCsv = path.resolve(process.cwd(), CSV_PATH);
  fs.mkdirSync(path.dirname(absCsv), { recursive: true });
  const header =
    "listing_id,image_id,url,status,alternate_url,listing_name\n";
  const body = csvRows
    .map((r) =>
      [
        r.listing_id,
        r.image_id,
        csvEscape(r.url),
        r.status,
        csvEscape(r.alternate_url),
        csvEscape(r.listing_name),
      ].join(","),
    )
    .join("\n");
  fs.writeFileSync(absCsv, header + body + "\n", "utf8");
  console.log(`[audit] wrote ${csvRows.length} rows → ${absCsv}`);

  if (!APPLY) {
    console.log(
      "[audit] dry-run complete; re-run with --apply after migration to rewrite/mark.",
    );
    await db.end();
    return;
  }

  // Ensure columns exist (migration should have run; fail clearly if not).
  const colCheck = await db.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'listing_images'
        AND column_name = 'availability'
    ) AS exists
  `);
  if (!colCheck.rows[0]?.exists) {
    throw new Error(
      "listing_images.availability missing — run sql/migrations/20260925_listing_image_availability.sql first",
    );
  }

  await db.query("BEGIN");
  try {
    let rewritten = 0;
    let marked = 0;

    for (const { img, result } of probes) {
      const availability = mapProbeToAvailability(result.status);
      if (
        result.status === "ok_via_alternate" &&
        result.workingUrl &&
        result.workingUrl !== img.url
      ) {
        await db.query(
          `UPDATE listing_images
           SET url = $1,
               availability = $2,
               last_checked_at = NOW()
           WHERE id = $3`,
          [result.workingUrl, availability, img.id],
        );
        rewritten += 1;
      } else {
        await db.query(
          `UPDATE listing_images
           SET availability = $1,
               last_checked_at = NOW()
           WHERE id = $2`,
          [availability, img.id],
        );
      }
      marked += 1;
    }

    // Reassign primary when primary is dead and another non-menu image is ok.
    const primaryFix = await db.query(`
      WITH dead_primary AS (
        SELECT li.listing_id, li.id AS dead_id
        FROM listing_images li
        WHERE COALESCE(li.is_primary, false) = true
          AND li.availability = 'dead'
          AND li.url NOT LIKE '%/menu/%'
      ),
      healthy AS (
        SELECT DISTINCT ON (li.listing_id)
               li.listing_id, li.id AS healthy_id
        FROM listing_images li
        INNER JOIN dead_primary dp ON dp.listing_id = li.listing_id
        WHERE li.availability = 'ok'
          AND li.url NOT LIKE '%/menu/%'
        ORDER BY li.listing_id,
          li.display_order ASC NULLS LAST,
          li.id ASC
      )
      UPDATE listing_images li
      SET is_primary = CASE
        WHEN li.id = h.healthy_id THEN true
        WHEN li.id = dp.dead_id THEN false
        ELSE li.is_primary
      END
      FROM dead_primary dp
      INNER JOIN healthy h ON h.listing_id = dp.listing_id
      WHERE li.listing_id = dp.listing_id
        AND li.id IN (dp.dead_id, h.healthy_id)
    `);

    await db.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          marked,
          rewritten,
          primary_reassigned_rows: primaryFix.rowCount ?? 0,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("[audit-listing-image-health] failed:", error);
  process.exit(1);
});
