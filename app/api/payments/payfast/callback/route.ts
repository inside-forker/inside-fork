import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  validatePayFastCallback,
  normalizePayFastStatus,
  type PayFastCallbackParams,
} from "@/lib/payments/payfast";
import { createNotification } from "@/lib/notifications/service";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import crypto from "crypto";

// PayFast payment webhook: validates the callback signature, updates booking payment_status,
// creates ticket passes, and notifies the user.
export async function POST(request: NextRequest) {
  try {
    // Collect callback parameters from BOTH the query string and the request
    // body. PayFast's server-to-server IPN posts result fields as a
    // form-urlencoded (or multipart) body, while the browser return URL carries
    // them on the query string. Body values take precedence when both exist.
    const url = new URL(request.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    const contentType = request.headers.get("content-type") || "";
    try {
      if (contentType.includes("application/json")) {
        const body = await request.json();
        if (body && typeof body === "object") {
          for (const [key, value] of Object.entries(body)) {
            if (value != null) {
              params[key] = String(value);
            }
          }
        }
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        for (const [key, value] of form.entries()) {
          params[key] = String(value);
        }
      }
    } catch {
      // If the body can't be parsed, fall back to query-string params only.
    }

    // Log the param KEYS (not values), joined so they're readable in Sentry/log
    // aggregators, to confirm the exact live field names on the first
    // production transaction.
    const receivedKeys = Object.keys(params);
    console.log("[PayFast Webhook] Received callback:", {
      paramKeys: receivedKeys.join(",") || "(none)",
      basket_id: params.basket_id,
      err_code: params.err_code,
      transaction_id: params.transaction_id,
    });

    // Guard malformed callbacks: empty body -> clean 400 (no Sentry noise); a populated body
    // missing expected fields is logged with its keys so parsing can be adapted.
    if (!params.basket_id || !params.err_code) {
      console.warn(
        "[PayFast Webhook] Missing basket_id/err_code. Keys:",
        receivedKeys.join(",") || "(none)",
      );
      if (receivedKeys.length > 0) {
        captureRouteError(
          new Error("PayFast callback missing basket_id/err_code"),
          {
            route: "/api/payments/payfast/callback",
            method: "POST",
            extra: { receivedKeys: receivedKeys.join(",") },
          },
        );
      }
      return NextResponse.json(
        { error: "Missing required callback parameters" },
        { status: 400 },
      );
    }

    // Validate callback signature
    const validation = validatePayFastCallback(params as PayFastCallbackParams);

    if (!validation.isValid) {
      console.error("[PayFast Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid callback signature" },
        { status: 401 },
      );
    }

    // Get normalized status
    const paymentStatus = normalizePayFastStatus(validation.errorCode);

    console.log("[PayFast Webhook] Payment status:", {
      errorCode: validation.errorCode,
      status: paymentStatus,
      basketId: validation.basketId,
    });

    // Find booking by basket_id (which is our booking_reference)
    const { rows: bookingRows } = await query(
      `SELECT id, user_id, payment_status, event_id, booking_reference, customer_name, total_amount
       FROM bookings WHERE basket_id = $1`,
      [validation.basketId],
    );
    const booking = bookingRows[0];

    if (!booking) {
      console.error(
        "[PayFast Webhook] Booking not found:",
        validation.basketId,
      );
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // If already paid, skip processing
    if (booking.payment_status === "paid") {
      console.log("[PayFast Webhook] Booking already paid, skipping");
      return NextResponse.json({
        success: true,
        message: "Booking already processed",
      });
    }

    // Verify the reported amount (and currency, if present) against the booking before confirming.
    // Fail closed: a "paid" callback we cannot amount-verify must NOT confirm the booking.
    if (paymentStatus === "paid") {
      const reportedAmountRaw =
        params.transaction_amount ??
        params.TXNAMT ??
        params.txnamt ??
        params.amount ??
        params.AMOUNT;
      const reportedAmount =
        reportedAmountRaw != null ? parseFloat(reportedAmountRaw) : NaN;
      const expectedAmount = Number(booking.total_amount ?? 0);

      if (
        !Number.isFinite(reportedAmount) ||
        Math.abs(reportedAmount - expectedAmount) > 0.01
      ) {
        console.error("[PayFast Webhook] Amount verification failed:", {
          basketId: validation.basketId,
          expectedAmount,
          reportedAmountPresent: reportedAmountRaw != null,
          paramKeys: Object.keys(params),
        });
        captureRouteError(new Error("PayFast callback amount mismatch"), {
          route: "/api/payments/payfast/callback",
          method: "POST",
          extra: {
            stage: "amount_verification",
            bookingId: booking.id,
            expectedAmount,
            reportedAmountPresent: reportedAmountRaw != null,
          },
        });
        return NextResponse.json(
          { error: "Payment amount verification failed" },
          { status: 400 },
        );
      }

      const reportedCurrency =
        params.currency || params.CURRENCY_CODE || params.currency_code;
      if (reportedCurrency && reportedCurrency.toUpperCase() !== "PKR") {
        console.error(
          "[PayFast Webhook] Currency verification failed:",
          reportedCurrency,
        );
        return NextResponse.json(
          { error: "Payment currency verification failed" },
          { status: 400 },
        );
      }
    }

    // Map PayFast status to booking status
    const bookingPaymentStatus =
      paymentStatus === "paid"
        ? "paid"
        : paymentStatus === "pending"
          ? "pending"
          : "failed";

    // Record payment event idempotently.
    // ON CONFLICT DO NOTHING means duplicate webhooks for the same transaction
    // produce no additional rows - the unique index on provider_transaction_id
    // (migration 20260311_security_payment_idempotency_index.sql) enforces this.
    if (validation.transactionId) {
      await query(
        `INSERT INTO payments
           (booking_id, gateway_code, amount, currency, status, normalized_status, provider_transaction_id, raw_request)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (provider_transaction_id) DO NOTHING`,
        [
          booking.id,
          "payfast",
          booking.total_amount ?? 0,
          "PKR",
          bookingPaymentStatus,
          bookingPaymentStatus,
          validation.transactionId,
          JSON.stringify(params),
        ],
      );
    }

    // Update booking status
    try {
      await query(
        `UPDATE bookings SET payment_status = $2, status = $3 WHERE id = $1`,
        [
          booking.id,
          bookingPaymentStatus,
          bookingPaymentStatus === "paid" ? "confirmed" : "pending",
        ],
      );
    } catch (updateError) {
      console.error("[PayFast Webhook] Failed to update booking:", updateError);
      captureRouteError(updateError, {
        route: "/api/payments/payfast/callback",
        method: "POST",
        extra: { stage: "update_booking", bookingId: booking.id },
      });
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    // If payment successful, create ticket passes
    let passesCreated = 0;
    if (bookingPaymentStatus === "paid" && booking.event_id) {
      try {
        // Get booking items
        const { rows: bookingItems } = await query(
          `SELECT ticket_type_id, quantity FROM booking_items WHERE booking_id = $1`,
          [booking.id],
        );

        if (bookingItems && bookingItems.length > 0) {
          const passesToCreate = [];
          const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
          if (!SIGNING_SECRET) {
            throw new Error(
              "TICKET_SIGNING_SECRET environment variable is not configured",
            );
          }

          for (const item of bookingItems) {
            for (let i = 0; i < item.quantity; i++) {
              const code = `IK-${crypto
                .randomBytes(3)
                .toString("hex")
                .toUpperCase()}`;
              const signature = crypto
                .createHmac("sha256", SIGNING_SECRET)
                .update(`${code}:${booking.event_id}:${booking.id}`)
                .digest("hex")
                .slice(0, 16);

              passesToCreate.push({
                booking_id: booking.id,
                event_id: booking.event_id,
                ticket_type_id: item.ticket_type_id,
                code,
                signature,
                status: "issued" as const,
                quantity_index: i,
                guest_name: booking.customer_name || `Guest ${i + 1}`,
              });
            }
          }

          if (passesToCreate.length > 0) {
            // Check if passes already exist to avoid duplicates
            const { rows: existingPasses } = await query(
              `SELECT id FROM ticket_passes WHERE booking_id = $1 LIMIT 1`,
              [booking.id],
            );

            if (!existingPasses || existingPasses.length === 0) {
              try {
                const values: unknown[] = [];
                const placeholders = passesToCreate
                  .map((p, idx) => {
                    const base = idx * 8;
                    values.push(
                      p.booking_id,
                      p.event_id,
                      p.ticket_type_id,
                      p.code,
                      p.signature,
                      p.status,
                      p.quantity_index,
                      p.guest_name,
                    );
                    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
                  })
                  .join(", ");
                const { rows: createdPasses } = await query(
                  `INSERT INTO ticket_passes
                     (booking_id, event_id, ticket_type_id, code, signature, status, quantity_index, guest_name)
                   VALUES ${placeholders}
                   RETURNING id`,
                  values,
                );
                passesCreated = createdPasses.length;
                console.log(
                  `[PayFast Webhook] Created ${passesCreated} ticket passes`,
                );
              } catch (passesError) {
                console.error(
                  "[PayFast Webhook] Failed to create passes:",
                  passesError,
                );
              }
            } else {
              console.log(
                "[PayFast Webhook] Passes already exist for booking, skipping creation",
              );
            }
          }
        }
      } catch (passError) {
        console.error("[PayFast Webhook] Error creating passes:", passError);
      }
    }

    // Record in booking status history
    try {
      await query(
        `INSERT INTO booking_status_history (booking_id, old_status, new_status, context)
         VALUES ($1, $2, $3, $4)`,
        [
          booking.id,
          booking.payment_status,
          bookingPaymentStatus,
          `PayFast webhook: ${validation.errorCode} - ${
            validation.errorMessage || "Success"
          }. Transaction: ${validation.transactionId || "N/A"}`,
        ],
      );
    } catch {
      // Ignore if history table doesn't exist
    }

    // Send notification if payment successful
    if (
      bookingPaymentStatus === "paid" &&
      booking.user_id &&
      booking.event_id
    ) {
      try {
        const { rows: eventRows } = await query(
          `SELECT name FROM events WHERE id = $1`,
          [booking.event_id],
        );
        const eventData = eventRows[0];

        const eventName = eventData?.name || "your event";

        const notificationResult = await createNotification({
          recipientId: booking.user_id,
          roleScope: "public_user",
          categorySlug: "public_booking_confirmation",
          title: "🎉 Payment Confirmed!",
          body: `Your tickets for ${eventName} are ready. ${passesCreated} pass${
            passesCreated !== 1 ? "es" : ""
          } issued.`,
          priority: "high",
          ctaLabel: "View My Tickets",
          ctaUrl: `/dashboard/bookings`,
          metadata: {
            booking_id: booking.id,
            booking_reference: booking.booking_reference,
            event_name: eventName,
            passes_count: passesCreated,
            transaction_id: validation.transactionId,
          },
          channelOverrides: {
            bell: true,
            email: true,
            push: false,
          },
        });

        console.log(
          `[PayFast Webhook] Notification sent to user ${booking.user_id}`,
        );

        // Dispatch emails immediately
        if (notificationResult.outbox.length > 0) {
          try {
            const dispatchModule =
              await import("@/lib/notifications/dispatcher");
            await dispatchModule.dispatchEmailOutboxBatch({
              limit: 10,
            });
            console.log("[PayFast Webhook] Emails dispatched");
          } catch (dispatchError) {
            console.error(
              "[PayFast Webhook] Email dispatch failed:",
              dispatchError,
            );
          }
        }
      } catch (notifError) {
        console.error(
          "[PayFast Webhook] Failed to send notification:",
          notifError,
        );
      }

      // Best-effort: let the organizer know a sale came in. Never let this
      // affect the webhook's response to PayFast.
      try {
        const { notifyOrganizer } = await import("@/lib/organizer/notify");
        await notifyOrganizer({
          type: "ticket_sale",
          eventId: Number(booking.event_id),
          data: {
            ticketCount: passesCreated,
            totalAmount: Number(booking.total_amount ?? 0),
            buyerName: booking.customer_name || undefined,
          },
        });
      } catch (organizerNotifyError) {
        console.error(
          "[PayFast Webhook] Failed to notify organizer of sale:",
          organizerNotifyError,
        );
      }

      // Best-effort: sell-through milestone (25/50/75/100% of capacity).
      // Only fires when the event has a max_capacity set, and only once
      // per threshold via notifyOrganizer's dedupeKey.
      try {
        const { rows: capacityRows } = await query(
          `SELECT max_capacity FROM events WHERE id = $1`,
          [booking.event_id],
        );
        const maxCapacity = Number(capacityRows[0]?.max_capacity || 0);

        if (maxCapacity > 0) {
          const { rows: soldRows } = await query(
            `SELECT COUNT(*)::int AS sold FROM ticket_passes
             WHERE event_id = $1 AND status != 'revoked'`,
            [booking.event_id],
          );
          const sold = Number(soldRows[0]?.sold || 0);
          const prevPercent = Math.floor(
            ((sold - passesCreated) / maxCapacity) * 100,
          );
          const currentPercent = Math.floor((sold / maxCapacity) * 100);
          const milestone = [25, 50, 75, 100].find(
            (m) => currentPercent >= m && prevPercent < m,
          );

          if (milestone) {
            const { notifyOrganizer } = await import("@/lib/organizer/notify");
            await notifyOrganizer({
              type: "milestone",
              eventId: Number(booking.event_id),
              data: { milestonePercent: milestone },
            });
          }
        }
      } catch (milestoneError) {
        console.error(
          "[PayFast Webhook] Failed to check sales milestone:",
          milestoneError,
        );
      }
    }

    // Send failure notification if payment failed
    if (
      bookingPaymentStatus === "failed" &&
      booking.user_id &&
      booking.event_id
    ) {
      try {
        const { rows: eventRows } = await query(
          `SELECT name FROM events WHERE id = $1`,
          [booking.event_id],
        );
        const eventData = eventRows[0];

        const eventName = eventData?.name || "your event";

        const notificationResult = await createNotification({
          recipientId: booking.user_id,
          roleScope: "public_user",
          categorySlug: "public_booking_status",
          title: "❌ Payment Failed",
          body: `Your payment for ${eventName} could not be completed. ${
            validation.errorMessage || "Please try again."
          }`,
          priority: "high",
          ctaLabel: "Retry Payment",
          ctaUrl: `/checkout/payment?bookingId=${booking.id}`,
          metadata: {
            booking_id: booking.id,
            booking_reference: booking.booking_reference,
            event_name: eventName,
            error_code: validation.errorCode,
            error_message: validation.errorMessage,
          },
          channelOverrides: {
            bell: true,
            email: true,
            push: false,
          },
        });

        console.log(
          `[PayFast Webhook] Failure notification sent to user ${booking.user_id}`,
        );

        // Dispatch failure emails immediately
        if (notificationResult.outbox.length > 0) {
          try {
            const dispatchModule =
              await import("@/lib/notifications/dispatcher");
            await dispatchModule.dispatchEmailOutboxBatch({
              limit: 10,
            });
            console.log("[PayFast Webhook] Failure emails dispatched");
          } catch (dispatchError) {
            console.error(
              "[PayFast Webhook] Failure email dispatch failed:",
              dispatchError,
            );
          }
        }
      } catch (notifError) {
        console.error(
          "[PayFast Webhook] Failed to send failure notification:",
          notifError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment status updated successfully",
      bookingId: booking.id,
      paymentStatus: bookingPaymentStatus,
      passesCreated,
    });
  } catch (error) {
    console.error("[PayFast Webhook] Unexpected error:", error);
    captureRouteError(error, {
      route: "/api/payments/payfast/callback",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Handle GET requests (for testing)
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    message: "PayFast webhook endpoint is active",
    method: "POST",
    note: "This endpoint receives payment callbacks from PayFast",
  });
}
