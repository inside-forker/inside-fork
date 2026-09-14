import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSuperAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { createNotification } from "@/lib/notifications/service";
import crypto from "crypto";

/**
 * Admin API: Mark Booking as Paid
 *
 * Uses atomic RPC function when available, falls back to service role operations.
 * Only super_admin can use this endpoint.
 *
 * ATOMIC OPERATION: Uses PostgreSQL transaction via RPC for consistency.
 * If ticket generation fails, booking status is rolled back.
 */

// RPC response type
interface MarkBookingPaidRpcResponse {
  success: boolean;
  message?: string;
  error?: string;
  passes_created?: number;
}

// Generate ticket codes for a booking (fallback)
function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "IK-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate HMAC signature for ticket (fallback)
function generateSignature(
  code: string,
  eventId: number,
  bookingId: number,
): string {
  const SIGNING_SECRET = process.env.TICKET_SIGNING_SECRET;
  if (!SIGNING_SECRET) {
    throw new Error(
      "TICKET_SIGNING_SECRET environment variable is not configured",
    );
  }
  const payload = `${code}:${eventId}:${bookingId}`;
  return crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(payload)
    .digest("hex")
    .substring(0, 16);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookingId = parseInt(id, 10);

    if (isNaN(bookingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid booking ID" },
        { status: 400 },
      );
    }

    // Check user is authenticated and is super_admin
    let adminUserId: string;
    try {
      const { user } = await requireSuperAdmin(request);
      adminUserId = user.id;
    } catch (error) {
      const status = getAdminAuthErrorStatus(error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unauthorized",
        },
        { status: status ?? 500 },
      );
    }

    // Try to use the atomic RPC function first (preferred)
    const signingSecret = process.env.TICKET_SIGNING_SECRET;

    try {
      // p_signing_secret has a DB-side default; only pass it when we actually
      // have a value so an unset env var falls back to that default instead
      // of being overridden with an explicit NULL.
      const { rows: rpcRows } = signingSecret
        ? await query(
            `SELECT admin_mark_booking_paid(
               p_admin_id => $1,
               p_booking_id => $2,
               p_signing_secret => $3
             ) AS result`,
            [adminUserId, bookingId, signingSecret],
          )
        : await query(
            `SELECT admin_mark_booking_paid(
               p_admin_id => $1,
               p_booking_id => $2
             ) AS result`,
            [adminUserId, bookingId],
          );
      const rpcResult = rpcRows[0]?.result as MarkBookingPaidRpcResponse | null;

      if (rpcResult && rpcResult.success) {
        // Ensure passes have assigned_gate_index if event is multi_gate
        try {
          const { rows: bEventRows } = await query(
            `SELECT b.event_id, e.scanning_mode, e.total_gates 
             FROM bookings b 
             INNER JOIN events e ON e.id = b.event_id 
             WHERE b.id = $1 LIMIT 1`,
            [bookingId],
          );
          if (
            bEventRows.length > 0 &&
            bEventRows[0].scanning_mode === "multi_gate" &&
            Number(bEventRows[0].total_gates) > 1
          ) {
            const evId = bEventRows[0].event_id;
            const totalGates = Number(bEventRows[0].total_gates);
            const { rows: gateLoadRows } = await query(
              `SELECT assigned_gate_index, COUNT(*)::int AS count
               FROM public.ticket_passes
               WHERE event_id = $1 AND status != 'revoked' AND assigned_gate_index IS NOT NULL
               GROUP BY assigned_gate_index`,
              [evId],
            );
            const loadMap: Record<number, number> = {};
            for (let g = 0; g < totalGates; g++) loadMap[g] = 0;
            gateLoadRows.forEach((r) => {
              const idx = Number(r.assigned_gate_index);
              if (idx >= 0 && idx < totalGates) loadMap[idx] = Number(r.count);
            });
            let minG = 0;
            let minC = loadMap[0];
            for (let g = 1; g < totalGates; g++) {
              if (loadMap[g] < minC) {
                minC = loadMap[g];
                minG = g;
              }
            }
            await query(
              `UPDATE public.ticket_passes 
               SET assigned_gate_index = $1 
               WHERE booking_id = $2 AND assigned_gate_index IS NULL`,
              [minG, bookingId],
            );
          }
        } catch (gateErr) {
          console.error("[RPC PATH] Failed to auto-allocate gate index:", gateErr);
        }

        // === SEND NOTIFICATION: Payment Success (RPC Path) ===
        try {
          // Fetch booking details for notification
          const { rows: bookingDataRows } = await query(
            `SELECT b.user_id, b.booking_reference,
                    CASE WHEN e.id IS NULL THEN NULL
                         ELSE json_build_object('name', e.name)
                    END AS event
             FROM bookings b
             LEFT JOIN events e ON e.id = b.event_id
             WHERE b.id = $1`,
            [bookingId],
          );
          const bookingData = bookingDataRows[0];

          if (!bookingData) {
            console.error("[RPC PATH] Booking data is null");
            throw new Error("Booking data not found");
          }

          console.log("[RPC PATH] Booking data:", {
            user_id: bookingData.user_id,
            has_event: !!bookingData.event,
            event: bookingData.event,
          });

          if (!bookingData.user_id) {
            console.error("[RPC PATH] No user_id in booking");
            throw new Error("Booking has no user_id");
          }

          if (!bookingData.event) {
            console.error("[RPC PATH] No event data");
            throw new Error("Event data not found");
          }

          const passesCreated = rpcResult.passes_created || 0;
          const eventName = (bookingData.event as { name: string }).name;

          console.log("[RPC PATH] Creating notification:", {
            recipientId: bookingData.user_id,
            eventName,
            passesCreated,
          });

          const notificationResult = await createNotification({
            recipientId: bookingData.user_id,
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
              booking_id: bookingId,
              booking_reference: bookingData.booking_reference,
              event_name: eventName,
              passes_count: passesCreated,
            },
            channelOverrides: {
              bell: true,
              email: true,
              push: false,
            },
          });

          console.log("[RPC PATH] Notification created:", {
            notification_id: notificationResult.notification.id,
            channels: notificationResult.channels.length,
            outbox: notificationResult.outbox.length,
          });

          console.log(
            `[RPC PATH] Notification sent for booking ${bookingId} to user ${bookingData.user_id}`,
          );

          // Trigger email dispatch if there are outbox items
          if (notificationResult.outbox.length > 0) {
            try {
              console.log("[RPC PATH] Triggering email dispatch...");
              const dispatchModule =
                await import("@/lib/notifications/dispatcher");
              const dispatchResult =
                await dispatchModule.dispatchEmailOutboxBatch({
                  limit: 10,
                });
              console.log("[RPC PATH] Email dispatch result:", {
                sent: dispatchResult.sent,
                failed: dispatchResult.failed,
              });
            } catch (dispatchError) {
              console.error(
                "[RPC PATH] Email dispatch failed:",
                dispatchError,
              );
            }
          }
        } catch (notifError) {
          console.error(
            "[RPC PATH] Failed to send notification:",
            notifError,
          );
          console.error("[RPC PATH] Error stack:", notifError);
          // Re-throw to see the error in response (during testing)
          if (process.env.NEXT_DEBUG === "TRUE") {
            throw notifError;
          }
        }

        return NextResponse.json({
          success: true,
          message: rpcResult.message,
          passesCreated: rpcResult.passes_created || 0,
        });
      } else if (rpcResult) {
        return NextResponse.json(
          { success: false, error: rpcResult.error || "Operation failed" },
          { status: 400 },
        );
      } else {
        // RPC returned no result at all - fall through to fallback
        console.log("RPC call returned no result, using fallback");
      }
    } catch (rpcErr) {
      console.log("RPC call exception, using fallback:", rpcErr);
    }

    // Fallback to manual implementation if RPC doesn't exist
    console.log("Using fallback implementation (RPC not available)");

    // Get booking with service role
    const { rows: bookingRows } = await query(
      `SELECT id, event_id, payment_status, status, customer_name, user_id
       FROM bookings WHERE id = $1`,
      [bookingId],
    );
    const booking = bookingRows[0];

    if (!booking) {
      console.error("Booking fetch error: not found");
      return NextResponse.json(
        { success: false, error: "Booking not found" },
        { status: 404 },
      );
    }

    // Check if already paid
    if (booking.payment_status === "paid") {
      return NextResponse.json(
        { success: false, error: "Booking is already paid" },
        { status: 400 },
      );
    }

    // Get booking items
    let bookingItems: { booking_id: number; quantity: number; ticket_type_id: number }[] =
      [];
    try {
      ({ rows: bookingItems } = await query(
        `SELECT booking_id, quantity, ticket_type_id
         FROM booking_items WHERE booking_id = $1`,
        [bookingId],
      ));
    } catch (itemsError) {
      console.error("Booking items fetch error:", itemsError);
    }

    // Check if we need to generate ticket passes
    const eventId = booking.event_id;
    const needsTickets = eventId && bookingItems && bookingItems.length > 0;

    // Prepare ticket passes if needed
    const passesToCreate: Array<{
      booking_id: number;
      event_id: number;
      ticket_type_id: number;
      code: string;
      signature: string;
      guest_name: string;
      status: "issued";
      quantity_index: number;
    }> = [];

    if (needsTickets) {
      for (const item of bookingItems) {
        for (let i = 0; i < item.quantity; i++) {
          const code = generateTicketCode();
          const signature = generateSignature(code, eventId, bookingId);
          const guestName = booking.customer_name || `Guest ${i + 1}`;

          passesToCreate.push({
            booking_id: bookingId,
            event_id: eventId,
            ticket_type_id: item.ticket_type_id,
            code,
            signature,
            guest_name: guestName,
            status: "issued",
            quantity_index: i + 1,
          });
        }
      }
    }

    // === ATOMIC OPERATION: Update booking and create passes ===
    // First update the booking status
    try {
      await query(
        `UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE id = $1`,
        [bookingId],
      );
    } catch (updateError) {
      console.error("Failed to update booking:", updateError);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to update booking: " +
            (updateError instanceof Error ? updateError.message : "unknown"),
        },
        { status: 500 },
      );
    }

    // Determine smart gate allocation if event is multi_gate
    let fallbackGateIndex: number | null = null;
    if (eventId) {
      try {
        const { rows: eventModeRows } = await query(
          `SELECT scanning_mode, total_gates FROM public.events WHERE id = $1 LIMIT 1`,
          [eventId],
        );
        if (
          eventModeRows.length > 0 &&
          eventModeRows[0].scanning_mode === "multi_gate" &&
          Number(eventModeRows[0].total_gates) > 1
        ) {
          const totalGates = Number(eventModeRows[0].total_gates);
          const { rows: gateLoadRows } = await query(
            `SELECT assigned_gate_index, COUNT(*)::int AS count
             FROM public.ticket_passes
             WHERE event_id = $1 AND status != 'revoked' AND assigned_gate_index IS NOT NULL
             GROUP BY assigned_gate_index`,
            [eventId],
          );
          const loadMap: Record<number, number> = {};
          for (let g = 0; g < totalGates; g++) loadMap[g] = 0;
          gateLoadRows.forEach((r) => {
            const idx = Number(r.assigned_gate_index);
            if (idx >= 0 && idx < totalGates) loadMap[idx] = Number(r.count);
          });
          let minG = 0;
          let minC = loadMap[0];
          for (let g = 1; g < totalGates; g++) {
            if (loadMap[g] < minC) {
              minC = loadMap[g];
              minG = g;
            }
          }
          fallbackGateIndex = minG;
        }
      } catch (e) {
        console.error("Failed to determine fallback gate index:", e);
      }
    }

    // Create ticket passes if needed
    let passesCreated = 0;
    if (passesToCreate.length > 0) {
      try {
        const values: unknown[] = [];
        const placeholders = passesToCreate
          .map((p, idx) => {
            const base = idx * 9;
            values.push(
              p.booking_id,
              p.event_id,
              p.ticket_type_id,
              p.code,
              p.signature,
              p.guest_name,
              p.status,
              p.quantity_index,
              fallbackGateIndex,
            );
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
          })
          .join(", ");
        const { rows: createdPasses } = await query(
          `INSERT INTO ticket_passes
             (booking_id, event_id, ticket_type_id, code, signature, guest_name, status, quantity_index, assigned_gate_index)
           VALUES ${placeholders}
           RETURNING id`,
          values,
        );
        passesCreated = createdPasses.length || passesToCreate.length;
      } catch (passError) {
        console.error("Failed to create ticket passes:", passError);
        // ROLLBACK: Revert the booking status since passes failed
        await query(
          `UPDATE bookings SET payment_status = 'awaiting_payment', status = 'pending' WHERE id = $1`,
          [bookingId],
        );

        return NextResponse.json(
          {
            success: false,
            error: "Failed to generate tickets. Booking status reverted.",
          },
          { status: 500 },
        );
      }
    }

    // Record in booking status history if table exists
    // Note: booking_status_history uses booking_payment_status_enum, not booking_status
    try {
      await query(
        `INSERT INTO booking_status_history (booking_id, old_status, new_status, context)
         VALUES ($1, $2, $3, $4)`,
        [
          bookingId,
          booking.payment_status, // Use payment_status, not status
          "paid", // This is booking_payment_status_enum
          `Manually marked as paid by admin ${adminUserId}. ${passesCreated} tickets generated.`,
        ],
      );
    } catch {
      // Ignore if history table doesn't exist or insert fails
    }

    // === SEND NOTIFICATION: Payment Success ===
    if (booking.user_id) {
      try {
        // Fetch full booking details for notification
        const { rows: fullBookingRows } = await query(
          `SELECT b.id, b.booking_reference, b.customer_name, b.customer_email, b.total_amount,
                  CASE WHEN e.id IS NULL THEN NULL
                       ELSE json_build_object('id', e.id, 'name', e.name, 'slug', e.slug, 'start_time', e.start_time)
                  END AS event
           FROM bookings b
           LEFT JOIN events e ON e.id = b.event_id
           WHERE b.id = $1`,
          [bookingId],
        );
        const fullBooking = fullBookingRows[0];

        if (fullBooking && fullBooking.event) {
          const eventName = (fullBooking.event as { name: string }).name;

          // Create in-app notification
          await createNotification({
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
              booking_id: bookingId,
              booking_reference: fullBooking.booking_reference,
              event_name: eventName,
              passes_count: passesCreated,
            },
            channelOverrides: {
              bell: true,
              email: true, // Will send email via dispatcher
              push: false,
            },
          });

          console.log(
            `Notification sent for booking ${bookingId} to user ${booking.user_id}`,
          );
        }
      } catch (notifError) {
        // Don't fail the whole operation if notification fails
        console.error("Failed to send notification:", notifError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Booking marked as paid. ${passesCreated} ticket passes generated.`,
      passesCreated,
    });
  } catch (error) {
    console.error("Mark paid error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
