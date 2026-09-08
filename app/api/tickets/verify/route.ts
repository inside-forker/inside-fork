import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { verifyTicketSignature } from "@/lib/tickets/signature";

// Ticket verification for organizer check-in. Verifies code + signature, enforces organizer
// ownership, and awards XP once per ticket (guarded by checked_in_at).

interface VerifyRequest {
  code: string; // Ticket code (e.g., "IK-ABC123")
  eventId?: number; // Optional: For additional validation
}

interface VerifyResponse {
  success: boolean;
  message: string;
  ticket?: {
    id: number;
    code: string;
    status: string;
    guestName?: string;
    ticketType?: string;
    eventName?: string;
    alreadyCheckedIn: boolean;
    checkedInAt?: string;
  };
  xpAwarded?: number;
  error?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<VerifyResponse>> {
  try {
    const body: VerifyRequest = await request.json();
    const { code, eventId } = body;

    // Validate code format
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket code is required",
          error: "INVALID_CODE",
        },
        { status: 400 },
      );
    }

    // Normalize code (uppercase, trim)
    const normalizedCode = code.toUpperCase().trim();

    // Validate IK- prefix
    if (!normalizedCode.startsWith("IK-")) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ticket code format. Must start with IK-",
          error: "INVALID_FORMAT",
        },
        { status: 400 },
      );
    }

    // Get authenticated user (organizer)
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please log in.",
          error: "UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    // Fetch ticket pass with related data
    const { rows: ticketPassRows } = await query(
      `SELECT tp.id, tp.code, tp.signature, tp.status, tp.guest_name,
              tp.checked_in_at, tp.booking_id, tp.event_id, tp.ticket_type_id,
              b.id AS booking_row_id, b.user_id AS booking_user_id,
              b.payment_status AS booking_payment_status,
              e.id AS event_row_id, e.name AS event_name, e.organizer_id AS event_organizer_id,
              tt.name AS ticket_type_name
       FROM ticket_passes tp
       INNER JOIN bookings b ON b.id = tp.booking_id
       INNER JOIN events e ON e.id = tp.event_id
       LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
       WHERE tp.code = $1`,
      [normalizedCode],
    );
    const ticketPass = ticketPassRows[0];

    if (!ticketPass) {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket not found. Please check the code.",
          error: "NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const booking = {
      id: ticketPass.booking_row_id as number,
      user_id: ticketPass.booking_user_id as string,
      payment_status: ticketPass.booking_payment_status as string,
    };
    const event = {
      id: ticketPass.event_row_id as number,
      name: ticketPass.event_name as string,
      organizer_id: ticketPass.event_organizer_id as string,
    };
    const ticketType = ticketPass.ticket_type_name
      ? { name: ticketPass.ticket_type_name as string }
      : null;

    // Verify organizer owns this event
    if (event.organizer_id !== session.userId) {
      // Check if user is admin (can verify any ticket)
      const { rows: profileRows } = await query(
        `SELECT role FROM profiles WHERE id = $1`,
        [session.userId],
      );
      const profile = profileRows[0];

      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";

      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            message: "You are not authorized to verify tickets for this event.",
            error: "FORBIDDEN",
          },
          { status: 403 },
        );
      }
    }

    // Optional: Verify event ID matches
    if (eventId && ticketPass.event_id !== eventId) {
      return NextResponse.json(
        {
          success: false,
          message: "Ticket does not belong to this event.",
          error: "EVENT_MISMATCH",
        },
        { status: 400 },
      );
    }

    // Verify ticket signature for fraud prevention
    const isSignatureValid = verifyTicketSignature(
      ticketPass.code,
      ticketPass.event_id,
      booking.id,
      ticketPass.signature,
    );

    if (!isSignatureValid) {
      // Log potential fraud attempt
      console.error(
        `[FRAUD_ALERT] Invalid signature for ticket ${ticketPass.code}`,
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Ticket verification failed. This may be a fraudulent ticket.",
          error: "INVALID_SIGNATURE",
        },
        { status: 400 },
      );
    }

    // Check ticket status
    if (ticketPass.status === "revoked") {
      return NextResponse.json(
        {
          success: false,
          message: "This ticket has been revoked.",
          error: "REVOKED",
        },
        { status: 400 },
      );
    }

    // Reject check-in if payment is not complete
    if (
      booking.payment_status !== "paid" &&
      booking.payment_status !== "confirmed"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ticket cannot be checked in: payment has not been completed.",
          error: "PAYMENT_REQUIRED",
        },
        { status: 402 },
      );
    }

    // Check if already checked in
    const alreadyCheckedIn =
      ticketPass.status === "checked_in" || !!ticketPass.checked_in_at;

    let xpAwarded = 0;

    if (!alreadyCheckedIn) {
      // Conditional update: only update if checked_in_at is still NULL (atomic race protection)
      let updatedRows;
      try {
        ({ rows: updatedRows } = await query(
          `UPDATE ticket_passes
           SET status = 'checked_in', checked_in_at = $2
           WHERE id = $1 AND checked_in_at IS NULL
           RETURNING id`,
          [ticketPass.id, new Date().toISOString()],
        ));
      } catch (updateError) {
        console.error("Failed to update ticket status:", updateError);
        return NextResponse.json(
          {
            success: false,
            message: "Failed to check in ticket. Please try again.",
            error: "UPDATE_FAILED",
          },
          { status: 500 },
        );
      }

      // If no rows updated, another concurrent request already checked this ticket in
      if (!updatedRows || updatedRows.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Ticket already checked in",
          ticket: {
            id: ticketPass.id,
            code: ticketPass.code,
            status: "checked_in",
            guestName: ticketPass.guest_name || undefined,
            eventName: event.name,
            alreadyCheckedIn: true,
          },
          xpAwarded: 0,
        });
      }

      // Award XP for attending event via the shared helper - a prior version
      // of this route hand-rolled the points_log insert with
      // reason: `Attended event: ${event.name}` instead of the canonical
      // "attend_event" activity_slug, which broke any eligibility/cooldown
      // check or admin dashboard aggregation keyed on that slug, and also
      // skipped checkAndProcessRankUp() (a rank-up at check-in never
      // awarded its badge). awardXP() does both correctly.
      try {
        const { awardXP } = await import("@/lib/gamification");
        const xpResult = await awardXP(
          booking.user_id,
          "attend_event",
          ticketPass.id,
        );
        if ("error" in xpResult) {
          console.error("Failed to award attend_event XP:", xpResult.error, xpResult.details);
        } else {
          xpAwarded = xpResult.xp_awarded;
        }
      } catch (xpError) {
        console.error("Failed to award XP:", xpError);
        // Don't fail the check-in, just log the error
      }

      // Best-effort: notify the organizer only when this check-in crosses a
      // 25/50/75/100% threshold, not on every single scan - a busy event
      // could see hundreds of check-ins and per-scan notifications would
      // just be noise.
      try {
        const { rows: countRows } = await query(
          `SELECT
             COUNT(*) FILTER (WHERE status != 'revoked') AS total,
             COUNT(*) FILTER (WHERE status != 'revoked' AND checked_in_at IS NOT NULL) AS checked_in
           FROM ticket_passes WHERE event_id = $1`,
          [event.id],
        );
        const total = Number(countRows[0]?.total || 0);
        const checkedIn = Number(countRows[0]?.checked_in || 0);

        if (total > 0) {
          const prevPercent = Math.floor(((checkedIn - 1) / total) * 100);
          const currentPercent = Math.floor((checkedIn / total) * 100);
          const milestone = [25, 50, 75, 100].find(
            (m) => currentPercent >= m && prevPercent < m,
          );

          if (milestone) {
            const { notifyOrganizer } = await import("@/lib/organizer/notify");
            await notifyOrganizer({
              type: "check_in",
              eventId: event.id,
              data: { milestonePercent: milestone },
            });
          }
        }
      } catch (organizerNotifyError) {
        console.error(
          "Failed to notify organizer of check-in milestone:",
          organizerNotifyError,
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: alreadyCheckedIn
        ? "Ticket already checked in"
        : `Check-in successful!${
            xpAwarded > 0 ? ` Attendee earned +${xpAwarded} XP` : ""
          }`,
      ticket: {
        id: ticketPass.id,
        code: ticketPass.code,
        status: alreadyCheckedIn ? "checked_in" : "checked_in",
        guestName: ticketPass.guest_name || undefined,
        ticketType: ticketType?.name || undefined,
        eventName: event.name,
        alreadyCheckedIn,
        checkedInAt: ticketPass.checked_in_at || new Date().toISOString(),
      },
      xpAwarded: alreadyCheckedIn ? 0 : xpAwarded,
    });
  } catch (error) {
    console.error("Ticket verification error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * GET: Check ticket status without modifying
 * Used for previewing ticket info before check-in
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { success: false, error: "Code parameter required" },
        { status: 400 },
      );
    }

    // Get authenticated user
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const normalizedCode = code.toUpperCase().trim();

    // Fetch ticket pass
    const { rows: ticketPassRows } = await query(
      `SELECT tp.id, tp.code, tp.status, tp.guest_name, tp.checked_in_at, tp.event_id,
              e.id AS event_row_id, e.name AS event_name, e.organizer_id AS event_organizer_id,
              e.start_time AS event_start_time,
              tt.name AS ticket_type_name
       FROM ticket_passes tp
       INNER JOIN events e ON e.id = tp.event_id
       LEFT JOIN ticket_types tt ON tt.id = tp.ticket_type_id
       WHERE tp.code = $1`,
      [normalizedCode],
    );
    const ticketPass = ticketPassRows[0];

    if (!ticketPass) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 },
      );
    }

    const event = {
      id: ticketPass.event_row_id as number,
      name: ticketPass.event_name as string,
      organizer_id: ticketPass.event_organizer_id as string,
      start_time: ticketPass.event_start_time as string,
    };
    const ticketType = ticketPass.ticket_type_name
      ? { name: ticketPass.ticket_type_name as string }
      : null;

    // Verify organizer owns this event
    if (event.organizer_id !== session.userId) {
      const { rows: profileRows } = await query(
        `SELECT role FROM profiles WHERE id = $1`,
        [session.userId],
      );
      const profile = profileRows[0];

      const isAdmin =
        profile?.role === "admin" || profile?.role === "super_admin";

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Not authorized for this event" },
          { status: 403 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticketPass.id,
        code: ticketPass.code,
        status: ticketPass.status,
        guestName: ticketPass.guest_name,
        ticketType: ticketType?.name,
        eventName: event.name,
        eventTime: event.start_time,
        checkedIn: ticketPass.status === "checked_in",
        checkedInAt: ticketPass.checked_in_at,
      },
    });
  } catch (error) {
    console.error("Ticket lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
