import { NextRequest } from "next/server";

/**
 * Shared auth guard for the Workstream 2 nightly cron routes
 * (app/api/cron/refresh-user-scores, refresh-intelligence, refresh-segments,
 * evaluate-admin-alerts, refresh-marketplace-health, audit-listing-images, etc.). Mirrors the token-extraction logic in
 * app/api/notifications/dispatch/route.ts (Authorization: Bearer,
 * x-cron-secret header, or ?token= query param) but checks only
 * process.env.CRON_SECRET, since these routes have no route-specific token
 * override the way NOTIFICATIONS_DISPATCH_TOKEN is for the dispatch route.
 *
 * NOTE: CRON_SECRET is not currently set in .env. Until it is, every call
 * to isAuthorizedCronRequest() returns false and these routes deny all
 * requests (logging a warning) - this is intentional fail-closed behavior,
 * not a bug.
 */

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader?.length) {
    return cronHeader.trim();
  }

  const tokenParam = request.nextUrl.searchParams.get("token");
  return tokenParam ? tokenParam.trim() : null;
}

export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? null;

  if (!secret) {
    console.warn(
      "cron route: no CRON_SECRET configured - denying request"
    );
    return false;
  }

  const token = extractToken(request);
  return token === secret;
}
