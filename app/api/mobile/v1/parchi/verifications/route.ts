import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileErrors } from "@/lib/mobile/errors";
import { startParchiVerification } from "@/lib/parchi/service";
import { toMobileApiError } from "@/lib/parchi/http";

export const dynamic = "force-dynamic";

const ROUTE = "/api/mobile/v1/parchi/verifications";

const bodySchema = z.object({
  event_id: z.number().int().positive(),
  parchi_id: z.string().min(1).max(20),
});

/**
 * POST /api/mobile/v1/parchi/verifications
 *
 * Starts (or resends - same call) a Parchi student verification. Show the
 * returned `match_code` large ("Tap 37 in your Parchi app") and a QR of
 * `verify_web_link`, then poll GET .../{id}. Pass `id` as
 * `parchi_verification_id` to POST /checkout once `status` is `approved`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw MobileErrors.badRequest("event_id and parchi_id are required.");
  }

  try {
    const view = await startParchiVerification({
      userId: user.id,
      eventId: parsed.data.event_id,
      parchiId: parsed.data.parchi_id,
      route: ROUTE,
    });
    return ok(view, undefined, { status: 201 });
  } catch (err) {
    throw toMobileApiError(err);
  }
});
