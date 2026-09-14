import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import {
  PASS_COLUMNS,
  toPass,
  isBookingPaid,
  type PassRow,
} from "@/lib/mobile/commerce";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/tickets/passes?booking_id=
 *
 * The booking's passes. Owner-scoped in-query (-> 404). Passes are only
 * fetched for paid bookings (previously enforced by RLS, now an explicit
 * guard since direct Postgres has no RLS); `code` is withheld until paid, and
 * `signature`/`guest_cnic` are never selected. Mirrors `app/api/tickets/passes`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const idRaw = new URL(request.url).searchParams.get("booking_id");
  const bookingId = Number(idRaw);
  if (!idRaw || !Number.isInteger(bookingId) || bookingId < 1) {
    throw new MobileApiError(
      "validation_error",
      "A valid booking_id is required.",
      400,
      "booking_id",
    );
  }

  const { rows: bookingRows } = await query(
    `SELECT id, booking_reference, payment_status, total_amount
     FROM bookings
     WHERE id = $1 AND user_id = $2`,
    [bookingId, user.id],
  );
  const booking = bookingRows[0];
  if (!booking) {
    throw new MobileApiError("not_found", "Booking not found.", 404);
  }

  const paid = isBookingPaid(booking.payment_status);
  const passes = paid
    ? (
        await query(
          `SELECT ${PASS_COLUMNS} 
           FROM ticket_passes tp
           LEFT JOIN event_device_operators edo ON edo.event_id = tp.event_id AND edo.device_index = tp.assigned_gate_index
           WHERE tp.booking_id = $1 
           ORDER BY tp.quantity_index ASC`,
          [bookingId],
        )
      ).rows
    : [];

  return ok({
    booking_id: booking.id,
    booking_reference: booking.booking_reference,
    payment_status: booking.payment_status,
    total_amount: booking.total_amount,
    passes: (passes as PassRow[]).map((p) => toPass(p, paid)),
  });
});
