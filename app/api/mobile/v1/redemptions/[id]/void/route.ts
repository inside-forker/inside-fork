import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { emitRedemptionAnalytics } from "@/lib/redemptions/analytics";

export const dynamic = "force-dynamic";

const voidSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * POST /api/mobile/v1/redemptions/:id/void
 * Never delete — void with a reason (merchant or redeeming user while pending).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new MobileApiError("validation_error", "Invalid redemption id.", 400);
  }

  const parsed = voidSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A void reason is required.",
      400,
      "reason",
    );
  }

  const { rows } = await query(
    `SELECT * FROM public.redemptions WHERE id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    throw new MobileApiError("not_found", "Redemption not found.", 404);
  }

  const isAdmin = user.role === "admin" || user.role === "super_admin";
  const isListingOwner = row.owner_id === user.id;
  const isRedeemer = row.user_id === user.id;

  if (!isAdmin && !isListingOwner && !isRedeemer) {
    throw new MobileApiError("forbidden", "Not allowed to void this redemption.", 403);
  }

  if (row.status === "voided") {
    return ok({ id: row.id, status: "voided", voidReason: row.void_reason });
  }
  if (row.status === "expired") {
    throw new MobileApiError("conflict", "Expired redemptions cannot be voided.", 409);
  }
  // Redeeming user may only cancel while still pending
  if (isRedeemer && !isListingOwner && !isAdmin && row.status !== "pending") {
    throw new MobileApiError(
      "forbidden",
      "Only the merchant can void a validated redemption.",
      403,
    );
  }

  const { rows: updated } = await query(
    `UPDATE public.redemptions
     SET status = 'voided', void_reason = $2, voided_at = now(), staff_id = COALESCE(staff_id, $3)
     WHERE id = $1 AND status IN ('pending', 'validated')
     RETURNING id, status, void_reason, voided_at, user_id, listing_id, deal_id,
               session_id, source_context, device_id, bill_value`,
    [id, parsed.data.reason, user.id],
  );
  const redemption = updated[0];
  if (!redemption) {
    throw new MobileApiError("conflict", "Could not void — status changed.", 409);
  }

  await emitRedemptionAnalytics({
    eventName: "offer_redeem_voided",
    userId: redemption.user_id as string,
    sessionId: redemption.session_id as string | null,
    sourceContext: (redemption.source_context as string | null) ?? "redeem",
    deviceId: redemption.device_id as string | null,
    screen: "redeem_void",
    platform: "mobile",
    context: {
      redemptionId: redemption.id,
      dealId: redemption.deal_id,
      listingId: redemption.listing_id,
      voidReason: parsed.data.reason,
      billValue:
        redemption.bill_value != null ? Number(redemption.bill_value) : null,
    },
  });

  return ok({
    id: redemption.id,
    status: redemption.status,
    voidReason: redemption.void_reason,
    voidedAt: redemption.voided_at,
  });
});
