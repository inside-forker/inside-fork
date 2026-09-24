import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError, MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { verifyTicketSignature } from "@/lib/tickets/signature";

export const dynamic = "force-dynamic";

const scanItemSchema = z.object({
  ticketCode: z.string().min(1).max(64),
  scannedAt: z.string(), // ISO string from device clock
  deviceId: z.string().optional(),
  gateIndex: z.number().int().min(0).optional(),
  totalGates: z.number().int().min(1).optional(),
});

const batchSyncSchema = z.object({
  eventId: z.number().int().positive(),
  deviceId: z.string().min(1),
  gateIndex: z.number().int().min(0).optional(),
  totalGates: z.number().int().min(1).optional(),
  scans: z.array(scanItemSchema).min(1).max(500),
});

export type BatchSyncScanResult = {
  ticketCode: string;
  status: "valid" | "already_used" | "invalid_signature" | "revoked" | "unpaid" | "not_found";
  isDuplicate: boolean;
  scannedAt: string;
  guestName?: string | null;
  ticketType?: string | null;
  message?: string;
};

/**
 * POST /api/mobile/v1/organizer/tickets/batch-sync
 *
 * Reconciles an array of offline scans from one or more gate pass devices.
 * Server compares device timestamps across concurrent gate scanners:
 * the earliest device timestamp wins the official check-in, and all subsequent
 * scans are cataloged in scan_audit_log with is_duplicate = true.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const rawBody = await request.json().catch(() => null);
  const parsed = batchSyncSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw MobileErrors.badRequest(
      "Invalid batch sync payload. Must include eventId, deviceId, and scans array.",
    );
  }

  const { eventId, deviceId: batchDeviceId, gateIndex: batchGateIndex, totalGates: batchTotalGates, scans } = parsed.data;

  // Authorize with allowGatePass = true (organizer, linked gate pass, admin)
  const { user } = await requireMobileOrganizer(request, {
    eventId,
    allowGatePass: true,
  });

  // Sort incoming scans by scannedAt ascending (earliest first)
  const sortedScans = [...scans].sort((a, b) => {
    const timeA = new Date(a.scannedAt).getTime();
    const timeB = new Date(b.scannedAt).getTime();
    return timeA - timeB;
  });

  let reconciledNew = 0;
  let duplicates = 0;
  let failed = 0;
  const results: BatchSyncScanResult[] = [];

  for (const scan of sortedScans) {
    const normalizedCode = scan.ticketCode.toUpperCase().trim();
    const scanDeviceId = scan.deviceId || batchDeviceId;
    const scanGateIndex = scan.gateIndex !== undefined ? scan.gateIndex : batchGateIndex ?? null;
    const scanTotalGates = scan.totalGates !== undefined ? scan.totalGates : batchTotalGates ?? null;
    const deviceScannedAt = new Date(scan.scannedAt);
    const validDeviceDate = !Number.isNaN(deviceScannedAt.getTime())
      ? deviceScannedAt.toISOString()
      : new Date().toISOString();

    // 1. Fetch ticket and booking information
    const { rows: ticketPassRows } = await query(
      `SELECT 
        tp.id, tp.code, tp.signature, tp.status, tp.guest_name,
        tp.checked_in_at, tp.checked_in_by, tp.checked_in_device_id, tp.checked_in_device_time,
        tp.booking_id, tp.event_id,
        b.id AS booking_row_id, b.user_id AS booking_user_id,
        b.payment_status AS booking_payment_status,
        b.customer_name,
        tt.name AS ticket_type_name
       FROM public.ticket_passes tp
       INNER JOIN public.bookings b ON b.id = tp.booking_id
       LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
       WHERE tp.code = $1 AND tp.event_id = $2`,
      [normalizedCode, eventId],
    );

    const ticket = ticketPassRows[0];

    // Case 1: Ticket not found
    if (!ticket) {
      failed++;
      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, NOW(), false, 'not_found', $6, $7)`,
        [normalizedCode, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );
      results.push({
        ticketCode: normalizedCode,
        status: "not_found",
        isDuplicate: false,
        scannedAt: validDeviceDate,
        message: "Ticket not found for this event",
      });
      continue;
    }

    // Case 2: Revoked ticket
    if (ticket.status === "revoked") {
      failed++;
      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, 'revoked', $7, $8)`,
        [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );
      results.push({
        ticketCode: normalizedCode,
        status: "revoked",
        isDuplicate: false,
        scannedAt: validDeviceDate,
        guestName: ticket.guest_name || ticket.customer_name,
        ticketType: ticket.ticket_type_name,
        message: "Ticket has been revoked",
      });
      continue;
    }

    // Case 3: Unpaid ticket
    if (ticket.booking_payment_status !== "paid") {
      failed++;
      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, 'unpaid', $7, $8)`,
        [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );
      results.push({
        ticketCode: normalizedCode,
        status: "unpaid",
        isDuplicate: false,
        scannedAt: validDeviceDate,
        guestName: ticket.guest_name || ticket.customer_name,
        ticketType: ticket.ticket_type_name,
        message: "Payment for this ticket is pending",
      });
      continue;
    }

    // Case 4: Verify cryptographic HMAC signature
    let isValidSig = false;
    try {
      isValidSig = verifyTicketSignature(
        ticket.code,
        ticket.event_id,
        ticket.booking_row_id,
        ticket.signature,
      );
    } catch {
      isValidSig = false;
    }

    if (!isValidSig) {
      failed++;
      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, 'invalid_signature', $7, $8)`,
        [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );
      results.push({
        ticketCode: normalizedCode,
        status: "invalid_signature",
        isDuplicate: false,
        scannedAt: validDeviceDate,
        message: "Invalid ticket signature",
      });
      continue;
    }

    // Case 5: Fresh Check-In (Never checked in before)
    if (!ticket.checked_in_at) {
      const { rows: updatedRows } = await query(
        `UPDATE public.ticket_passes
         SET status = 'checked_in',
             checked_in_at = NOW(),
             checked_in_by = $2,
             checked_in_device_id = $3,
             checked_in_device_time = $4
         WHERE id = $1 AND checked_in_at IS NULL
         RETURNING id`,
        [ticket.id, user.id, scanDeviceId, validDeviceDate],
      );

      if (updatedRows && updatedRows.length > 0) {
        reconciledNew++;

        // Log winning audit row
        await query(
          `INSERT INTO public.scan_audit_log (
            ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
            is_duplicate, status, gate_index, total_gates
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, 'valid', $7, $8)`,
          [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
        );

        // Award XP
        try {
          const { awardXP } = await import("@/lib/gamification");
          await awardXP(ticket.booking_user_id, "attend_event", ticket.id);
        } catch (e) {
          console.error("[batch-sync] awardXP error:", e);
        }

        results.push({
          ticketCode: normalizedCode,
          status: "valid",
          isDuplicate: false,
          scannedAt: validDeviceDate,
          guestName: ticket.guest_name || ticket.customer_name,
          ticketType: ticket.ticket_type_name,
          message: "Check-in successful",
        });
        continue;
      }
    }

    // Case 6: Already checked in — Reconciliation timestamp comparison
    // Find the earlier recorded check-in device time
    const existingCheckInDeviceTime = ticket.checked_in_device_time
      ? new Date(ticket.checked_in_device_time).getTime()
      : new Date(ticket.checked_in_at).getTime();

    const currentScanTime = new Date(validDeviceDate).getTime();

    if (currentScanTime < existingCheckInDeviceTime) {
      // THIS scan is earlier than the previously recorded check-in!
      // Reconcile: update ticket_passes to attribute the check-in to this earlier operator/device
      await query(
        `UPDATE public.ticket_passes
         SET checked_in_by = $2,
             checked_in_device_id = $3,
             checked_in_device_time = $4
         WHERE id = $1`,
        [ticket.id, user.id, scanDeviceId, validDeviceDate],
      );

      // Insert audit log for this earlier scan
      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), false, 'valid', $7, $8)`,
        [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );

      reconciledNew++;
      results.push({
        ticketCode: normalizedCode,
        status: "valid",
        isDuplicate: false,
        scannedAt: validDeviceDate,
        guestName: ticket.guest_name || ticket.customer_name,
        ticketType: ticket.ticket_type_name,
        message: "Reconciled as earliest check-in",
      });
    } else {
      // THIS scan occurred AFTER the first scan — Mark as duplicate
      duplicates++;

      await query(
        `INSERT INTO public.scan_audit_log (
          ticket_code, ticket_pass_id, event_id, scanned_by, device_id, scanned_at, synced_at,
          is_duplicate, status, gate_index, total_gates
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), true, 'already_used', $7, $8)`,
        [normalizedCode, ticket.id, eventId, user.id, scanDeviceId, validDeviceDate, scanGateIndex, scanTotalGates],
      );

      results.push({
        ticketCode: normalizedCode,
        status: "already_used",
        isDuplicate: true,
        scannedAt: validDeviceDate,
        guestName: ticket.guest_name || ticket.customer_name,
        ticketType: ticket.ticket_type_name,
        message: "Duplicate scan (already checked in)",
      });
    }
  }

  return ok({
    eventId,
    totalScans: scans.length,
    reconciledNew,
    duplicates,
    failed,
    results,
    syncedAt: new Date().toISOString(),
  });
});
