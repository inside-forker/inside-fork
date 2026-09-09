import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  getZeroResultRollup,
  refreshSearchZeroResultsDaily,
} from "@/lib/analytics/search-zero-results";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/admin/refresh-search-zero-results
 * Admin-only: rebuild the daily zero-result rollup (also callable from cron).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new MobileApiError("forbidden", "Admin only.", 403);
  }
  const result = await refreshSearchZeroResultsDaily(30);
  return ok(result);
});

/**
 * GET /api/mobile/v1/admin/search-zero-results?days=30
 * Admin-only: top zero-result queries from the rollup.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  if (user.role !== "admin" && user.role !== "super_admin") {
    throw new MobileApiError("forbidden", "Admin only.", 403);
  }
  const daysRaw = new URL(request.url).searchParams.get("days");
  const days = daysRaw && /^\d+$/.test(daysRaw) ? Math.min(90, parseInt(daysRaw, 10)) : 30;
  const rows = await getZeroResultRollup(days, 50);
  return ok({ days, queries: rows });
});
