import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileErrors } from "@/lib/mobile/errors";
import { getParchiOffer } from "@/lib/parchi/service";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/parchi/offer?event_id=123
 *
 * The Parchi student discount for this event (`offer: null` when there is
 * none) - drives whether checkout shows the "Student? Verify with Parchi" row.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const eventId = Number(request.nextUrl.searchParams.get("event_id"));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw MobileErrors.badRequest("event_id is required.", "event_id");
  }
  return ok({ offer: await getParchiOffer(eventId) });
});
