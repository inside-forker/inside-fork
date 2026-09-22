import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { unblockUser } from "@/lib/blocks/create-block";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/mobile/v1/users/blocked/{blockId}
 *
 * Unblocks a user by the opaque `blocked_users` row id returned from
 * GET /users/blocked. Scoped to the caller - `unblockUser` only deletes rows
 * where `blocker_id` matches, so one user can't unblock another's relationship.
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const blockId = parsePathId((await params).blockId, "blockId");
  const { user } = await requireMobileUser(request);

  const removed = await unblockUser(blockId, user.id);
  if (!removed) {
    throw new MobileApiError("not_found", "Block not found.", 404);
  }

  return ok({ unblocked: true });
});
