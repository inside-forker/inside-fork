import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import { estimateDiscountValue } from "@/lib/redemptions/discount";
import { emitRedemptionAnalytics } from "@/lib/redemptions/analytics";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  code: z.string().min(3).max(32),
});

const validateSchema = z.object({
  code: z.string().min(3).max(32),
  billValue: z.coerce.number().positive().max(10_000_000),
  discountValue: z.coerce.number().nonnegative().max(10_000_000).optional(),
});

async function isPlatformStaff(userId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT role, active_role FROM profiles WHERE id = $1`,
    [userId],
  );
  const profile = rows[0];
  if (!profile) return false;
  const effective = profile.active_role || profile.role;
  return effective === "admin" || effective === "super_admin";
}

/**
 * GET /api/business/redemptions?code=RD-...
 * Merchants: own listings only. Admin / super_admin: any listing.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const staff = await isPlatformStaff(userId);
    const codeRaw = new URL(request.url).searchParams.get("code");
    const parsed = lookupSchema.safeParse({ code: codeRaw });
    if (!parsed.success) {
      return apiError("code query param is required", 400);
    }
    const code = parsed.data.code.toUpperCase().trim();

    const { rows } = await query(
      staff
        ? `SELECT r.id, r.status, r.code, r.code_expires_at, r.listing_id, r.deal_id,
                r.bill_value, r.discount_value, r.created_at,
                l.name AS listing_name, d.discount_value AS deal_discount,
                p.full_name AS user_name
         FROM public.redemptions r
         INNER JOIN listings l ON l.id = r.listing_id
         LEFT JOIN deals d ON d.id = r.deal_id
         LEFT JOIN profiles p ON p.id = r.user_id
         WHERE r.code = $1`
        : `SELECT r.id, r.status, r.code, r.code_expires_at, r.listing_id, r.deal_id,
                r.bill_value, r.discount_value, r.created_at,
                l.name AS listing_name, d.discount_value AS deal_discount,
                p.full_name AS user_name
         FROM public.redemptions r
         INNER JOIN listings l ON l.id = r.listing_id
         LEFT JOIN deals d ON d.id = r.deal_id
         LEFT JOIN profiles p ON p.id = r.user_id
         WHERE r.code = $1 AND (r.owner_id = $2 OR l.owner_id = $2)`,
      staff ? [code] : [code, userId],
    );
    const row = rows[0];
    if (!row) {
      return apiError(
        staff
          ? "Redemption not found"
          : "Redemption not found for your listings",
        404,
      );
    }

    if (
      row.status === "pending" &&
      row.code_expires_at &&
      new Date(row.code_expires_at).getTime() < Date.now()
    ) {
      await query(
        `UPDATE public.redemptions SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
        [row.id],
      );
      row.status = "expired";
    }

    return apiSuccess({
      id: row.id,
      status: row.status,
      code: row.code,
      expiresAt: row.code_expires_at,
      listingId: Number(row.listing_id),
      dealId: row.deal_id != null ? Number(row.deal_id) : null,
      listingName: row.listing_name,
      discountLabel: row.deal_discount,
      userName: row.user_name,
      billValue: row.bill_value != null ? Number(row.bill_value) : null,
      discountValue:
        row.discount_value != null ? Number(row.discount_value) : null,
      createdAt: row.created_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/business/redemptions
 * Validate by code + required bill_value.
 * Admin / super_admin may validate any listing's code.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();
    const staff = await isPlatformStaff(userId);
    const body = await request.json().catch(() => null);
    const parsed = validateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("code and billValue are required", 400);
    }

    const code = parsed.data.code.toUpperCase().trim();
    const { rows } = await query(
      `SELECT r.*, d.discount_value AS deal_discount, l.owner_id AS listing_owner_id
       FROM public.redemptions r
       INNER JOIN listings l ON l.id = r.listing_id
       LEFT JOIN deals d ON d.id = r.deal_id
       WHERE r.code = $1`,
      [code],
    );
    const row = rows[0];
    if (!row) {
      return apiError("Redemption not found", 404);
    }
    if (
      !staff &&
      row.owner_id !== userId &&
      row.listing_owner_id !== userId
    ) {
      return apiError("You do not own this listing", 403);
    }
    if (row.status !== "pending") {
      return apiError(`Cannot validate — status is ${row.status}`, 409);
    }
    if (
      row.code_expires_at &&
      new Date(row.code_expires_at).getTime() < Date.now()
    ) {
      await query(
        `UPDATE public.redemptions SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
        [row.id],
      );
      return apiError("This redemption code has expired", 409);
    }

    const billValue = parsed.data.billValue;
    const discountValue =
      parsed.data.discountValue ??
      estimateDiscountValue(billValue, row.deal_discount as string | null);
    const keepOwnerId =
      (row.owner_id as string | null) ??
      (row.listing_owner_id as string | null) ??
      userId;

    const { rows: updated } = await query(
      `UPDATE public.redemptions
       SET status = 'validated',
           bill_value = $2,
           discount_value = $3,
           staff_id = $4,
           channel = 'staff',
           validated_at = now(),
           owner_id = COALESCE(owner_id, $5)
       WHERE id = $1 AND status = 'pending'
       RETURNING id, status, bill_value, discount_value, currency, validated_at,
                 user_id, listing_id, deal_id, session_id, source_context, device_id`,
      [row.id, billValue, discountValue, userId, keepOwnerId],
    );
    const redemption = updated[0];
    if (!redemption) {
      return apiError("Could not validate — status changed", 409);
    }

    await emitRedemptionAnalytics({
      eventName: "offer_redeemed",
      userId: redemption.user_id as string,
      sessionId: redemption.session_id as string | null,
      sourceContext: (redemption.source_context as string | null) ?? "redeem",
      deviceId: redemption.device_id as string | null,
      screen: staff ? "admin_redeem_validate" : "business_redeem_validate",
      platform: "web",
      context: {
        redemptionId: redemption.id,
        dealId: redemption.deal_id,
        listingId: redemption.listing_id,
        billValue: Number(redemption.bill_value),
        discountValue:
          redemption.discount_value != null
            ? Number(redemption.discount_value)
            : null,
        staffId: userId,
        channel: "staff",
        platformStaff: staff,
      },
    });

    return apiSuccess({
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
  } catch (error) {
    return handleApiError(error);
  }
}
