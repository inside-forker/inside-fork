/**
 * PayFast Token API Route
 *
 * POST /api/payment/payfast/token
 *
 * Generates complete PayFast form fields (server-side only).
 * This keeps the SECURED_KEY and crypto operations on the server.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchPayFastToken,
  generatePayFastFormFields,
  formatPayFastOrderDate,
  formatPayFastMobile,
  getPayFastTransactionUrl,
  getPayFastTokenGeneratedAt,
  getPayFastRedirectUrls,
} from "@/lib/payments/payfast";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { RESUME_WINDOW_MINUTES } from "@/lib/checkout/resume";
import {
  confirmBookingWithoutPayment,
  isPaymentSkipEnabled,
} from "@/lib/mobile/skip-payment";
import { z } from "zod";

// Input validation schema
const TokenRequestSchema = z.object({
  basketId: z.string().min(1, "Basket ID is required"),
  // amount is intentionally ignored - derived server-side from the DB booking
  amount: z.string().optional(),
  // Optional: derived from the booking row when absent, so a resumed payment
  // needs no buyer PII in the browser. Kept in the schema for callers that
  // still send them.
  customerMobile: z.string().min(1).optional(),
  customerEmail: z.string().email("Invalid email address").optional(),
  transactionDescription: z.string().optional().default("Checkout"),
});

export async function POST(request: NextRequest) {
  try {
    // Require authenticated session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = TokenRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { basketId, transactionDescription } = validation.data;

    // Look up booking server-side and derive amount from DB (ignore client-supplied amount)
    const { rows: bookingRows } = await query(
      `SELECT id, user_id, total_amount, payment_status, status,
              customer_email, customer_phone,
              to_json(created_at) #>> '{}' AS created_at
         FROM bookings WHERE basket_id = $1`,
      [basketId],
    );
    const booking = bookingRows[0];

    if (!booking) {
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    if (booking.user_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    // This route previously had NO state guards at all - it would happily mint
    // a fresh PayFast token for an already-paid booking.
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { success: true, skipped: true, bookingId: booking.id },
      );
    }
    if (booking.payment_status === "refunded") {
      return NextResponse.json(
        { success: false, error: "This booking has been refunded" },
        { status: 400 },
      );
    }
    if (booking.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: "This booking has been cancelled" },
        { status: 400 },
      );
    }

    // Local/review: confirm without PayFast (also covers resumed unpaid bookings).
    const isFreeOrder = Number(booking.total_amount) === 0;
    if (isFreeOrder || isPaymentSkipEnabled()) {
      const { rows: payRows } = await query(
        `SELECT id FROM payments WHERE booking_id = $1 AND gateway_code = 'payfast'`,
        [booking.id],
      );
      if (payRows.length === 0) {
        await query(
          `INSERT INTO payments (booking_id, gateway_code, amount, currency, status, normalized_status)
           VALUES ($1, 'payfast', $2, 'PKR', 'AWAITING_DETAILS', 'awaiting_payment')`,
          [booking.id, booking.total_amount],
        );
      }
      await confirmBookingWithoutPayment(
        Number(booking.id),
        isFreeOrder ? "free_order" : "payment_skipped",
      );
      return NextResponse.json(
        { success: true, skipped: true, bookingId: booking.id },
      );
    }

    // Keyed on `created_at`, matching the resume window - see lib/checkout/resume.
    const createdAtMs = Date.parse(booking.created_at);
    if (
      Number.isNaN(createdAtMs) ||
      Date.now() - createdAtMs > RESUME_WINDOW_MINUTES * 60_000
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This booking has expired. Please pick your tickets again.",
        },
        { status: 410 },
      );
    }

    let customerEmail =
      (booking.customer_email as string | null) || validation.data.customerEmail || session.email;
    let customerMobile =
      (booking.customer_phone as string | null) || validation.data.customerMobile;

    if (!customerMobile) {
      const { rows: profileRows } = await query(
        `SELECT phone FROM profiles WHERE id = $1`,
        [session.userId],
      );
      if (profileRows[0]?.phone) {
        customerMobile = profileRows[0].phone;
      }
    }

    if (!customerEmail || !customerMobile) {
      return NextResponse.json(
        {
          success: false,
          error: "This booking is missing the contact details needed for payment",
        },
        { status: 400 },
      );
    }

    if (customerMobile && (!booking.customer_phone || !booking.customer_email)) {
      await query(
        `UPDATE bookings SET customer_phone = COALESCE(NULLIF(customer_phone, ''), $1), customer_email = COALESCE(NULLIF(customer_email, ''), $2) WHERE id = $3`,
        [customerMobile, customerEmail, booking.id],
      ).catch(() => {});
    }

    const amount = Number(booking.total_amount).toFixed(2);

    // Extract User Agent and IP address
    const userAgent =
      request.headers.get("user-agent") || "InsideKarachi-NextApp/1.0";
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const userIp = forwardedFor
      ? forwardedFor.split(",")[0].trim()
      : realIp || "127.0.0.1";

    // Debug logging (dev mode only)
    if (process.env.NEXT_DEBUG === "true") {
      console.log("[PayFast Fraud Check]", {
        userAgent,
        userIp,
        forwardedFor,
        realIp,
      });
    }

    // 2. Fetch token from PayFast API (server-to-server)
    const tokenResponse = await fetchPayFastToken(basketId, amount);

    // 3. Public return URLs — never localhost in production (PayFast redirects here)
    const { successUrl, failureUrl, checkoutUrl, baseUrl } =
      getPayFastRedirectUrls(request);
    console.info("[PayFast Token] return base", baseUrl);

    // 4. Generate complete form fields (server-side, uses crypto)
    const formFields = generatePayFastFormFields({
      token: tokenResponse.ACCESS_TOKEN,
      basketId,
      amount,
      customerMobile: formatPayFastMobile(customerMobile),
      customerEmail,
      orderDate: formatPayFastOrderDate(),
      transactionDescription,
      successUrl,
      failureUrl,
      checkoutUrl,
      userAgent, // Fraud check field
      userIp, // Fraud check field
    });

    // 5. Return ready-to-use form fields to client
    return NextResponse.json({
      success: true,
      data: {
        formFields,
        transactionUrl: getPayFastTransactionUrl(),
        generatedAt: getPayFastTokenGeneratedAt(tokenResponse),
      },
    });
  } catch (error) {
    console.error("[PayFast Token API] Error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate payment form";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
