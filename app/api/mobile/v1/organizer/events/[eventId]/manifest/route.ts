import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function parseEventId(eventId: string): number {
  const eventIdNum = parseInt(eventId, 10);
  if (Number.isNaN(eventIdNum)) throw MobileErrors.badRequest("Invalid event ID.");
  return eventIdNum;
}

/**
 * GET /api/mobile/v1/organizer/events/[eventId]/manifest
 *
 * Downloads the full offline ticket manifest for an event.
 * Accessible to event organizers, linked gate pass operators, and admins.
 * Returns all valid/paid tickets with their signatures and check-in statuses.
 */
export const GET = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);

  // Authorize with allowGatePass = true (organizer, linked gate pass, admin)
  const { user } = await requireMobileOrganizer(request, {
    eventId: eventIdNum,
    allowGatePass: true,
  });
  await enforceMobileRateLimit(request, user.id);

  // 1. Fetch Event Header Info
  const { rows: eventRows } = await query(
    `SELECT id, name, location_name, start_time, end_time, organizer_id, scanning_mode, total_gates 
     FROM public.events 
     WHERE id = $1 LIMIT 1`,
    [eventIdNum],
  );
  const event = eventRows[0];
  if (!event) {
    throw MobileErrors.notFound("Event not found.");
  }

  const defaultTotalGates =
    event.scanning_mode === "multi_gate" && event.total_gates && event.total_gates > 1
      ? Number(event.total_gates)
      : 1;

  // Parse gate allocation query params (fallback to event's configured default if not overridden)
  const url = new URL(request.url);
  const rawTotalGates = url.searchParams.has("totalGates")
    ? parseInt(url.searchParams.get("totalGates") || "1", 10)
    : defaultTotalGates;
  const rawGateIndex = parseInt(url.searchParams.get("gateIndex") || "0", 10);

  const totalGates = Number.isFinite(rawTotalGates) && rawTotalGates >= 1 ? Math.min(rawTotalGates, 50) : 1;
  const gateIndex =
    Number.isFinite(rawGateIndex) && rawGateIndex >= 0 && rawGateIndex < totalGates
      ? rawGateIndex
      : 0;

  // 2. Fetch all valid tickets for this event
  const { rows: tickets } = await query(
    `SELECT 
      tp.id,
      tp.code,
      tp.signature,
      tp.status,
      tp.guest_name,
      tp.checked_in_at,
      tp.assigned_gate_index,
      tp.booking_id,
      b.customer_name,
      b.customer_phone,
      tt.name AS ticket_type_name
     FROM public.ticket_passes tp
     INNER JOIN public.bookings b ON b.id = tp.booking_id
     LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
     WHERE tp.event_id = $1 
       AND tp.status != 'revoked'
       AND b.payment_status = 'paid'
     ORDER BY tp.id ASC`,
    [eventIdNum],
  );

  const allFormattedTickets = tickets.map((t) => ({
    id: Number(t.id),
    code: t.code,
    signature: t.signature,
    status: t.status,
    guestName: t.guest_name || t.customer_name || null,
    ticketType: t.ticket_type_name || "General Admission",
    assignedGateIndex:
      t.assigned_gate_index !== null && t.assigned_gate_index !== undefined
        ? Number(t.assigned_gate_index)
        : null,
    checkedInAt: t.checked_in_at ? new Date(t.checked_in_at).toISOString() : null,
    isCheckedIn: !!t.checked_in_at || t.status === "checked_in",
  }));

  const totalTickets = allFormattedTickets.length;

  // Partition tickets for this device/gate if totalGates > 1
  let gateTickets = allFormattedTickets;
  if (totalGates > 1 && totalTickets > 0) {
    const hasExplicitAssignments = allFormattedTickets.some(
      (t) => t.assignedGateIndex !== null,
    );

    if (hasExplicitAssignments) {
      // Filter directly by explicit assigned device index
      gateTickets = allFormattedTickets.filter(
        (t) => t.assignedGateIndex === gateIndex,
      );
    } else {
      // Deterministic slice fallback
      const startIndex = Math.floor((gateIndex * totalTickets) / totalGates);
      const endIndex = Math.floor(((gateIndex + 1) * totalTickets) / totalGates);
      gateTickets = allFormattedTickets.slice(startIndex, endIndex);
    }
  }

  const checkedInCount = gateTickets.filter((t) => t.isCheckedIn).length;
  const totalAssignedTickets = gateTickets.length;

  const manifestVersion = crypto
    .createHash("sha256")
    .update(`${eventIdNum}:${totalTickets}:${totalGates}:${gateIndex}:${checkedInCount}:${Date.now()}`)
    .digest("hex")
    .substring(0, 16);

  return ok({
    event: {
      id: Number(event.id),
      name: event.name,
      location: event.location_name,
      startDate: event.start_time,
      endDate: event.end_time,
      scanning_mode: event.scanning_mode || "single",
      total_gates: event.total_gates ? Number(event.total_gates) : 1,
    },
    manifestVersion,
    generatedAt: new Date().toISOString(),
    totalGates,
    gateIndex,
    deviceIndex: gateIndex,
    totalDevices: totalGates,
    totalTickets,
    assignedTicketsCount: totalAssignedTickets,
    checkedInCount,
    tickets: gateTickets,
  });
});
