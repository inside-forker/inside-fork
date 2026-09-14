import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashPassword } from "@/lib/auth/password";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const ROUTE = "/api/admin/events/[id]/device-allocation/operators";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/events/[id]/device-allocation/operators
// List available EO Gate Pass / Scanner Operator accounts
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

    // Get event organizer
    const { rows: eventRows } = await query(
      `SELECT organizer_id FROM public.events WHERE id = $1 LIMIT 1`,
      [eventId],
    );
    const organizerId = eventRows[0]?.organizer_id;

    // Fetch scanner operators
    let sql = `
      SELECT 
        p.id, 
        p.full_name, 
        p.username, 
        p.phone, 
        p.avatar_url, 
        p.linked_organizer_id,
        u.email
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE p.role = 'eo_gate_pass'
    `;
    const queryParams: any[] = [];
    if (organizerId) {
      sql += ` ORDER BY (p.linked_organizer_id = $1) DESC, p.created_at DESC`;
      queryParams.push(organizerId);
    } else {
      sql += ` ORDER BY p.created_at DESC`;
    }

    const { rows } = await query(sql, queryParams);

    const operators = rows.map((r) => ({
      id: r.id,
      name: r.full_name || r.username || "Operator",
      username: r.username,
      email: r.email,
      phone: r.phone || null,
      avatar: r.avatar_url || null,
      isLinkedToEventOrganizer: organizerId ? r.linked_organizer_id === organizerId : false,
    }));

    return NextResponse.json({
      success: true,
      data: { operators },
    });
  } catch (error) {
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch operators",
      },
      { status: 500 },
    );
  }
}

// POST /api/admin/events/[id]/device-allocation/operators
// Provision a brand new Scanner Operator account and directly assign to device_index
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const adminAuth = await requireAdmin(request);
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // 1. Fetch Event and Organizer ID
    const { rows: eventRows } = await query(
      `SELECT id, name, organizer_id FROM public.events WHERE id = $1 LIMIT 1`,
      [eventId],
    );
    if (eventRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const event = eventRows[0];
    const organizerId = event.organizer_id || adminAuth.user.id;

    const body = await request.json();
    const {
      full_name,
      email,
      phone,
      password,
      device_index,
      device_label,
    } = body;

    if (!email?.trim() || !full_name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Full name and email are required" },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = full_name.trim();

    // Generate clean username
    const baseUsername = cleanFullName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 15);
    const cleanUsername = `${baseUsername || "scanner"}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Check if email already exists
    const { rows: existingUserRows } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = $1 LIMIT 1",
      [cleanEmail],
    );
    if (existingUserRows.length > 0) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // Password resolution
    const plainPassword =
      password?.trim() || `Scanner${Math.floor(100000 + Math.random() * 900000)}!`;
    const encryptedPassword = await hashPassword(plainPassword);
    const newUserId = uuidv4();
    const now = new Date().toISOString();

    // 2. Insert into auth.users
    await query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
       VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
      [newUserId, cleanEmail, encryptedPassword, now, now, now],
    );

    // 3. Insert into public.profiles
    await query(
      `INSERT INTO public.profiles (
        id, full_name, username, role, active_role, phone,
        linked_organizer_id, membership_plan, created_at, updated_at
      ) VALUES ($1, $2, $3, 'eo_gate_pass', 'eo_gate_pass', $4, $5, 'free', $6, $7)`,
      [
        newUserId,
        cleanFullName,
        cleanUsername,
        phone?.trim() || null,
        organizerId,
        now,
        now,
      ],
    );

    // 4. If device_index is provided, link to event_device_operators immediately
    if (device_index !== undefined && device_index !== null) {
      const devIndex = Number(device_index);
      await query(
        `INSERT INTO public.event_device_operators (event_id, device_index, operator_id, device_label, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (event_id, device_index)
         DO UPDATE SET operator_id = EXCLUDED.operator_id, device_label = EXCLUDED.device_label, updated_at = NOW()`,
        [eventId, devIndex, newUserId, device_label || `Device ${devIndex + 1}`],
      );
    }

    return NextResponse.json({
      success: true,
      message: "Scanner operator account created and assigned successfully",
      data: {
        operator: {
          id: newUserId,
          name: cleanFullName,
          email: cleanEmail,
          username: cleanUsername,
          phone: phone?.trim() || null,
          role: "eo_gate_pass",
          deviceIndex: device_index !== undefined ? Number(device_index) : null,
        },
        credentials: {
          email: cleanEmail,
          password: plainPassword,
          username: cleanUsername,
        },
      },
    });
  } catch (error) {
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create scanner operator",
      },
      { status: 500 },
    );
  }
}
