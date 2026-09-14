/**
 * Shared helpers for the mobile commerce endpoints (checkout, bookings, payments,
 * passes). DTOs are strict allow-lists: bookings never expose cnic_hash /
 * verification_seed / customer_email / customer_phone / user_id; passes never
 * expose `signature` (HMAC) or `guest_cnic` (raw CNIC), and `code` is withheld
 * until the booking is paid.
 */
import crypto from "crypto";
import type { Database } from "@/types/database";

// ---------------------------------------------------------------------------
// Booking DTO
// ---------------------------------------------------------------------------

export const BOOKING_COLUMN_KEYS = [
  "id",
  "booking_reference",
  "event_id",
  "total_amount",
  "payment_status",
  "status",
  "customer_name",
  "cnic_last4",
  "expires_at",
  "created_at",
] as const;

export const BOOKING_COLUMNS = BOOKING_COLUMN_KEYS.join(", ");

export type BookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  (typeof BOOKING_COLUMN_KEYS)[number]
>;

export type BookingDTO = BookingRow & { currency: "PKR" };

export function toBooking(row: BookingRow): BookingDTO {
  return { ...row, currency: "PKR" };
}

// ---------------------------------------------------------------------------
// Ticket pass DTO
// ---------------------------------------------------------------------------

export const PASS_COLUMNS =
  "tp.id, tp.code, tp.status, tp.quantity_index, tp.issued_at, tp.ticket_type_id, tp.guest_name, tp.cnic_last4, tp.assigned_gate_index, COALESCE(edo.device_label, CASE WHEN tp.assigned_gate_index IS NOT NULL THEN 'Gate ' || (tp.assigned_gate_index + 1) ELSE NULL END) AS gate_label";

export type PassRow = Pick<
  Database["public"]["Tables"]["ticket_passes"]["Row"],
  | "id"
  | "code"
  | "status"
  | "quantity_index"
  | "issued_at"
  | "ticket_type_id"
  | "guest_name"
  | "cnic_last4"
> & {
  assigned_gate_index?: number | null;
  gate_label?: string | null;
};

export type PassDTO = {
  id: number;
  code: string | null;
  status: string;
  quantity_index: number | null;
  issued_at: string | null;
  ticket_type_id: number | null;
  guest_name: string | null;
  cnic_last4: string | null;
  assigned_gate_index: number | null;
  gate_label: string | null;
};

/** `code` is withheld until paid (matches the storage RLS + the contract). */
export function toPass(row: PassRow, isPaid: boolean): PassDTO {
  return {
    id: row.id,
    code: isPaid ? row.code : null,
    status: row.status,
    quantity_index: row.quantity_index,
    issued_at: row.issued_at,
    ticket_type_id: row.ticket_type_id,
    guest_name: row.guest_name,
    cnic_last4: row.cnic_last4,
    assigned_gate_index: row.assigned_gate_index !== undefined ? row.assigned_gate_index : null,
    gate_label: row.gate_label || null,
  };
}

/**
 * Whether a booking's PAYMENT is settled. Keyed strictly on `payment_status`
 * (`booking_payment_status_enum` - only `'paid'` means settled). It must NOT be
 * widened to booking-lifecycle values like `confirmed`/`completed`, or pass
 * `code` would leak for an unpaid booking (the RLS gate honors `payment_status`
 * only).
 */
export function isBookingPaid(paymentStatus: string | null): boolean {
  return paymentStatus === "paid";
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type CheckoutItem = { ticket_type_id: number; quantity: number };

/**
 * Deterministic basket hash for idempotency: the same user + cart maps to the
 * same `basket_id`. It is passed as `p_basket_id` to
 * `create_booking_with_reservation` (whose `ON CONFLICT (user_id, basket_id)`
 * dedups atomically) and later to PayFast as the `BASKET_ID` the callback
 * resolves by. `user_id` is folded in (unlike the website's formula) so the
 * value is globally unique per user - two users at the same event with the same
 * tickets + last-4 CNIC can't collide in the shared `basket_id` namespace the
 * callback's `.single()` lookup depends on.
 */
export function computeBasketHash(
  userId: string,
  eventId: number,
  items: CheckoutItem[],
  cnic: string,
): string {
  const payload = {
    user_id: userId,
    event_id: eventId,
    items: items
      .slice()
      .sort((a, b) => a.ticket_type_id - b.ticket_type_id)
      .map((i) => `${i.ticket_type_id}x${i.quantity}`),
    cnic_hash_preview: cnic.slice(-4),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
}
