import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(64),
  eventId: z.number().int().positive(),
});

/**
 * POST /api/mobile/v1/coupons/validate
 *
 * Read-only preview for the checkout "Apply Offer" input - checks a coupon
 * against the same scope/window/usage rules `create_booking_with_reservation`
 * enforces, but takes no row lock and redeems nothing. It returns the raw
 * discount parameters rather than a computed amount (this endpoint has no
 * cart total) - the client computes the preview locally with the same
 * percentage/fixed/cap math the RPC uses, then the RPC re-validates and
 * redeems authoritatively at actual booking time. A coupon that passes here
 * can still be rejected there (e.g. another checkout exhausts the last
 * redemption in between) - that's expected, not a bug.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A coupon code and eventId are required.",
      400,
    );
  }
  const { code, eventId } = parsed.data;

  const { rows } = await query(
    `SELECT id, code, discount_type, discount_value, max_discount_amount, usage_limit, usage_count, per_user_limit
     FROM coupons
     WHERE code = $1
       AND is_active = true
       AND (event_id IS NULL OR event_id = $2)
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())`,
    [code, eventId],
  );
  const coupon = rows[0];
  if (!coupon) {
    throw new MobileApiError(
      "coupon_invalid",
      "This coupon code is invalid or has expired.",
      400,
      "code",
    );
  }

  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    throw new MobileApiError(
      "coupon_invalid",
      "This coupon has reached its usage limit.",
      400,
      "code",
    );
  }

  const { rows: usageRows } = await query(
    `SELECT COUNT(*)::int AS count FROM bookings
     WHERE user_id = $1 AND coupon_id = $2 AND payment_status IN ('awaiting_payment', 'paid')`,
    [user.id, coupon.id],
  );
  const userUsageCount = Number(usageRows[0]?.count ?? 0);
  if (userUsageCount >= coupon.per_user_limit) {
    throw new MobileApiError(
      "coupon_invalid",
      "You've already used this coupon.",
      400,
      "code",
    );
  }

  return ok({
    valid: true,
    coupon: {
      code: coupon.code as string,
      // discount_value/max_discount_amount are `numeric` - pg returns them
      // as strings, not numbers.
      discount_type: coupon.discount_type as "percentage" | "fixed",
      discount_value: Number(coupon.discount_value),
      max_discount_amount:
        coupon.max_discount_amount != null ? Number(coupon.max_discount_amount) : null,
    },
  });
});
