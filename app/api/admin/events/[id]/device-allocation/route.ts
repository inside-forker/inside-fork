import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/events/[id]/device-allocation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/events/[id]/device-allocation
// Returns event config, devices list with assigned operators, attendee list, and summary stats
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // 1. Fetch Event Header Info & Organizer details
    const { rows: eventRows } = await query(
      `SELECT 
        e.id, 
        e.name, 
        e.description,
        e.location_name, 
        e.start_time, 
        e.end_time, 
        e.organizer_id, 
        e.scanning_mode, 
        e.total_gates,
        p.full_name AS organizer_name,
        u.email AS organizer_email,
        p.organizer_company
       FROM public.events e
       LEFT JOIN public.profiles p ON p.id = e.organizer_id
       LEFT JOIN auth.users u ON u.id = e.organizer_id
       WHERE e.id = $1 LIMIT 1`,
      [eventId],
    );

    if (eventRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const event = eventRows[0];
    const scanningMode = event.scanning_mode || "single";
    const totalDevices =
      scanningMode === "multi_gate" && event.total_gates && event.total_gates > 1
        ? Number(event.total_gates)
        : 1;

    // 2. Fetch Device Operator Assignments
    const { rows: operatorRows } = await query(
      `SELECT 
        edo.device_index,
        edo.device_label,
        edo.operator_id,
        edo.created_at,
        p.full_name AS operator_name,
        u.email AS operator_email,
        p.phone AS operator_phone,
        p.avatar_url AS operator_avatar
       FROM public.event_device_operators edo
       INNER JOIN public.profiles p ON p.id = edo.operator_id
       LEFT JOIN auth.users u ON u.id = edo.operator_id
       WHERE edo.event_id = $1
       ORDER BY edo.device_index ASC`,
      [eventId],
    );

    // Map operator by device_index
    const operatorsByDevice: Record<number, any> = {};
    operatorRows.forEach((row) => {
      operatorsByDevice[Number(row.device_index)] = {
        operatorId: row.operator_id,
        name: row.operator_name || "Unnamed Operator",
        email: row.operator_email,
        phone: row.operator_phone || null,
        avatar: row.operator_avatar || null,
        deviceLabel: row.device_label || `Device ${Number(row.device_index) + 1}`,
      };
    });

    // 3. Fetch all Valid Tickets for this event
    const { rows: ticketRows } = await query(
      `SELECT 
        tp.id,
        tp.code,
        tp.status,
        tp.guest_name,
        tp.checked_in_at,
        tp.assigned_gate_index,
        tp.ticket_type_id,
        b.id AS booking_id,
        COALESCE(b.booking_reference, b.id::text) AS booking_code,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.created_at AS booking_date,
        tt.name AS ticket_type_name,
        tt.price AS ticket_price
       FROM public.ticket_passes tp
       INNER JOIN public.bookings b ON b.id = tp.booking_id
       LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
       WHERE tp.event_id = $1
         AND tp.status != 'revoked'
         AND b.payment_status = 'paid'
       ORDER BY tp.id ASC`,
      [eventId],
    );

    const tickets = ticketRows.map((t) => ({
      id: Number(t.id),
      code: t.code,
      status: t.status,
      guestName: t.guest_name || t.customer_name || "Guest",
      customerName: t.customer_name,
      customerPhone: t.customer_phone,
      customerEmail: t.customer_email,
      bookingCode: t.booking_code,
      bookingId: Number(t.booking_id),
      ticketTypeId: t.ticket_type_id ? Number(t.ticket_type_id) : null,
      ticketTypeName: t.ticket_type_name || "Standard Pass",
      ticketPrice: t.ticket_price ? Number(t.ticket_price) : 0,
      assignedDeviceIndex:
        t.assigned_gate_index !== null && t.assigned_gate_index !== undefined
          ? Number(t.assigned_gate_index)
          : null,
      checkedInAt: t.checked_in_at ? new Date(t.checked_in_at).toISOString() : null,
      isCheckedIn: !!t.checked_in_at || t.status === "checked_in",
    }));

    // 4. Calculate Summary Statistics
    const totalTickets = tickets.length;
    const deviceCounts: Record<number, { total: number; checkedIn: number }> = {};
    for (let i = 0; i < totalDevices; i++) {
      deviceCounts[i] = { total: 0, checkedIn: 0 };
    }

    let unassignedCount = 0;
    let totalCheckedInCount = 0;

    tickets.forEach((t) => {
      if (t.isCheckedIn) totalCheckedInCount++;
      if (t.assignedDeviceIndex !== null && t.assignedDeviceIndex < totalDevices) {
        deviceCounts[t.assignedDeviceIndex].total += 1;
        if (t.isCheckedIn) deviceCounts[t.assignedDeviceIndex].checkedIn += 1;
      } else {
        unassignedCount++;
      }
    });

    // 5. Construct Device Slots (Device 1, Device 2, ...)
    const deviceSlots = [];
    for (let i = 0; i < totalDevices; i++) {
      deviceSlots.push({
        deviceIndex: i,
        deviceNumber: i + 1,
        label: `Device ${i + 1}`,
        assignedOperator: operatorsByDevice[i] || null,
        assignedTicketsCount: deviceCounts[i]?.total || 0,
        checkedInCount: deviceCounts[i]?.checkedIn || 0,
        percentage:
          totalTickets > 0
            ? Math.round(((deviceCounts[i]?.total || 0) / totalTickets) * 100)
            : 0,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        event: {
          id: Number(event.id),
          name: event.name,
          location: event.location_name,
          startTime: event.start_time,
          endTime: event.end_time,
          organizerId: event.organizer_id,
          organizerName: event.organizer_name || "Organizer",
          organizerEmail: event.organizer_email,
          organizerCompany: event.organizer_company,
          scanningMode,
          totalDevices,
        },
        deviceSlots,
        summary: {
          totalTickets,
          totalCheckedInCount,
          unassignedCount,
          isFullyAssigned: unassignedCount === 0 && totalTickets > 0,
        },
        tickets,
      },
    });
  } catch (error) {
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load device allocation",
      },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/events/[id]/device-allocation
