import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { refreshParchiVerification } from "@/lib/parchi/service";
import { toMobileApiError } from "@/lib/parchi/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/parchi/verifications/{id}
 *
 * Owner-scoped status poll. Poll every 3s (5s after 30s); stop on a terminal
 * status (`approved` | `rejected` | `expired`) or a few seconds past
 * `expires_at`.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  try {
    return ok(
      await refreshParchiVerification({
        userId: user.id,
        requestId: (await params).id,
        route: "/api/mobile/v1/parchi/verifications/[id]",
      }),
    );
  } catch (err) {
    throw toMobileApiError(err);
  }
});
