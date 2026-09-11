import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import {
  generateRedemptionCode,
  REDEMPTION_CODE_TTL_MS,
} from "@/lib/redemptions/codes";
import { emitRedemptionAnalytics } from "@/lib/redemptions/analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/redemptions
 * Returns the signed-in user's redemption history, newest first.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  // Soft-expire any pending codes past TTL for this user
  try {
    await query(
      `UPDATE public.redemptions
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'pending' AND code_expires_at < NOW()`,
      [user.id],
    );
  } catch (err) {
    console.error("[mobile-api] soft-expire redemptions failed:", err);
  }

  const { rows } = await query(
    `SELECT r.id, r.status, r.code, r.code_expires_at, r.bill_value,
            r.discount_value, r.currency, r.void_reason, r.created_at,
            r.validated_at, r.voided_at, r.listing_id, r.deal_id,
            l.name AS listing_name, l.slug AS listing_slug,
            d.title AS deal_title, d.discount_value AS deal_discount,
            COUNT(*) OVER() AS total_count
     FROM public.redemptions r
     INNER JOIN listings l ON l.id = r.listing_id
     LEFT JOIN deals d ON d.id = r.deal_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [user.id, limit, offset],
  );

  const total = Number(rows[0]?.total_count ?? 0);
  const redemptions = rows.map((row) => ({
    id: row.id,
    status: row.status,
    code: row.code,
    expiresAt: row.code_expires_at,
    listingId: Number(row.listing_id),
    listingName: row.listing_name,
    listingSlug: row.listing_slug,
    dealId: row.deal_id != null ? Number(row.deal_id) : null,
    dealTitle: row.deal_title,
    discountLabel: row.deal_discount,
    billValue: row.bill_value != null ? Number(row.bill_value) : null,
    discountValue: row.discount_value != null ? Number(row.discount_value) : null,
    currency: row.currency || "PKR",
    voidReason: row.void_reason,
    createdAt: row.created_at,
    validatedAt: row.validated_at,
    voidedAt: row.voided_at,
  }));

  return ok(redemptions, {
    pagination: buildPaginationMeta(page, limit, total),
  });
});


const startSchema = z.object({
  dealId: z.coerce.number().int().positive(),
  listingId: z.coerce.number().int().positive().optional(),
  sessionId: z.string().max(256).optional(),
  sourceContext: z.string().max(128).optional(),
  deviceId: z.string().max(256).optional(),
});

/**
 * POST /api/mobile/v1/redemptions
 * User starts an in-app redeem; returns short-lived code for merchant validation.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = startSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "dealId is required.",
      400,
      "dealId",
    );
  }

  const { dealId, sessionId, sourceContext, deviceId } = parsed.data;

  const { rows: dealRows } = await query(
    `SELECT d.id, d.listing_id, d.discount_value, d.is_active, d.start_date, d.end_date,
            l.owner_id, l.name AS listing_name, l.status AS listing_status
     FROM deals d
     INNER JOIN listings l ON l.id = d.listing_id
     WHERE d.id = $1`,
    [dealId],
  );
  const deal = dealRows[0];
  if (!deal) {
    throw new MobileApiError("not_found", "Deal not found.", 404);
  }
  if (!deal.is_active || deal.listing_status !== "published") {
    throw new MobileApiError(
      "validation_error",
      "This deal is not currently available.",
      400,
    );
  }
  const now = Date.now();
  if (deal.start_date && new Date(deal.start_date).getTime() > now) {
    throw new MobileApiError("validation_error", "This deal has not started yet.", 400);
  }
  if (deal.end_date && new Date(deal.end_date).getTime() < now) {
    throw new MobileApiError("validation_error", "This deal has expired.", 400);
  }

  const listingId = Number(deal.listing_id);
  if (
    parsed.data.listingId != null &&
    Number(parsed.data.listingId) !== listingId
  ) {
    throw new MobileApiError(
      "validation_error",
      "listingId does not match this deal.",
      400,
      "listingId",
    );
  }

  const code = generateRedemptionCode();
  const expiresAt = new Date(Date.now() + REDEMPTION_CODE_TTL_MS);

  const { rows } = await query(
    `INSERT INTO public.redemptions
       (user_id, listing_id, deal_id, owner_id, status, code, code_expires_at,
        channel, session_id, source_context, device_id)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, 'in_app', $7, $8, $9)
     RETURNING id, code, status, code_expires_at, listing_id, deal_id, created_at`,
    [
      user.id,
      listingId,
      dealId,
      deal.owner_id ?? null,
      code,
      expiresAt.toISOString(),
      sessionId ?? null,
      sourceContext ?? "deals",
      deviceId ?? null,
    ],
  );
  const redemption = rows[0];

  await emitRedemptionAnalytics({
    eventName: "offer_redeem_started",
    userId: user.id,
    sessionId,
    sourceContext: sourceContext ?? "deals",
    deviceId,
    screen: "redeem",
    platform: "mobile",
    context: {
      redemptionId: redemption.id,
      dealId,
      listingId,
      code,
    },
  });

  return ok({
    id: redemption.id,
    code: redemption.code,
    status: redemption.status,
    expiresAt: redemption.code_expires_at,
    listingId: Number(redemption.listing_id),
    dealId: Number(redemption.deal_id),
    listingName: deal.listing_name as string,
    discountLabel: (deal.discount_value as string | null) ?? null,
    createdAt: redemption.created_at,
  });
});
