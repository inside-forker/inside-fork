import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import {
  mapProbeToAvailability,
  probeListingImageUrl,
} from "@/lib/listings/image-health";

export const dynamic = "force-dynamic";
/** Allow a modest batch of HEADs within the serverless window. */
export const maxDuration = 60;

const DEFAULT_BATCH = 400;
const MAX_BATCH = 800;
const CONCURRENCY = 10;
/** Re-check rows older than this (or never checked). */
const STALE_DAYS = 7;

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

/**
 * Nightly listing-image health re-audit (see vercel.json).
 * Probes a batch of stale/unknown non-menu images, rewrites ok_via_alternate
 * URLs, marks availability, and reassigns primary when needed.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchParam = Number(request.nextUrl.searchParams.get("batch"));
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(
      1,
      Number.isFinite(batchParam) && batchParam > 0
        ? Math.floor(batchParam)
        : DEFAULT_BATCH,
    ),
  );

  try {
    const { rows: images } = await query<{
      id: number;
      url: string;
      listing_id: number;
    }>(
      `SELECT li.id, li.url, li.listing_id
       FROM listing_images li
       INNER JOIN listings l ON l.id = li.listing_id AND l.status = 'published'
       WHERE li.url NOT LIKE '%/menu/%'
         AND (
           li.last_checked_at IS NULL
           OR li.last_checked_at < NOW() - ($1::int * INTERVAL '1 day')
           OR li.availability = 'unknown'
         )
       ORDER BY li.last_checked_at ASC NULLS FIRST, li.id ASC
       LIMIT $2`,
      [STALE_DAYS, batchSize],
    );

    const results = await mapPool(images, CONCURRENCY, async (img) => {
      const result = await probeListingImageUrl(img.url);
      const availability = mapProbeToAvailability(result.status);
      if (
        result.status === "ok_via_alternate" &&
        result.workingUrl &&
        result.workingUrl !== img.url
      ) {
        await query(
          `UPDATE listing_images
           SET url = $1, availability = $2, last_checked_at = NOW()
           WHERE id = $3`,
          [result.workingUrl, availability, img.id],
        );
        return { availability, rewritten: true as const };
      }
      await query(
        `UPDATE listing_images
         SET availability = $1, last_checked_at = NOW()
         WHERE id = $2`,
        [availability, img.id],
      );
      return { availability, rewritten: false as const };
    });

    let rewritten = 0;
    let markedOk = 0;
    let markedDead = 0;
    for (const r of results) {
      if (r.rewritten) rewritten += 1;
      if (r.availability === "ok") markedOk += 1;
      else markedDead += 1;
    }

    const primaryFix = await query(`
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

    return NextResponse.json({
      success: true,
      probed: images.length,
      rewritten,
      markedOk,
      markedDead,
      primaryReassignedRows: primaryFix.rowCount ?? 0,
    });
  } catch (error) {
    console.error("POST /api/cron/audit-listing-images failed", error);
    return NextResponse.json(
      { error: "Failed to audit listing images" },
      { status: 500 },
    );
  }
}

export const GET = POST;
