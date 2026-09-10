import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * Published listings per category, rolled up through the tree so a top-level
 * category reports everything underneath it rather than only the handful of
 * listings filed directly against the parent. Depth is not assumed — the
 * recursive term walks `parent_id` for as many levels as exist.
 */
const CATEGORY_COUNTS_CTE = `
  WITH RECURSIVE tree AS (
    SELECT id AS root_id, id FROM categories
    UNION ALL
    SELECT t.root_id, c.id FROM categories c JOIN tree t ON c.parent_id = t.id
  ),
  counts AS (
    SELECT t.root_id, COUNT(l.id)::int AS listing_count
    FROM tree t
    LEFT JOIN listings l ON l.category_id = t.id AND l.status = 'published'
    GROUP BY t.root_id
  )
`;

/**
 * GET /api/mobile/v1/categories
 *
 * Reference data for filter/category pickers. `value` is the stringified integer
 * id (contract section 1, IDs) - not the slug. Mirrors `app/api/categories`.
 *
 * `?type=event|listing|both` filters by `category_type`, matching a row whose
 * `category_type` equals the requested value or is `'both'`. Omitted (default)
 * keeps the original unfiltered behavior so existing callers are unaffected.
 *
 * `listingCount` is additive: Home's category index labels each row with how
 * many places sit under it, which is the whole reason that block can drop the
 * icons. Clients that only need the picker can ignore it.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");
  const type =
    rawType === "event" || rawType === "listing" || rawType === "both"
      ? rawType
      : null;

  let data;
  try {
    const { rows } = type
      ? await query(
          `${CATEGORY_COUNTS_CTE}
           SELECT c.id, c.name, c.slug, c.parent_id, c.icon_name,
                  COALESCE(ct.listing_count, 0) AS listing_count
           FROM categories c
           LEFT JOIN counts ct ON ct.root_id = c.id
           WHERE c.category_type = $1 OR c.category_type = 'both'
           ORDER BY c.name ASC`,
          [type],
        )
      : await query(
          `${CATEGORY_COUNTS_CTE}
           SELECT c.id, c.name, c.slug, c.parent_id, c.icon_name,
                  COALESCE(ct.listing_count, 0) AS listing_count
           FROM categories c
           LEFT JOIN counts ct ON ct.root_id = c.id
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

  const categories = (data ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
    slug: c.slug,
    parentId: c.parent_id != null ? String(c.parent_id) : null,
    iconName: c.icon_name,
    listingCount: Number(c.listing_count ?? 0),
  }));

  return ok(categories, undefined, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
    },
  });
});
