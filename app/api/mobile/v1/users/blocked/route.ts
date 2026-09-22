import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { listBlockedUsers } from "@/lib/blocks/create-block";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/users/blocked?page=&limit=
 *
 * Paginated list of users the caller has blocked, newest first. Each row's
 * `id` is the opaque `blocked_users` row id (used to unblock), not the
 * target user's profile id.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const { rows, total } = await listBlockedUsers(user.id, limit, offset);

  return ok(rows, {
    pagination: buildPaginationMeta(page, limit, total),
  });
});
