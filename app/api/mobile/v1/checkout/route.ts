import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import {
  enforceMobileRateLimit,
  enforceCheckoutRateLimit,
} from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { computeBasketHash, type CheckoutItem } from "@/lib/mobile/commerce";
import { hashCnic, cnicLast4 } from "@/lib/utils/cnic-server";

export const dynamic = "force-dynamic";

/** node-pg returns bigint columns as strings — normalize before comparing. */
type TicketTypeCheckoutRow = {
  id: number;
  event_id: number;
  quantity_available: number | null;
  sale_starts_at: string;
  sale_ends_at: string;
};

function normalizeTicketTypeRows(
  rows: Array<Record<string, unknown>>,
): TicketTypeCheckoutRow[] {
  return rows.map((row) => ({
    id: Number(row.id),
    event_id: Number(row.event_id),
    quantity_available:
      row.quantity_available == null ? null : Number(row.quantity_available),
    sale_starts_at: String(row.sale_starts_at),
    sale_ends_at: String(row.sale_ends_at),
  }));
}

const bodySchema = z.object({
  event_id: z.number().int().positive().optional(),
  tickets: z
    .array(
      z.object({
        ticket_type_id: z.number().int().positive(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  customer: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    phone: z.string().min(1).max(40),
    cnic: z
      .string()
      .transform((value) => value.replace(/\D/g, ""))
      .pipe(z.string().regex(/^\d{13}$/, "CNIC must be 13 digits.")),
  }),
  coupon_code: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/mobile/v1/checkout
 *
 * Creates (or idempotently reuses) a booking for the caller and arms the PayFast
 * payment. Booking creation goes through the SECURITY DEFINER
 * `create_booking_with_reservation` RPC WITH `p_basket_id` - its
 * `ON CONFLICT (user_id, basket_id)` makes creation atomically idempotent (this
 * is the double-charge fix the website route lacks: it omits `p_basket_id` and
 * sets it in a separate UPDATE). Amount is server-authoritative; the raw CNIC is
 * hashed here in the API layer (hashCnic/cnicLast4) before it ever reaches the
 * RPC or the database - only the hash and last 4 digits are ever persisted or
 * exposed.
 *
 * Optional `coupon_code` is passed straight through as `p_coupon_code` - the
 * RPC validates and redeems it under the same row lock as ticket inventory
 * (see the coupon migration's header comment). `GET /coupons/validate` is a
 * separate, non-authoritative preview for the "Apply Offer" UI before this
 * point.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);
  await enforceCheckoutRateLimit(user.id);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    const path = issue?.path.join(".") ?? "";
    const code = path.startsWith("customer.cnic")
      ? "cnic_invalid"
      : path === "tickets"
        ? "empty_cart"
        : "validation_error";
    throw new MobileApiError(
      code,
      issue?.message ?? "Invalid checkout request.",
      400,
      path || undefined,
    );
  }
  const { tickets, customer, coupon_code: couponCode } = parsed.data;

  // Aggregate duplicate ticket types.
  const agg = new Map<number, number>();
  for (const t of tickets) {
    agg.set(t.ticket_type_id, (agg.get(t.ticket_type_id) ?? 0) + t.quantity);
  }
  const items: CheckoutItem[] = [...agg.entries()].map(
    ([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }),
  );

  // Friendly pre-validation (the RPC re-checks authoritatively under a row lock).
  const ids = items.map((i) => i.ticket_type_id);
  let types;
  try {
    ({ rows: types } = await query(
      `SELECT id, event_id, quantity_available, sale_starts_at, sale_ends_at
       FROM ticket_types WHERE id = ANY($1::int[])`,
      [ids],
    ));
  } catch (ttErr) {
    console.error(
      "[mobile-api] checkout ticket_types lookup failed:",
      ttErr instanceof Error ? ttErr.message : ttErr,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to validate tickets.",
      500,
    );
  }
  const rows = normalizeTicketTypeRows(types ?? []);
  if (ids.some((id) => !rows.some((r) => r.id === id))) {
    console.warn("[mobile-api] checkout ticket_types missing after lookup", {
      requested: ids,
      found: rows.map((r) => r.id),
    });
    throw new MobileApiError(
      "ticket_type_missing",
      "One or more ticket types were not found.",
      400,
      "tickets",
    );
  }
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  if (eventIds.length !== 1) {
    throw new MobileApiError(
      "event_id_mismatch",
      "All tickets must be for the same event.",
      400,
      "tickets",
    );
  }
  const eventId = eventIds[0];
  if (parsed.data.event_id && parsed.data.event_id !== eventId) {
    throw new MobileApiError(
      "event_id_mismatch",
      "The provided event_id does not match the tickets.",
      400,
      "event_id",
    );
  }
  const now = new Date();
  for (const it of items) {
    const row = rows.find((r) => r.id === it.ticket_type_id)!;
    if (
      now < new Date(row.sale_starts_at) ||
      now > new Date(row.sale_ends_at)
    ) {
      throw new MobileApiError(
        "sale_window_closed",
        "Ticket sales are closed for one of the selected tickets.",
        400,
        "tickets",
      );
    }
    if (
      row.quantity_available !== null &&
      row.quantity_available < it.quantity
    ) {
      throw new MobileApiError(
        "ticket_type_insufficient",
        "Not enough tickets remaining.",
        400,
        "tickets",
      );
    }
  }

  const basket = computeBasketHash(user.id, eventId, items, customer.cnic);

  // Reuse an existing unpaid booking for this basket (drives the UX `reused`
  // flag); the RPC's ON CONFLICT is the real atomic dedup.
  const { rows: existingRows } = await query(
    `SELECT id FROM bookings
     WHERE user_id = $1 AND event_id = $2 AND basket_id = $3
       AND payment_status::text = ANY($4::text[])
     ORDER BY id DESC
     LIMIT 1`,
    [user.id, eventId, basket, ["awaiting_payment", "pending"]],
  );
  const existing = existingRows[0];

  let bookingId: number;
  let reused = false;
  if (existing) {
    bookingId = existing.id;
    reused = true;
  } else {
    let newId: number | null = null;
    let rpcErrMsg: string | undefined;
    try {
      const { rows: rpcRows } = await query(
        `SELECT create_booking_with_reservation(
           p_user_id => $1,
           p_items => $2::jsonb,
           p_customer_name => $3,
           p_customer_email => $4,
           p_customer_phone => $5,
           p_cnic_hash => $6,
           p_cnic_last4 => $7,
           p_basket_id => $8,
           p_coupon_code => $9
         ) AS result`,
        [
          user.id,
          JSON.stringify(items),
          customer.name,
          customer.email,
          customer.phone,
          hashCnic(customer.cnic),
          cnicLast4(customer.cnic),
          basket,
          couponCode ?? null,
        ],
      );
      newId = (rpcRows[0]?.result as number | null) ?? null;
    } catch (err) {
      rpcErrMsg = err instanceof Error ? err.message : String(err);
    }
    if (rpcErrMsg || newId == null) {
      const msg = rpcErrMsg ?? "";
      if (/sale window/i.test(msg))
        throw new MobileApiError(
          "sale_window_closed",
          "Ticket sales are closed.",
          400,
        );
      if (/insufficient quantity/i.test(msg))
        throw new MobileApiError(
          "ticket_type_insufficient",
          "Not enough tickets remaining.",
          400,
        );
      if (/not found/i.test(msg))
        throw new MobileApiError(
          "ticket_type_missing",
          "One or more ticket types were not found.",
          400,
        );
      if (/per-person limit/i.test(msg))
        throw new MobileApiError(
          "per_person_limit",
          "Per-person ticket limit exceeded.",
          400,
        );
      if (/invalid coupon/i.test(msg))
        throw new MobileApiError(
          "coupon_invalid",
          // The RPC's message already has a friendly, specific reason
          // ("not found, expired...", "usage limit reached", "already used").
          msg.replace(/^invalid coupon:\s*/i, "") || "This coupon code is invalid.",
          400,
          "coupon_code",
        );
      console.error("[mobile-api] checkout RPC failed:", msg);
      throw new MobileApiError(
        "internal_error",
        "Failed to create booking.",
        500,
      );
    }
    bookingId = newId;
  }

  const { rows: bookingRows } = await query(
    `SELECT id, booking_reference, total_amount, payment_status, coupon_id, discount_amount
     FROM bookings WHERE id = $1`,
    [bookingId],
  );
  const booking = bookingRows[0];
  if (!booking) {
    console.error("[mobile-api] checkout booking fetch failed: not found");
    throw new MobileApiError("internal_error", "Failed to load booking.", 500);
  }

  // Ensure a payment row exists (mirrors the website).
  const { rows: payExistingRows } = await query(
    `SELECT id FROM payments WHERE booking_id = $1 AND gateway_code = $2`,
    [bookingId, "payfast"],
  );
  const payExisting = payExistingRows[0];
  if (!payExisting) {
    try {
      await query(
        `INSERT INTO payments (booking_id, gateway_code, amount, currency, status, normalized_status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          bookingId,
          "payfast",
          booking.total_amount,
          "PKR",
          "AWAITING_DETAILS",
          "awaiting_payment",
        ],
      );
    } catch (payErr) {
      console.error(
        "[mobile-api] checkout payment init failed:",
        payErr instanceof Error ? payErr.message : payErr,
      );
      throw new MobileApiError(
        "internal_error",
        "Failed to initialize payment.",
        500,
      );
    }
  }

  const paymentStatus = booking.payment_status ?? "awaiting_payment";
  const paymentStage =
    paymentStatus === "paid"
      ? "completed"
      : paymentStatus === "awaiting_payment" && reused
        ? "awaiting_otp"
        : "awaiting_payment_details";

  return ok(
    {
      booking_id: booking.id,
      booking_reference: booking.booking_reference,
      amount: booking.total_amount,
      currency: "PKR",
      gateway: "payfast",
      payment_status: paymentStatus,
      payment_stage: paymentStage,
      mock_mode: false,
      reused,
      poll_interval_ms: 4000,
      // coupon_id is `bigint` - pg returns it as a string, not a number.
      coupon_id: booking.coupon_id != null ? Number(booking.coupon_id) : null,
      discount_amount: booking.discount_amount,
    },
    undefined,
    { status: 201 },
  );
});
