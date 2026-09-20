import crypto from "crypto";
import { query } from "@/lib/db";
import { MobileApiError } from "@/lib/mobile/errors";

/**
 * Confirming a booking without a PayFast round trip.
 *
 * Two cases skip the gateway:
 *  - `free_order`: the booking total is Rs 0, so there is nothing to charge.
 *  - `payment_skipped`: MOBILE_CHECKOUT_SKIP_PAYMENT=true. A temporary,
 *    server-side switch for App Store review while the payment gateway isn't
 *    live. It is OFF unless the env var is exactly "true". Turn it off (and
 *    clean up the skipped bookings, see below) before selling real tickets.
 *
 * Skipped bookings are tagged `raw_request = {"skipped_payment": "<reason>"}`
 * on their `payments` row so they can be found later:
 *   SELECT booking_id FROM payments WHERE raw_request ? 'skipped_payment';
 *
 * This deliberately does NOT touch the PayFast callback route. It mirrors the
 * callback's paid path minimum: booking -> paid/confirmed, ticket passes
 * issued (same code + HMAC signature format), status history row. It does not
 * do gate allocation for multi_gate events, email, or organizer notifications.
 */

export type SkipPaymentReason = "free_order" | "payment_skipped";

export function isPaymentSkipEnabled(): boolean {
  return process.env.MOBILE_CHECKOUT_SKIP_PAYMENT === "true";
}

export async function confirmBookingWithoutPayment(
  bookingId: number,
  reason: SkipPaymentReason,
): Promise<void> {
  const { rows: bookingRows } = await query(
    `SELECT id, event_id, customer_name, payment_status
     FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }
  if (booking.payment_status === "paid") return;

  const signingSecret = process.env.TICKET_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("[skip-payment] TICKET_SIGNING_SECRET is not configured.");
    throw new MobileApiError(
      "internal_error",
      "Couldn't confirm this booking.",
      500,
    );
  }

  // Passes first: if this fails the booking stays awaiting_payment rather than
  // ending up "paid" with no tickets.
  const { rows: existingPasses } = await query(
    `SELECT id FROM ticket_passes WHERE booking_id = $1 LIMIT 1`,
    [bookingId],
  );
  if (existingPasses.length === 0) {
    const { rows: items } = await query(
      `SELECT ticket_type_id, quantity FROM booking_items WHERE booking_id = $1`,
      [bookingId],
    );

    const passes: Array<{
      ticketTypeId: number;
      code: string;
      signature: string;
      index: number;
      guestName: string;
    }> = [];
    for (const item of items) {
      for (let i = 0; i < Number(item.quantity); i++) {
        const code = `IK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
        const signature = crypto
          .createHmac("sha256", signingSecret)
          .update(`${code}:${booking.event_id}:${bookingId}`)
          .digest("hex")
          .slice(0, 16);
        passes.push({
          ticketTypeId: item.ticket_type_id,
          code,
          signature,
          index: i,
          guestName: booking.customer_name || `Guest ${i + 1}`,
        });
      }
    }

    if (passes.length > 0) {
      const values: unknown[] = [];
      const placeholders = passes
        .map((p, idx) => {
          const base = idx * 8;
          values.push(
            bookingId,
            booking.event_id,
            p.ticketTypeId,
            p.code,
            p.signature,
            "issued",
            p.index,
            p.guestName,
          );
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
        })
        .join(", ");
      await query(
        `INSERT INTO ticket_passes
           (booking_id, event_id, ticket_type_id, code, signature, status, quantity_index, guest_name)
         VALUES ${placeholders}`,
        values,
      );
    }
  }

  await query(
    `UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE id = $1`,
    [bookingId],
  );

  await query(
    `UPDATE payments
     SET status = 'paid', normalized_status = 'paid', raw_request = $2::jsonb
     WHERE booking_id = $1 AND gateway_code = 'payfast'`,
    [bookingId, JSON.stringify({ skipped_payment: reason })],
  );

  try {
    await query(
      `INSERT INTO booking_status_history (booking_id, old_status, new_status, context)
       VALUES ($1, $2, $3, $4)`,
      [
        bookingId,
        booking.payment_status,
        "paid",
        `Payment skipped (${reason}) - no PayFast transaction`,
      ],
    );
  } catch {
    // History table is optional, same as in the PayFast callback.
  }

  console.warn(
    `[skip-payment] Booking ${bookingId} confirmed without payment (${reason}).`,
  );
}