// Handles architecture updates, single/bulk ticket device assignment, auto-distribution, and operator linking
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { action } = body;

    // 1. Action: Update Scanning Mode & Device Count
    if (action === "update_architecture") {
      const { scanning_mode, total_devices } = body;
      const validMode = scanning_mode === "multi_gate" ? "multi_gate" : "single";
      const totalDevs =
        validMode === "multi_gate"
          ? Math.max(2, Math.min(Number(total_devices) || 2, 20))
          : 1;

      await query(
        `UPDATE public.events 
         SET scanning_mode = $1, total_gates = $2, updated_at = NOW() 
         WHERE id = $3`,
        [validMode, totalDevs, eventId],
      );

      // If switched to single, or device count shrunk, unassign invalid devices
      if (validMode === "single") {
        await query(
          `UPDATE public.ticket_passes 
           SET assigned_gate_index = NULL 
           WHERE event_id = $1`,
          [eventId],
        );
      } else {
        await query(
          `UPDATE public.ticket_passes 
           SET assigned_gate_index = NULL 
           WHERE event_id = $1 AND assigned_gate_index >= $2`,
          [eventId, totalDevs],
        );
      }

      return NextResponse.json({
        success: true,
        message: "Device architecture updated successfully",
        data: { scanning_mode: validMode, total_devices: totalDevs },
      });
    }

    // 2. Action: Assign Specific Ticket Passes to a Device Slot
    if (action === "assign_tickets") {
      const { ticket_pass_ids, assigned_device_index } = body;
      if (!Array.isArray(ticket_pass_ids) || ticket_pass_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: "ticket_pass_ids array is required" },
          { status: 400 },
        );
      }

      const targetIndex =
        assigned_device_index === null || assigned_device_index === undefined
          ? null
          : Math.max(0, Number(assigned_device_index));

      await query(
        `UPDATE public.ticket_passes 
         SET assigned_gate_index = $1 
         WHERE event_id = $2 AND id = ANY($3::bigint[])`,
        [targetIndex, eventId, ticket_pass_ids],
      );

      return NextResponse.json({
        success: true,
        message: `Updated ${ticket_pass_ids.length} ticket assignments`,
        data: { count: ticket_pass_ids.length, assigned_device_index: targetIndex },
      });
    }

    // 3. Action: Auto-Distribute Tickets Evenly Across Devices (Round-Robin)
    if (action === "auto_distribute") {
      const { only_unassigned = false } = body;

      // Fetch event total_gates
      const { rows: eventRows } = await query(
        `SELECT total_gates, scanning_mode FROM public.events WHERE id = $1`,
        [eventId],
      );
      if (eventRows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Event not found" },
          { status: 404 },
        );
      }

      const totalDevs = Math.max(1, Number(eventRows[0].total_gates) || 1);

      // Fetch target tickets
      let ticketQuery = `
        SELECT id FROM public.ticket_passes 
        WHERE event_id = $1 AND status != 'revoked'
      `;
      if (only_unassigned) {
        ticketQuery += ` AND assigned_gate_index IS NULL`;
      }
      ticketQuery += ` ORDER BY id ASC`;

      const { rows: targetTickets } = await query(ticketQuery, [eventId]);

      // Distribute in round-robin fashion or contiguous slices
      for (let i = 0; i < targetTickets.length; i++) {
        const assignedIndex = i % totalDevs;
        await query(
          `UPDATE public.ticket_passes 
           SET assigned_gate_index = $1 
           WHERE id = $2`,
          [assignedIndex, targetTickets[i].id],
        );
      }

      return NextResponse.json({
        success: true,
        message: `Auto-distributed ${targetTickets.length} tickets across ${totalDevs} devices`,
        data: { totalAssigned: targetTickets.length, totalDevices: totalDevs },
      });
    }

    // 4. Action: Assign Operator Profile to Device Slot
    if (action === "assign_operator") {
      const { device_index, operator_id, device_label } = body;
      if (device_index === undefined || device_index === null) {
        return NextResponse.json(
          { success: false, error: "device_index is required" },
          { status: 400 },
        );
      }

      const devIndex = Number(device_index);

      if (!operator_id) {
        // Remove operator assignment
        await query(
          `DELETE FROM public.event_device_operators 
           WHERE event_id = $1 AND device_index = $2`,
          [eventId, devIndex],
        );
        return NextResponse.json({
          success: true,
          message: `Removed operator from Device ${devIndex + 1}`,
        });
      }

      // Verify operator exists
      const { rows: opRows } = await query(
        `SELECT p.id, p.full_name, u.email 
         FROM public.profiles p 
         LEFT JOIN auth.users u ON u.id = p.id 
         WHERE p.id = $1 LIMIT 1`,
        [operator_id],
      );
      if (opRows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Operator profile not found" },
          { status: 404 },
        );
      }

      // Upsert into event_device_operators
      await query(
        `INSERT INTO public.event_device_operators (event_id, device_index, operator_id, device_label, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (event_id, device_index)
         DO UPDATE SET operator_id = EXCLUDED.operator_id, device_label = EXCLUDED.device_label, updated_at = NOW()`,
        [eventId, devIndex, operator_id, device_label || `Device ${devIndex + 1}`],
      );

      return NextResponse.json({
        success: true,
        message: `Assigned ${opRows[0].full_name || opRows[0].email} to Device ${devIndex + 1}`,
        data: {
          deviceIndex: devIndex,
          operatorId: operator_id,
          operatorName: opRows[0].full_name,
        },
      });
    }

    // 5. Action: Clear all ticket assignments
    if (action === "clear_all_assignments") {
      await query(
        `UPDATE public.ticket_passes 
         SET assigned_gate_index = NULL 
         WHERE event_id = $1`,
        [eventId],
      );
      return NextResponse.json({
        success: true,
        message: "Cleared all attendee device assignments",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action specified" },
      { status: 400 },
    );
  } catch (error) {
    captureRouteError(error, { route: ROUTE, method: "PATCH" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update device allocation",
      },
      { status: 500 },
    );
  }
}
