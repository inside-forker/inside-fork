import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * Published listings and events per category, rolled up through the tree so a top-level
 * category reports everything underneath it.
 * Depth is not assumed — the recursive term walks `parent_id` for as many levels as exist.
 */
const CATEGORY_COUNTS_CTE = `
  WITH RECURSIVE tree AS (
    SELECT id AS root_id, id FROM categories
    UNION ALL
    SELECT t.root_id, c.id FROM categories c JOIN tree t ON c.parent_id = t.id
  ),
  distinct_listings AS (
    SELECT id AS listing_id, category_id
    FROM listings
    WHERE status = 'published' AND category_id IS NOT NULL
    UNION
    SELECT l.id AS listing_id, lc.category_id
    FROM listings l
    JOIN listing_categories lc ON lc.listing_id = l.id
    WHERE l.status = 'published' AND lc.category_id IS NOT NULL
  ),
  distinct_events AS (
    SELECT id AS event_id, category_id
    FROM events
    WHERE status = 'published' AND end_time >= NOW()
  ),
  counts AS (
    SELECT
      t.root_id,
      COUNT(DISTINCT dl.listing_id)::int AS listing_count,
      COUNT(DISTINCT de.event_id)::int AS event_count
    FROM tree t
    LEFT JOIN distinct_listings dl ON dl.category_id = t.id
    LEFT JOIN distinct_events de ON de.category_id = t.id
    GROUP BY t.root_id
  )
`;

/**
 * GET /api/mobile/v1/categories
 *
 * Reference data for filter/category pickers. `value` is the stringified integer
 * id (contract section 1, IDs) - not the slug. Mirrors `app/api/categories`.
 *
 * Excludes subcategories and parent categories that have 0 published listings/events (archived).
 *
 * `?type=event|listing|both` filters by `category_type`, matching a row whose
 * `category_type` equals the requested value or is `'both'`. Omitted (default)
 * keeps the original unfiltered behavior so existing callers are unaffected.
 */
type CategoryResult = {
  value: string;
  label: string;
  slug: string;
  parentId: string | null;
  iconName: string | null;
  listingCount: number;
};

const categoryCache = new Map<string, { timestamp: number; data: CategoryResult[] }>();
const CACHE_TTL_MS = 5_000;

export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");
  const type =
    rawType === "event" || rawType === "listing" || rawType === "both"
      ? rawType
      : null;

  const cacheKey = type ?? "all";
  const cached = categoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return ok(cached.data, undefined, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }

  let data;
  try {
    const { rows } = type
      ? await query(
          `${CATEGORY_COUNTS_CTE}
           SELECT c.id, c.name, c.slug, c.parent_id, c.icon_name,
                  COALESCE(ct.listing_count, 0) AS listing_count,
                  COALESCE(ct.event_count, 0) AS event_count
           FROM categories c
           LEFT JOIN counts ct ON ct.root_id = c.id
           WHERE c.is_enabled = true
             AND (c.category_type = $1 OR c.category_type = 'both')
             AND (
               COALESCE(ct.listing_count, 0) > 0
               OR (c.category_type IN ('event', 'both') AND COALESCE(ct.event_count, 0) > 0)
             )
           ORDER BY c.name ASC`,
          [type],
        )
      : await query(
          `${CATEGORY_COUNTS_CTE}
           SELECT c.id, c.name, c.slug, c.parent_id, c.icon_name,
                  COALESCE(ct.listing_count, 0) AS listing_count,
                  COALESCE(ct.event_count, 0) AS event_count
           FROM categories c
           LEFT JOIN counts ct ON ct.root_id = c.id
           WHERE c.is_enabled = true
             AND (
               COALESCE(ct.listing_count, 0) > 0
               OR (c.category_type IN ('event', 'both') AND COALESCE(ct.event_count, 0) > 0)
             )
           ORDER BY c.name ASC`,
        );
    data = rows;
  } catch (error) {
    console.error(
      "[mobile-api] categories query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to load categories.",
      500,
    );
  }

  const categories: CategoryResult[] = (data ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
    slug: c.slug,
    parentId: c.parent_id != null ? String(c.parent_id) : null,
    iconName: c.icon_name,
    listingCount: Number(c.listing_count ?? 0),
  }));

  categoryCache.set(cacheKey, { timestamp: Date.now(), data: categories });

  return ok(categories, undefined, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
});
