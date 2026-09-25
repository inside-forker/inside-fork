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
 *   npx tsx scripts/audit-listing-image-health.ts --unchecked-only
 *   npx tsx scripts/audit-listing-image-health.ts --apply
 *   npx tsx scripts/audit-listing-image-health.ts --csv=tmp/listing-image-health.csv
 *
 * DB is released while HEADing Spaces so long probes don't idle-timeout the
 * connection. --apply writes in batches (not one giant transaction).
 *
 * --apply requires availability/last_checked_at columns (run the migration first).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { brandStemFromListingName } from "../lib/listings/borrowed-header-image";
import {
  mapProbeToAvailability,
  probeListingImageUrl,
  type ImageProbeStatus,
} from "../lib/listings/image-health";

const APPLY = process.argv.includes("--apply");
const PRIMARY_ONLY = process.argv.includes("--primary-only");
const UNCHECKED_ONLY = process.argv.includes("--unchecked-only");
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
const APPLY_BATCH = 200;

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

type ProbePair = {
  img: ImageRow;
  result: Awaited<ReturnType<typeof probeListingImageUrl>>;
};

async function createDbClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required");
  const client = new Client({
    connectionString: raw.split("?")[0],
    ssl: raw.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 30_000,
  });
  client.on("error", (err) => {
    console.error("[audit] pg client error:", err.message);
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
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  );
  return results;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function applyProbeBatch(db: Client, batch: ProbePair[]) {
  let rewritten = 0;
  await db.query("BEGIN");
  try {
    for (const { img, result } of batch) {
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
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  }
  return rewritten;
}

async function main() {
  console.log(
    `[audit-listing-image-health] mode=${APPLY ? "APPLY" : "DRY-RUN"} primaryOnly=${PRIMARY_ONLY} uncheckedOnly=${UNCHECKED_ONLY} limit=${LIMIT ?? "none"} concurrency=${CONCURRENCY}`,
  );

  let db = await createDbClient();

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
      ${
        UNCHECKED_ONLY
          ? "AND (li.last_checked_at IS NULL OR li.availability = 'unknown')"
          : ""
      }
    ORDER BY li.listing_id ASC, li.is_primary DESC NULLS LAST, li.display_order ASC NULLS LAST, li.id ASC
    ${LIMIT != null ? `LIMIT ${LIMIT}` : ""}
  `;

  const { rows: images } = await db.query<ImageRow>(imageSql);
  await db.end();
  db = null as unknown as Client;

  console.log(`[audit] probing ${images.length} images (DB released)…`);

  let done = 0;
  const probes = await mapPool(images, CONCURRENCY, async (img) => {
    const result = await probeListingImageUrl(img.url);
    done += 1;
    if (done % 500 === 0 || done === images.length) {
      console.log(`[audit] probed ${done}/${images.length}`);
    }
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

  db = await createDbClient();

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

    // One query for all stems that have any donor (avoids N+1).
    const stemRows = emptyListings
      .map((l) => ({
        id: l.id,
        stem: brandStemFromListingName(l.name),
      }))
      .filter((l): l is { id: number; stem: string } => Boolean(l.stem));

    const uniqueStems = [...new Set(stemRows.map((s) => s.stem.toLowerCase()))];
    const stemsWithDonor = new Set<string>();
    for (const stemKey of uniqueStems) {
      const sample = stemRows.find((s) => s.stem.toLowerCase() === stemKey);
      if (!sample) continue;
      const { rows: donors } = await db.query<{ n: string }>(
        `SELECT 1::text AS n
         FROM listings d
         INNER JOIN listing_images di ON di.listing_id = d.id
           AND di.url NOT LIKE '%/menu/%'
         WHERE d.status IN ('published', 'archived')
           AND d.name ILIKE $1 || '%'
         LIMIT 1`,
        [sample.stem],
      );
      if (donors[0]) stemsWithDonor.add(stemKey);
    }
    emptyWithSibling = stemRows.filter((s) =>
      stemsWithDonor.has(s.stem.toLowerCase()),
    ).length;
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

  const colCheck = await db.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'listing_images'
        AND column_name = 'availability'
    ) AS exists
  `);
  if (!colCheck.rows[0]?.exists) {
    await db.end();
    throw new Error(
      "listing_images.availability missing — run sql/migrations/20260925_listing_image_availability.sql first",
    );
  }

  let rewritten = 0;
  let marked = 0;
  for (let i = 0; i < probes.length; i += APPLY_BATCH) {
    const batch = probes.slice(i, i + APPLY_BATCH);
    try {
      rewritten += await applyProbeBatch(db, batch);
      marked += batch.length;
    } catch (error) {
      console.error(
        `[audit] batch apply failed at offset ${i}; reconnecting…`,
        error instanceof Error ? error.message : error,
      );
      await db.end().catch(() => {});
      db = await createDbClient();
      rewritten += await applyProbeBatch(db, batch);
      marked += batch.length;
    }
    if ((i + APPLY_BATCH) % 1000 < APPLY_BATCH || i + APPLY_BATCH >= probes.length) {
      console.log(`[audit] applied ${Math.min(i + APPLY_BATCH, probes.length)}/${probes.length}`);
    }
  }

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

  await db.end();
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
}

main().catch((error) => {
  console.error("[audit-listing-image-health] failed:", error);
  process.exit(1);
});
