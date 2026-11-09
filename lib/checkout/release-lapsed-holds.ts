import { query } from "@/lib/db";

/**
 * Expires this buyer's earlier unpaid bookings on the event (and lapsed holds
 * on the same CNIC from other accounts) before a new booking
 * is created, so an abandoned checkout doesn't count against the per-person
 * limit (or the per-user coupon limit) when they come back.
 *
 * See sql/migrations/20261110_release_lapsed_booking_holds.sql. Only call this
 * when about to create a NEW booking, never on the basket-reuse path.
 *
 * Non-fatal: if it fails, checkout proceeds and the RPC enforces limits as
 * before, which is the old behaviour rather than a new failure.
 */
export async function releaseLapsedHolds(
  eventId: number,
  cnicHash: string,
  userId: string,
): Promise<void> {
  try {
    await query(`SELECT release_lapsed_booking_holds($1, $2, $3::uuid)`, [
      eventId,
      cnicHash,
      userId,
    ]);
  } catch (err) {
    console.warn("[checkout] release_lapsed_booking_holds failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
