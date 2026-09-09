import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { estimateDiscountValue } from "@/lib/redemptions/discount";
import { emitRedemptionAnalytics } from "@/lib/redemptions/analytics";

export const dynamic = "force-dynamic";

const validateSchema = z.object({
  billValue: z.coerce.number().positive().max(10_000_000),
  discountValue: z.coerce.number().nonnegative().max(10_000_000).optional(),
  channel: z.enum(["in_app", "staff"]).optional(),
});

/**
 * POST /api/mobile/v1/redemptions/:id/validate
 * Merchant/staff confirms redemption; bill_value is required for GMV.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new MobileApiError("validation_error", "Invalid redemption id.", 400);
  }

  const parsed = validateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "billValue is required and must be a positive number.",
      400,
      "billValue",
    );
  }

  const { rows } = await query(
    `SELECT r.*, d.discount_value AS deal_discount
     FROM public.redemptions r
     LEFT JOIN deals d ON d.id = r.deal_id
     WHERE r.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    throw new MobileApiError("not_found", "Redemption not found.", 404);
  }

  // business_owner role alone is not enough — must own this listing
  if (
    row.owner_id !== user.id &&
    user.role !== "admin" &&
    user.role !== "super_admin"
  ) {
    throw new MobileApiError(
      "forbidden",
      "Only the listing owner can validate this redemption.",
      403,
    );
  }

  if (row.status === "validated") {
    throw new MobileApiError("conflict", "Already validated.", 409);
  }
  if (row.status === "voided") {
    throw new MobileApiError("conflict", "This redemption was voided.", 409);
  }
  if (row.status === "expired") {
    throw new MobileApiError("conflict", "This redemption code has expired.", 409);
  }
  if (
    row.status === "pending" &&
    row.code_expires_at &&
    new Date(row.code_expires_at).getTime() < Date.now()
  ) {
    await query(
      `UPDATE public.redemptions SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
      [id],
    );
    throw new MobileApiError("conflict", "This redemption code has expired.", 409);
  }

  const billValue = parsed.data.billValue;
  const discountValue =
    parsed.data.discountValue ??
    estimateDiscountValue(billValue, row.deal_discount as string | null) ??
    null;

  const { rows: updated } = await query(
    `UPDATE public.redemptions
     SET status = 'validated',
         bill_value = $2,
         discount_value = $3,
         staff_id = $4,
         channel = COALESCE($5, channel),
         validated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, status, bill_value, discount_value, currency, validated_at, user_id,
               listing_id, deal_id, session_id, source_context, device_id`,
    [
      id,
      billValue,
      discountValue,
      user.id,
      parsed.data.channel ?? null,
    ],
  );
  const redemption = updated[0];
  if (!redemption) {
    throw new MobileApiError("conflict", "Could not validate — status changed.", 409);
  }

  await emitRedemptionAnalytics({
    eventName: "offer_redeemed",
    userId: redemption.user_id as string,
    sessionId: redemption.session_id as string | null,
    sourceContext: (redemption.source_context as string | null) ?? "redeem",
    deviceId: redemption.device_id as string | null,
    screen: "redeem_validate",
    platform: "mobile",
    context: {
      redemptionId: redemption.id,
      dealId: redemption.deal_id,
      listingId: redemption.listing_id,
      billValue: Number(redemption.bill_value),
      discountValue:
        redemption.discount_value != null
          ? Number(redemption.discount_value)
          : null,
      staffId: user.id,
    },
  });

  return ok({
    id: redemption.id,
    status: redemption.status,
    billValue: Number(redemption.bill_value),
    discountValue:
      redemption.discount_value != null
        ? Number(redemption.discount_value)
        : null,
    currency: redemption.currency,
    validatedAt: redemption.validated_at,
  });
});
