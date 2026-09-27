import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { RESUME_WINDOW_MINUTES } from "@/lib/checkout/resume";
import {
  fetchPayFastToken,
  generatePayFastFormFields,
  formatPayFastOrderDate,
  formatPayFastMobile,
  getPayFastTransactionUrl,
  getPayFastTokenGeneratedAt,
  getPayFastRedirectUrls,
  isPayFastConfigured,
} from "@/lib/payments/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  basketId: z.string().min(1), // the booking_reference (see below)
  // Optional, and derived from the booking row when absent. Kept in the schema
  // (rather than removed) so installs shipped before the resume flow, which
  // always send them, keep working. The resume path deliberately sends neither
  // - it holds no buyer PII on the device to send.
  customerMobile: z.string().min(1).max(40).optional(),
  customerEmail: z.string().email().optional(),
  transactionDescription: z.string().max(255).optional().default("Checkout"),
});

/**
 * POST /api/mobile/v1/payments/token
 *
 * Builds the server-signed PayFast form fields for a booking. The client sends
 * its `booking_reference` as `basketId`; we resolve the booking (owner-scoped
 * in-query -> 404) and pass the booking's STORED `basket_id` (a hash) to PayFast,
 * so the eventual server-to-server callback - which finds the booking by
 * `basket_id` - resolves. Amount is derived from the DB (client amount ignored).
 * No service role needed (the caller reads its own booking via RLS). Mirrors
 * `app/api/payment/payfast/token`.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A valid basketId is required.",
      400,
      parsed.error.errors[0]?.path.join(".") || undefined,
    );
  }
  const { basketId, transactionDescription } = parsed.data;

  const { rows: bookingRows } = await query(
    `SELECT id, total_amount, basket_id, payment_status, status, expires_at,
            customer_email, customer_phone,
            to_json(created_at) #>> '{}' AS created_at
     FROM bookings WHERE booking_reference = $1 AND user_id = $2`,
    [basketId, user.id],
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }
  if (booking.payment_status === "paid") {
    throw new MobileApiError(
      "already_paid",
      "This booking has already been paid.",
      400,
    );
  }
  if (booking.payment_status === "refunded") {
    throw new MobileApiError(
      "booking_refunded",
      "This booking has been refunded and cannot be paid again.",
      400,
    );
  }
  if (booking.status === "cancelled") {
    throw new MobileApiError(
      "booking_cancelled",
      "This booking has been cancelled.",
      400,
    );
  }
  // Gated on `created_at`, NOT `expires_at`. The payment hold lapsing is
  // exactly the state resume exists to repair - refusing here on `expires_at`
  // is what made the old flow tell users to "resume it before paying" while
  // resume-payment simultaneously refused to resume it.
  const createdAtMs = Date.parse(booking.created_at);
  if (
    Number.isNaN(createdAtMs) ||
    Date.now() - createdAtMs > RESUME_WINDOW_MINUTES * 60_000
  ) {
    throw new MobileApiError(
      "resume_window_lapsed",
      "This booking has expired. Please pick your tickets again.",
      410,
    );
  }

  // Buyer contact details come from the booking row the server already holds,
  // so the client never has to keep (or resend) that PII. The request body is
  // only a fallback for older installs.
  const customerEmail = (booking.customer_email as string | null) ?? parsed.data.customerEmail;
  const customerMobile = (booking.customer_phone as string | null) ?? parsed.data.customerMobile;
  if (!customerEmail || !customerMobile) {
    throw new MobileApiError(
      "validation_error",
      "This booking is missing the contact details needed for payment.",
      400,
    );
  }

  if (!booking.basket_id) {
    throw new MobileApiError(
      "internal_error",
      "Booking is not ready for payment.",
      500,
    );
  }

  if (!isPayFastConfigured()) {
    console.error("[mobile-api] PayFast is not configured (missing PAYFAST_* env).");
    throw new MobileApiError(
      "payment_not_configured",
      "Payments are not configured on this server.",
      503,
    );
  }

  const amount = Number(booking.total_amount).toFixed(2);
  const { successUrl, failureUrl, checkoutUrl, baseUrl } =
    getPayFastRedirectUrls(request);
  console.info("[mobile-api] PayFast return base", baseUrl);

  const userAgent =
    request.headers.get("user-agent") || "InsideKarachi-MobileApp/1.0";
  const fwd = request.headers.get("x-forwarded-for");
  const userIp = fwd
    ? fwd.split(",")[0].trim()
    : request.headers.get("x-real-ip") || "127.0.0.1";

  let tokenResponse;
  try {
    tokenResponse = await fetchPayFastToken(booking.basket_id, amount);
  } catch (err) {
    console.error(
      "[mobile-api] PayFast token fetch failed:",
      err instanceof Error ? err.message : err,
    );
    throw new MobileApiError(
      "payment_gateway_error",
      "Could not start the payment. Please try again.",
      502,
    );
  }

  const formFields = generatePayFastFormFields({
    token: tokenResponse.ACCESS_TOKEN,
    basketId: booking.basket_id,
    amount,
    customerMobile: formatPayFastMobile(customerMobile),
    customerEmail,
    orderDate: formatPayFastOrderDate(),
    transactionDescription,
    successUrl,
    failureUrl,
    checkoutUrl,
    userAgent,
    userIp,
  });

  return ok({
    formFields,
    transactionUrl: getPayFastTransactionUrl(),
    generatedAt: getPayFastTokenGeneratedAt(tokenResponse),
  });
});
