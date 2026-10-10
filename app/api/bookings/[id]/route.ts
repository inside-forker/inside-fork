import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

/**
 * Columns this endpoint is allowed to return.
 *
 * This used to be `SELECT *` spread straight into the JSON response, which
 * handed the browser `cnic_hash`, `verification_seed` and `basket_id` - the
 * last of which is the key the PayFast callback resolves bookings by. An
 * explicit allow-list, in the same spirit as `PROFILE_COLUMN_KEYS` in
 * `lib/mobile/profile.ts`, so new columns are private by default.
 */
const BOOKING_COLUMNS = [
  "id",
  "user_id",
  "event_id",
  "booking_reference",
  "total_amount",
  "status",
  "payment_status",
  "customer_name",
  "customer_email",
  "customer_phone",
  "cnic_last4",
  "created_at",
  "expires_at",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);
    if (Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: bookingRows } = await query(
      `SELECT ${BOOKING_COLUMNS.join(", ")} FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const booking = bookingRows[0];

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Ownership check - admins can view any booking
    if (booking.user_id !== session.userId) {
      const { rows: profileRows } = await query(
        `SELECT role FROM profiles WHERE id = $1`,
        [session.userId]
      );
      const profile = profileRows[0];
      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";
      if (!isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // node-pg returns numeric columns as strings - normalize before sending
    // to the client, which does arithmetic (e.g. amount.toFixed(2)) on this.
    return NextResponse.json({
      ...booking,
      total_amount: Number(booking.total_amount),
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Failed to fetch booking" },
      { status: 500 }
    );
  }
}
