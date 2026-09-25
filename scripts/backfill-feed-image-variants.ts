/**
 * Offline/CI backfill: write `_w400` / `_w800` JPEG siblings for published
 * listing (and optionally event) images that lack them.
 *
 * Run locally or in CI — not as a Vercel Hobby cron.
 *
 * Usage:
 *   npx tsx scripts/backfill-feed-image-variants.ts
 *   npx tsx scripts/backfill-feed-image-variants.ts --apply
 *   npx tsx scripts/backfill-feed-image-variants.ts --apply --limit=200
 *   npx tsx scripts/backfill-feed-image-variants.ts --apply --events
 *   npx tsx scripts/backfill-feed-image-variants.ts --concurrency=6
 */
import "dotenv/config";
import { Client } from "pg";
import {
  FEED_VARIANT_WIDTHS,
  feedVariantPath,
  uploadObjectFeedVariants,
} from "../lib/storage/feed-image-variants";
import { getKeyFromPublicUrl } from "../lib/storage/spaces";

const APPLY = process.argv.includes("--apply");
const INCLUDE_EVENTS = process.argv.includes("--events");
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return 500;
  const n = Number(arg.slice("--limit=".length));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 500;
})();
const CONCURRENCY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--concurrency="));
  if (!arg) return 4;
  const n = Number(arg.slice("--concurrency=".length));
  return Number.isFinite(n) && n > 0 ? Math.min(12, Math.floor(n)) : 4;
})();

type ImageRow = { id: number; url: string; kind: "listing" | "event" };

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

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return true;
    // Some Spaces configs reject HEAD — try a tiny GET range.
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
    });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

function isVariantUrl(url: string): boolean {
  try {
    return /_w(400|800|1200)\.[a-zA-Z0-9]+$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function needsBackfill(originalUrl: string): Promise<boolean> {
  for (const width of FEED_VARIANT_WIDTHS) {
    try {
      const u = new URL(originalUrl);
      u.pathname = feedVariantPath(u.pathname, width);
      if (!(await headOk(u.toString()))) return true;
    } catch {
      return true;
    }
  }
  return false;
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*,*/*" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () =>
      worker(),
    ),
  );
  return results;
}

async function main() {
  const client = await createDbClient();
  try {
    const { rows: listingRows } = await client.query<{
      id: number;
      url: string;
    }>(
      `SELECT li.id, li.url
       FROM listing_images li
       INNER JOIN listings l ON l.id = li.listing_id AND l.status = 'published'
       WHERE li.url NOT LIKE '%/menu/%'
         AND li.url NOT LIKE '%_w400.%'
         AND li.url NOT LIKE '%_w800.%'
         AND li.url NOT LIKE '%_w1200.%'
       ORDER BY li.id ASC
       LIMIT $1`,
      [LIMIT],
    );

    const images: ImageRow[] = listingRows.map((r) => ({
      id: Number(r.id),
      url: String(r.url),
      kind: "listing" as const,
    }));

    if (INCLUDE_EVENTS) {
      const { rows: eventRows } = await client.query<{
        id: number;
        url: string;
      }>(
        `SELECT id, url FROM event_images
         WHERE url NOT LIKE '%_w400.%'
           AND url NOT LIKE '%_w800.%'
           AND url NOT LIKE '%_w1200.%'
         ORDER BY id ASC
         LIMIT $1`,
        [LIMIT],
      );
      for (const r of eventRows) {
        images.push({
          id: Number(r.id),
          url: String(r.url),
          kind: "event",
        });
      }
    }

    console.log(
      `Candidates: ${images.length} (apply=${APPLY}, concurrency=${CONCURRENCY})`,
    );

    let skippedHasVariants = 0;
    let skippedNoKey = 0;
    let skippedFetch = 0;
    let wrote = 0;
    let dryWouldWrite = 0;
    let errors = 0;

    await mapPool(images, CONCURRENCY, async (img) => {
      if (isVariantUrl(img.url)) {
        skippedHasVariants++;
        return;
      }
      const key = getKeyFromPublicUrl(img.url);
      if (!key) {
        skippedNoKey++;
        return;
      }
      const missing = await needsBackfill(img.url);
      if (!missing) {
        skippedHasVariants++;
        return;
      }

      if (!APPLY) {
        dryWouldWrite++;
        console.log(`[dry] ${img.kind}#${img.id} → variants for ${key}`);
        return;
      }

      const buf = await fetchBuffer(img.url);
      if (!buf) {
        skippedFetch++;
        console.warn(`[skip] fetch failed ${img.kind}#${img.id} ${img.url}`);
        return;
      }

      try {
        const variants = await uploadObjectFeedVariants(key, buf);
        wrote++;
        console.log(
          `[ok] ${img.kind}#${img.id} wrote ${variants.map((v) => `w${v.width}`).join(",")}`,
        );
      } catch (err) {
        errors++;
        console.error(`[err] ${img.kind}#${img.id}`, err);
      }
    });

    console.log(
      JSON.stringify(
        {
          apply: APPLY,
          candidates: images.length,
          dryWouldWrite,
          wrote,
          skippedHasVariants,
          skippedNoKey,
          skippedFetch,
          errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
