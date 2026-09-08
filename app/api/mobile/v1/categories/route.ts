import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/categories
 *
 * Reference data for filter/category pickers. `value` is the stringified integer
 * id (contract section 1, IDs) - not the slug. Mirrors `app/api/categories`.
 *
 * `?type=event|listing|both` filters by `category_type`, matching a row whose
 * `category_type` equals the requested value or is `'both'`. Omitted (default)
 * keeps the original unfiltered behavior so existing callers are unaffected.
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
          `SELECT id, name, slug, parent_id, icon_name FROM categories
           WHERE category_type = $1 OR category_type = 'both'
           ORDER BY name ASC`,
          [type],
        )
      : await query(
          `SELECT id, name, slug, parent_id, icon_name FROM categories ORDER BY name ASC`,
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
  }));

  return ok(categories);
});
