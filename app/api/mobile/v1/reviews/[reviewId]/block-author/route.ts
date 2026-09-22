import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { blockContentAuthor } from "@/lib/blocks/create-block";

export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/v1/reviews/{reviewId}/block-author
 *
 * Blocks the author of a review - the blocker stops seeing that user's
 * reviews/comments/replies anywhere in the app. Mirrors the review report
 * route's shape (app/api/mobile/v1/reviews/[reviewId]/report/route.ts).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);

  const result = await blockContentAuthor({
    contentType: "review",
    contentId: reviewId,
    blockerId: user.id,
  });

  if (!result.success) {
    if (result.error === "not_found") {
      throw new MobileApiError("not_found", "Review not found.", 404);
    }
    if (result.error === "cannot_block_self") {
      throw new MobileApiError(
        "cannot_block_self",
        "You can't block yourself.",
        400,
      );
    }
    throw new MobileApiError(
      "already_blocked",
      "You've already blocked this user.",
      400,
    );
  }

  return ok({ blocked: true });
});
