import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/redemptions/:id
 * Caller must be the redeeming user or the listing owner (or admin).
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new MobileApiError("validation_error", "Invalid redemption id.", 400);
  }

  const { rows } = await query(
    `SELECT r.id, r.user_id, r.listing_id, r.deal_id, r.owner_id, r.status, r.code,
            r.code_expires_at, r.bill_value, r.discount_value, r.currency,
            r.void_reason, r.created_at, r.validated_at, r.voided_at,
            l.name AS listing_name, d.discount_value AS deal_discount
     FROM public.redemptions r
     INNER JOIN listings l ON l.id = r.listing_id
     LEFT JOIN deals d ON d.id = r.deal_id
     WHERE r.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    throw new MobileApiError("not_found", "Redemption not found.", 404);
  }

  const isOwner =
    row.user_id === user.id ||
    row.owner_id === user.id ||
    user.role === "admin" ||
    user.role === "super_admin";
  if (!isOwner) {
    throw new MobileApiError("forbidden", "Not allowed to view this redemption.", 403);
  }

  // Auto-expire pending codes past TTL (soft status update).
  if (
    row.status === "pending" &&
    row.code_expires_at &&
    new Date(row.code_expires_at).getTime() < Date.now()
  ) {
    await query(
      `UPDATE public.redemptions SET status = 'expired' WHERE id = $1 AND status = 'pending'`,
      [id],
    );
    row.status = "expired";
  }

  return ok({
    id: row.id,
    status: row.status,
    code: row.user_id === user.id || row.owner_id === user.id ? row.code : undefined,
    expiresAt: row.code_expires_at,
    listingId: Number(row.listing_id),
    dealId: row.deal_id != null ? Number(row.deal_id) : null,
    listingName: row.listing_name,
    discountLabel: row.deal_discount,
    billValue: row.bill_value != null ? Number(row.bill_value) : null,
    discountValue: row.discount_value != null ? Number(row.discount_value) : null,
    currency: row.currency,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    validatedAt: row.validated_at,
    voidedAt: row.voided_at,
  });
});
