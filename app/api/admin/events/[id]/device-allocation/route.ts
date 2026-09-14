import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashPassword } from "@/lib/auth/password";

const ROUTE = "/api/admin/events/[id]/device-allocation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/events/[id]/device-allocation
// Returns event config, devices list with assigned operators and labels, attendee list, and summary stats
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

    // 2. Fetch Device Operator Assignments & Labels
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
       LEFT JOIN public.profiles p ON p.id = edo.operator_id
       LEFT JOIN auth.users u ON u.id = edo.operator_id
       WHERE edo.event_id = $1
       ORDER BY edo.device_index ASC`,
      [eventId],
    );

    // Map operator & label by device_index
    const savedByDevice: Record<
      number,
      {
        deviceLabel: string;
        operatorId: string | null;
        operatorName: string | null;
        operatorEmail: string | null;
        operatorPhone: string | null;
        operatorAvatar: string | null;
      }
    > = {};
    const labelsByDevice: Record<number, string> = {};

    operatorRows.forEach((row) => {
      const idx = Number(row.device_index);
      const label = row.device_label || `Device ${idx + 1}`;
      labelsByDevice[idx] = label;
      savedByDevice[idx] = {
        deviceLabel: label,
        operatorId: row.operator_id || null,
        operatorName: row.operator_name || "Unnamed Operator",
        operatorEmail: row.operator_email || null,
        operatorPhone: row.operator_phone || null,
        operatorAvatar: row.operator_avatar || null,
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

    const tickets = ticketRows.map((t) => {
      const gateIdx =
        t.assigned_gate_index !== null && t.assigned_gate_index !== undefined
          ? Number(t.assigned_gate_index)
          : null;
      const deviceLabel =
        gateIdx !== null
          ? labelsByDevice[gateIdx] || `Device ${gateIdx + 1}`
          : null;

      return {
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
        assignedDeviceIndex: gateIdx,
        assignedDeviceLabel: deviceLabel,
        checkedInAt: t.checked_in_at ? new Date(t.checked_in_at).toISOString() : null,
        isCheckedIn: !!t.checked_in_at || t.status === "checked_in",
      };
    });

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

    // 5. Construct Device Slots (Device 1 / GATE A, Device 2 / GATE B, ...)
    const deviceSlots = [];
    for (let i = 0; i < totalDevices; i++) {
      const saved = savedByDevice[i];
      const label = saved?.deviceLabel || labelsByDevice[i] || `Device ${i + 1}`;

      deviceSlots.push({
        deviceIndex: i,
        deviceNumber: i + 1,
        label,
        assignedOperator: saved?.operatorId
          ? {
              operatorId: saved.operatorId,
              name: saved.operatorName,
              email: saved.operatorEmail,
              phone: saved.operatorPhone,
              avatar: saved.operatorAvatar,
              deviceLabel: label,
            }
          : null,
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
// Handles architecture updates, label updates, credentials updates, single/bulk ticket device assignment, auto-distribution, and operator linking
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

    // 2. Action: Update Device Slot Label (e.g., "GATE A", "GATE B", "VIP Gate")
    if (action === "update_device_label") {
      const { device_index, device_label } = body;
      if (device_index === undefined || device_index === null) {
        return NextResponse.json(
          { success: false, error: "device_index is required" },
          { status: 400 },
        );
      }

      const devIndex = Number(device_index);
      const cleanLabel = (device_label || "").trim() || `Device ${devIndex + 1}`;

      await query(
        `INSERT INTO public.event_device_operators (event_id, device_index, device_label, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (event_id, device_index)
         DO UPDATE SET device_label = EXCLUDED.device_label, updated_at = NOW()`,
        [eventId, devIndex, cleanLabel],
      );

      return NextResponse.json({
        success: true,
        message: `Updated label for Device ${devIndex + 1} to "${cleanLabel}"`,
        data: { deviceIndex: devIndex, deviceLabel: cleanLabel },
      });
    }

    // 3. Action: Update Operator Credentials (Email, Password, Name) & Device Label
    if (action === "update_operator_credentials") {
      const { operator_id, full_name, email, password, phone, device_index, device_label } = body;
      if (!operator_id) {
        return NextResponse.json(
          { success: false, error: "operator_id is required" },
          { status: 400 },
        );
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
          { success: false, error: "Operator account not found" },
          { status: 404 },
        );
      }

      // 1. Update profiles table if name or phone provided
      if (full_name?.trim() || phone !== undefined) {
        const updateParts: string[] = [];
        const paramsList: (string | null)[] = [];
        let pIdx = 1;

        if (full_name?.trim()) {
          updateParts.push(`full_name = $${pIdx++}`);
          paramsList.push(full_name.trim());
        }
        if (phone !== undefined) {
          updateParts.push(`phone = $${pIdx++}`);
          paramsList.push(phone?.trim() || null);
        }
        updateParts.push(`updated_at = NOW()`);
        paramsList.push(operator_id);

        await query(
          `UPDATE public.profiles SET ${updateParts.join(", ")} WHERE id = $${pIdx}`,
          paramsList,
        );
      }

      // 2. Update auth.users if email or password provided
      if (email?.trim() || password?.trim()) {
        const userUpdates: string[] = [];
        const userParams: (string | null)[] = [];
        let uIdx = 1;

        if (email?.trim()) {
          const cleanEmail = email.trim().toLowerCase();
          // Check email uniqueness
          const { rows: conflictUsers } = await query(
            "SELECT id FROM auth.users WHERE LOWER(email) = $1 AND id != $2 LIMIT 1",
            [cleanEmail, operator_id],
          );
          if (conflictUsers.length > 0) {
            return NextResponse.json(
              { success: false, error: "An account with this email already exists" },
              { status: 409 },
            );
          }
          userUpdates.push(`email = $${uIdx++}`);
          userParams.push(cleanEmail);
        }

        if (password?.trim()) {
          if (password.trim().length < 6) {
            return NextResponse.json(
              { success: false, error: "Password must be at least 6 characters long" },
              { status: 400 },
            );
          }
          const encrypted = await hashPassword(password.trim());
          userUpdates.push(`encrypted_password = $${uIdx++}`);
          userParams.push(encrypted);
        }

        userUpdates.push(`updated_at = NOW()`);
        userParams.push(operator_id);

        await query(
          `UPDATE auth.users SET ${userUpdates.join(", ")} WHERE id = $${uIdx}`,
          userParams,
        );
      }

      // 3. Update device label if provided
      if (device_index !== undefined && device_index !== null && device_label?.trim()) {
        const devIndex = Number(device_index);
        await query(
          `UPDATE public.event_device_operators 
           SET device_label = $1, updated_at = NOW() 
           WHERE event_id = $2 AND device_index = $3`,
          [device_label.trim(), eventId, devIndex],
        );
      }

      return NextResponse.json({
        success: true,
        message: "Operator credentials and device settings updated successfully",
      });
    }

    // 4. Action: Assign Specific Ticket Passes to a Device Slot
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

    // 5. Action: Smart Booking-Aware Auto-Distribution Across Devices
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

      // Fetch current device loads
      const { rows: loadRows } = await query(
        `SELECT assigned_gate_index, COUNT(*)::int AS count
         FROM public.ticket_passes
         WHERE event_id = $1 AND status != 'revoked' AND assigned_gate_index IS NOT NULL
         GROUP BY assigned_gate_index`,
        [eventId],
      );

      const deviceLoads: Record<number, number> = {};
      for (let i = 0; i < totalDevs; i++) {
        deviceLoads[i] = 0;
      }

      if (only_unassigned) {
        loadRows.forEach((r) => {
          const idx = Number(r.assigned_gate_index);
          if (idx >= 0 && idx < totalDevs) {
            deviceLoads[idx] = Number(r.count);
          }
        });
      }

      // Fetch target tickets grouped by booking_id
      let ticketQuery = `
        SELECT id, booking_id FROM public.ticket_passes 
        WHERE event_id = $1 AND status != 'revoked'
      `;
      if (only_unassigned) {
        ticketQuery += ` AND assigned_gate_index IS NULL`;
      }
      ticketQuery += ` ORDER BY booking_id ASC, id ASC`;

      const { rows: targetTickets } = await query(ticketQuery, [eventId]);

      if (targetTickets.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No tickets to distribute",
          data: { totalAssigned: 0, totalDevices: totalDevs },
        });
      }

      // Group tickets by booking_id to keep group/family bookings together at the same gate
      const bookingGroups = new Map<number, number[]>();
      targetTickets.forEach((t) => {
        const bId = Number(t.booking_id);
        const list = bookingGroups.get(bId) || [];
        list.push(Number(t.id));
        bookingGroups.set(bId, list);
      });

      // Smart allocation: assign each booking to the gate with the lowest head count
      let totalAssigned = 0;
      for (const [_bId, ticketIds] of bookingGroups.entries()) {
        let minDeviceIndex = 0;
        let minLoad = deviceLoads[0];
        for (let i = 1; i < totalDevs; i++) {
          if (deviceLoads[i] < minLoad) {
            minLoad = deviceLoads[i];
            minDeviceIndex = i;
          }
        }

        await query(
          `UPDATE public.ticket_passes 
           SET assigned_gate_index = $1 
           WHERE id = ANY($2::bigint[])`,
          [minDeviceIndex, ticketIds],
        );

        deviceLoads[minDeviceIndex] += ticketIds.length;
        totalAssigned += ticketIds.length;
      }

      return NextResponse.json({
        success: true,
        message: `Smartly auto-distributed ${totalAssigned} tickets across ${totalDevs} devices (bookings grouped together)`,
        data: { totalAssigned, totalDevices: totalDevs, deviceLoads },
      });
    }

    // 6. Action: Assign Operator Profile to Device Slot
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
        // Unlink operator from device slot, but preserve device_label
        await query(
          `UPDATE public.event_device_operators 
           SET operator_id = NULL, updated_at = NOW() 
           WHERE event_id = $1 AND device_index = $2`,
          [eventId, devIndex],
        );
        return NextResponse.json({
          success: true,
          message: `Unlinked operator from Device ${devIndex + 1}`,
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
         DO UPDATE SET operator_id = EXCLUDED.operator_id, 
                       device_label = COALESCE(EXCLUDED.device_label, public.event_device_operators.device_label), 
                       updated_at = NOW()`,
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

    // 7. Action: Clear all ticket assignments
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
