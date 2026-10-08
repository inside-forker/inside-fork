import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/service";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashCnic, cnicLast4 } from "@/lib/utils/cnic-server";
import { resolveAssignedGateIndex } from "@/lib/ticketing/resolve-gate-assignment";
import { getPdfInventoryTicketTypeIds } from "@/lib/ticketing/pdf-inventory";
import {
  confirmBookingWithoutPayment,
  isPaymentSkipEnabled,
} from "@/lib/mobile/skip-payment";
import crypto from "crypto";
import {
  ParchiServiceError,
  getParchiOffer,
  previewParchiDiscount,
} from "@/lib/parchi/service";
import { computeParchiDiscount } from "@/lib/parchi/discount";
import { readParchiChannelCookie } from "@/lib/parchi/channel";
import { PRISMFEST_SLUG } from "@/lib/events/prismfest";

export async function POST(request: NextRequest) {
  try {
    // Check Auth
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: session.userId };

    const body = await request.json();
    const { buyerDetails, items } = body;
    // Approved Parchi student verification (POST /api/parchi/verifications).
    const parchiVerificationId: string | null =
      typeof body.parchiVerificationId === "string"
        ? body.parchiVerificationId
        : null;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Validate CNIC
    const rawCnic = buyerDetails?.cnic?.replace(/-/g, "") || "";
    if (!rawCnic || !/^\d{13}$/.test(rawCnic)) {
      return NextResponse.json(
        { error: "Valid CNIC is required" },
        { status: 400 },
      );
    }

    // Generate CNIC hash and last 4 digits
    const cnicHash = hashCnic(rawCnic);
    const cnicLast4Digits = cnicLast4(rawCnic);

    // Generate verification seed (24 chars hex)
    const verificationSeed = crypto.randomBytes(12).toString("hex");

    // Generate booking reference in IK-XXXX-XXX format (branded, short, unique)
    // Uses base36 (0-9, A-Z) for compact representation
    // First part: 4 chars from timestamp (unique per millisecond)
    // Second part: 3 chars random (prevents collision within same ms)
    const timestampPart = Date.now().toString(36).slice(-4).toUpperCase();
    const randomPart = crypto
      .randomBytes(2)
      .toString("hex")
      .slice(0, 3)
      .toUpperCase();
    const bookingReference = `IK-${timestampPart}-${randomPart}`;

    // Re-fetch ticket prices server-side; never trust client-supplied prices.
    const ticketTypeIds = items.map(
      (i: { ticketTypeId: number }) => i.ticketTypeId,
    );
    const { rows: ticketTypes } = await query(
      `SELECT id, price, event_id FROM ticket_types WHERE id = ANY($1::int[])`,
      [ticketTypeIds],
    );

    if (!ticketTypes) {
      return NextResponse.json({ error: "Invalid tickets" }, { status: 400 });
    }

    let subtotal = 0;
    const verifiedItems = items.map(
      (item: { ticketTypeId: number; quantity: number }) => {
        // node-pg returns bigint/numeric columns as strings, so this must
        // compare numerically rather than with strict === against the
        // client-supplied number.
        const tt = ticketTypes.find(
          (t) => Number(t.id) === Number(item.ticketTypeId),
        );
        if (!tt) throw new Error(`Invalid ticket type: ${item.ticketTypeId}`);
        const price = Number(tt.price);
        subtotal += price * item.quantity;
        return { ...item, price, eventId: Number(tt.event_id) };
      },
    );

    // Validate all items belong to the same event (RPC only supports single event)
    const uniqueEventIds = [
      ...new Set(verifiedItems.map((i: { eventId: number }) => i.eventId)),
    ];
    if (uniqueEventIds.length > 1) {
      return NextResponse.json(
        {
          error:
            "All tickets in a booking must be for the same event. Please create separate bookings for different events.",
        },
        { status: 400 },
      );
    }

    // Fetch platform and payment fees from server config (never trust client-supplied fees)
    const { rows: feeConfigs } = await query(
      `SELECT config_key, config_value FROM system_config WHERE config_key = ANY($1::text[])`,
      [
        [
          "fees.platform_fee_fixed",
          "fees.platform_fee_percentage",
          "fees.payment_processing_fee_fixed",
          "fees.payment_processing_fee_percentage",
        ],
      ],
    );

    const feeMap: Record<string, number> = {};
    for (const row of feeConfigs ?? []) {
      const v = row.config_value;
      feeMap[row.config_key] =
        typeof v === "number"
          ? v
          : typeof v === "string"
            ? parseFloat(v) || 0
            : 0;
    }
    const platformFeeFixed = feeMap["fees.platform_fee_fixed"] ?? 0;
    const platformFeePercentage = feeMap["fees.platform_fee_percentage"] ?? 0;
    const paymentFeeFixed = feeMap["fees.payment_processing_fee_fixed"] ?? 0;
    const paymentFeePercentage =
      feeMap["fees.payment_processing_fee_percentage"] ?? 0;

    // Student discount comes off the ticket subtotal before fees.
    // - Parchi channel / verification: claim via approved request id.
    // - Logged-in IK on Prismfest, NOT from Parchi: open student discount.
    // Non-authoritative preview: create_booking_atomic re-derives under locks.
    let discountAmount = 0;
    let allowOpenStudentDiscount = false;
    const eventId = verifiedItems[0].eventId as number;
    const fromParchiChannel = readParchiChannelCookie(
      request.headers.get("cookie"),
    );

    if (parchiVerificationId) {
      try {
        discountAmount = await previewParchiDiscount({
          userId: user.id,
          eventId,
          requestId: parchiVerificationId,
          subtotal,
        });
      } catch (err) {
        if (err instanceof ParchiServiceError) {
          return NextResponse.json(
            { error: err.message, error_code: err.code },
            { status: err.status },
          );
        }
        throw err;
      }
    } else if (!fromParchiChannel) {
      const { rows: eventRows } = await query(
        `SELECT slug FROM events WHERE id = $1 LIMIT 1`,
        [eventId],
      );
      const slug = (eventRows[0]?.slug as string | undefined) ?? "";
      if (slug === PRISMFEST_SLUG) {
        const offer = await getParchiOffer(eventId);
        if (offer) {
          discountAmount = computeParchiDiscount(offer, subtotal);
          allowOpenStudentDiscount = discountAmount > 0;
        }
      }
    }
    const discountedSubtotal = subtotal - discountAmount;

    const platformFee =
      platformFeeFixed + discountedSubtotal * (platformFeePercentage / 100);
    const paymentFee =
      paymentFeeFixed +
      (discountedSubtotal + platformFee) * (paymentFeePercentage / 100);
    const totalAmount = discountedSubtotal + platformFee + paymentFee;

    // 2. Create Booking + Booking Items atomically via DB function.
    // The RPC wraps both inserts in a single PL/pgSQL transaction -
    // if booking_items insertion fails, the booking row is also rolled back.
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const rpcItems = verifiedItems.map(
      (item: { ticketTypeId: number; quantity: number; price: number }) => ({
        ticket_type_id: item.ticketTypeId,
        quantity: item.quantity,
        price_per_ticket: item.price,
      }),
    );

    // create_booking_atomic is defined in sql/migrations/20260311_security_atomic_booking_rpc.sql.
    // It wraps both inserts (booking + booking_items) in a single PL/pgSQL transaction -
    // if booking_items insertion fails, the booking row is also rolled back.
    interface BookingAtomicResult {
      booking_id: number;
      booking_reference: string;
    }

    let bookingId: number | undefined;
    try {
      const { rows: rpcRows } = await query(
        `SELECT create_booking_atomic(
           p_user_id => $1,
           p_event_id => $2,
           p_total_amount => $3,
           p_basket_id => $4,
           p_booking_reference => $5,
           p_verification_seed => $6,
           p_expires_at => $7,
           p_cnic_hash => $8,
           p_cnic_last4 => $9,
           p_customer_name => $10,
           p_customer_email => $11,
           p_customer_phone => $12,
           p_items => $13::jsonb,
           p_parchi_request_id => $14::uuid,
           p_discount_amount => $15,
           p_allow_open_student_discount => $16
         ) AS result`,
        [
          user.id,
          verifiedItems[0].eventId,
          totalAmount,
          bookingReference,
          bookingReference,
          verificationSeed,
          expiresAt,
          cnicHash,
          cnicLast4Digits,
          buyerDetails.name,
          buyerDetails.email,
          buyerDetails.phone,
          JSON.stringify(rpcItems),
          parchiVerificationId,
          discountAmount,
          allowOpenStudentDiscount,
        ],
      );
      const rpcResult = rpcRows[0]?.result as BookingAtomicResult | null;
      bookingId = rpcResult?.booking_id;
    } catch (bookingError) {
      console.error("Booking creation failed:", bookingError);
      captureRouteError(
        bookingError instanceof Error
          ? bookingError
          : new Error("Booking RPC returned no result"),
        {
          route: "/api/bookings/create",
          method: "POST",
        },
      );

      // create_booking_atomic (sql/migrations/20260901_atomic_booking_add_validation.sql)
      // wraps every failure as `create_booking_atomic failed: <reason>` via its
      // `EXCEPTION WHEN OTHERS` handler. Recognized validation failures are the
      // caller's fault (400, with the real reason) rather than a generic 500 -
      // this is what previously hid "sold out" / "per-person limit exceeded" /
      // "sale window closed" behind an unhelpful "Failed to create booking".
      const rawMessage =
        bookingError instanceof Error ? bookingError.message : "";
      const message = rawMessage.replace(
        /^create_booking_atomic failed: /,
        "",
      );
      const isValidationFailure =
        /sale window closed|insufficient quantity|per-person limit exceeded|ticket type .* not found|invalid quantity/i.test(
          message,
        );

      if (/^parchi:/i.test(message)) {
        return NextResponse.json(
          {
            error: message.replace(/^parchi:\s*/i, ""),
            error_code: "parchi_invalid",
          },
          { status: 400 },
        );
      }

      if (isValidationFailure) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 },
      );
    }

    if (!bookingId) {
      console.error("Booking creation failed: no booking id returned");
      captureRouteError(new Error("Booking RPC returned no result"), {
        route: "/api/bookings/create",
        method: "POST",
      });
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 },
      );
    }

    // 3. Create Ticket Passes (non-fatal - will be regenerated by payment callback if needed).
    // Skip tiers that use organizer PDF inventory — those are assigned only after payment.
    const ticketPasses = [];
    const pdfInventoryTypeIds = await getPdfInventoryTicketTypeIds(
      verifiedItems.map((item: { ticketTypeId: number }) =>
        Number(item.ticketTypeId),
      ),
    );

    for (const item of verifiedItems) {
      if (pdfInventoryTypeIds.has(Number(item.ticketTypeId))) {
        continue;
      }
      for (let i = 0; i < item.quantity; i++) {
        const guest =
          (
            item as {
              guestInfo?: Record<number, { name?: string; cnic?: string }>;
            }
          ).guestInfo?.[i] || {};
        const guestCnicRaw = guest.cnic?.replace(/-/g, "") || null;
        const guestCnicLast4 = guestCnicRaw ? guestCnicRaw.slice(-4) : null;

        const ticketCode = `IK-${crypto
          .randomBytes(3)
          .toString("hex")
          .toUpperCase()}`;

        const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
        if (!SIGNING_SECRET) {
          throw new Error(
            "TICKET_SIGNING_SECRET environment variable is not configured",
          );
        }
        const signature = crypto
          .createHmac("sha256", SIGNING_SECRET)
          .update(`${ticketCode}:${item.eventId}:${bookingId}`)
          .digest("hex")
          .slice(0, 16);

        ticketPasses.push({
          booking_id: bookingId,
          event_id: item.eventId,
          ticket_type_id: item.ticketTypeId,
          code: ticketCode,
          signature,
          status: "issued" as const,
          quantity_index: i,
          guest_name: guest.name || null,
          // guest_cnic intentionally omitted - do not persist plaintext national ID
          cnic_last4: guestCnicLast4,
        });
      }
    }

    // Auto-assign gate when event gate_assignment_mode is "auto"
    let assignedGateIndex: number | null = null;
    const targetEventId = verifiedItems[0]?.eventId;
    if (targetEventId) {
      try {
        assignedGateIndex = await resolveAssignedGateIndex(targetEventId);
      } catch (e) {
        console.error("Failed to calculate gate index for new passes:", e);
      }
    }

    // Insert ticket passes (non-fatal)
    if (ticketPasses.length > 0) {
      try {
        const values: unknown[] = [];
        const placeholders = ticketPasses
          .map((p, idx) => {
            const base = idx * 10;
            values.push(
              p.booking_id,
              p.event_id,
              p.ticket_type_id,
              p.code,
              p.signature,
              p.status,
              p.quantity_index,
              p.guest_name,
              p.cnic_last4,
              assignedGateIndex,
            );
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
          })
          .join(", ");
        await query(
          `INSERT INTO ticket_passes
             (booking_id, event_id, ticket_type_id, code, signature, status, quantity_index, guest_name, cnic_last4, assigned_gate_index)
           VALUES ${placeholders}`,
          values,
        );
      } catch (passesError) {
        console.error("Ticket passes creation failed:", passesError);
        // Non-fatal - passes will be regenerated by payment callback
      }
    }

    // Local/review skip (or free order): confirm immediately — web UI goes to
    // /checkout/payment which shows success when payment_status is paid.
    const skipPayment =
      Number(totalAmount) === 0 || isPaymentSkipEnabled();
    if (skipPayment) {
      // confirmBookingWithoutPayment updates payments; ensure a row exists.
      const { rows: payRows } = await query(
        `SELECT id FROM payments WHERE booking_id = $1 AND gateway_code = 'payfast'`,
        [bookingId],
      );
      if (payRows.length === 0) {
        await query(
          `INSERT INTO payments (booking_id, gateway_code, amount, currency, status, normalized_status)
           VALUES ($1, 'payfast', $2, 'PKR', 'AWAITING_DETAILS', 'awaiting_payment')`,
          [bookingId, totalAmount],
        );
      }
      await confirmBookingWithoutPayment(
        bookingId,
        Number(totalAmount) === 0 ? "free_order" : "payment_skipped",
      );
      return NextResponse.json({ bookingId, payment_status: "paid" });
    }

    // === SEND NOTIFICATION: Booking Created (Pending Payment) ===
    try {
      const { rows: eventRows } = await query(
        `SELECT name FROM events WHERE id = $1`,
        [verifiedItems[0].eventId],
      );
      const event = eventRows[0];

      const eventName = event?.name || "your event";

      await createNotification({
        recipientId: session.userId,
        roleScope: "public_user",
        categorySlug: "public_booking_status",
        title: "⏳ Booking Created - Complete Payment",
        body: `Your booking for ${eventName} is reserved. Complete payment within 30 minutes to secure your tickets.`,
        priority: "normal",
        ctaLabel: "Complete Payment",
        ctaUrl: `/checkout/payment?bookingId=${bookingId}`,
        metadata: {
          booking_id: bookingId,
          booking_reference: bookingReference,
          event_name: eventName,
          total_amount: totalAmount,
          expires_at: expiresAt,
        },
        channelOverrides: {
          bell: true,
          email: false,
          push: false,
        },
      });

      console.log(`Booking pending notification sent for booking ${bookingId}`);
    } catch (notifError) {
      console.error("Failed to send booking notification:", notifError);
    }

    return NextResponse.json({ bookingId });
  } catch (error: unknown) {
    console.error("Booking API Error:", error);
    captureRouteError(error, { route: "/api/bookings/create", method: "POST" });
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
