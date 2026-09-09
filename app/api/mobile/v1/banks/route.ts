import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/banks
 *
 * Bank reference data for deal/bank pickers. `value` is the stringified integer
 * id (contract section 1). Mirrors `app/api/banks`; `banks` is anon-readable by RLS
 * (the website route uses an authed client, but anon read is permitted).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  let data;
  try {
    const { rows } = await query(
      `SELECT id, name, logo_url, code FROM banks ORDER BY name ASC`,
    );
    data = rows;
  } catch (error) {
    console.error(
      "[mobile-api] banks query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load banks.", 500);
  }

  const banks = (data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
    code: b.code,
    logoUrl: b.logo_url,
  }));

  return ok(banks, undefined, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
});

