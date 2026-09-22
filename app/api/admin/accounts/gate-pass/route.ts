import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashPassword } from "@/lib/auth/password";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const ROUTE = "/api/admin/accounts/gate-pass";

// POST /api/admin/accounts/gate-pass - Create an EO Gate Pass Operator account
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const adminAuth = await requireAdmin(request);

    // Rate limiting
    const { userCreationLimiter } = await import("@/lib/rate-limiter");
    const rateLimitCheck = userCreationLimiter.check(adminAuth.user.id);

    if (!rateLimitCheck.allowed) {
      const resetInSeconds = Math.ceil(
        (rateLimitCheck.resetTime - Date.now()) / 1000,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
          retryAfter: resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": resetInSeconds.toString(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": rateLimitCheck.remaining.toString(),
          },
        },
      );
    }

    const body = await request.json();
    const {
      full_name,
      username,
      email,
      phone,
      linked_organizer_id,
      custom_password,
    } = body;

    // Required fields
    if (!email?.trim() || !full_name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Email and operator full name are required" },
        { status: 400 },
      );
    }

    if (!linked_organizer_id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "A linked Event Organizer is required for Gate Pass operators",
        },
        { status: 400 },
      );
    }

    // Verify linked organizer exists and has organizer/admin role
    const { rows: organizerRows } = await query(
      `SELECT id, full_name, role, organizer_company FROM public.profiles 
       WHERE id = $1 AND role IN ('organizer', 'admin', 'super_admin') LIMIT 1`,
      [linked_organizer_id.trim()],
    );

    if (organizerRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The specified Event Organizer was not found or is not a valid organizer",
        },
        { status: 404 },
      );
    }

    const linkedOrganizer = organizerRows[0] as {
      id: string;
      full_name: string | null;
      role: string;
      organizer_company: string | null;
    };

    const cleanEmail = email.trim().toLowerCase();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    // Disposable email check
    const disposableDomains = await import("disposable-email-domains");
    const emailDomain = cleanEmail.split("@")[1];
    if (emailDomain && disposableDomains.default.includes(emailDomain)) {
      return NextResponse.json(
        { success: false, error: "Disposable email addresses are not allowed" },
        { status: 400 },
      );
    }

    // Username validation if provided
    let cleanUsername = username?.trim() || null;
    if (cleanUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(cleanUsername)) {
        return NextResponse.json(
          {
            success: false,
            error: "Username must be 3-30 characters and contain only letters, numbers, and underscores",
          },
          { status: 400 },
        );
      }

      const { rows: existingUsernames } = await query(
        "SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1",
        [cleanUsername],
      );
      if (existingUsernames.length > 0) {
        return NextResponse.json(
          { success: false, error: "Username is already taken" },
          { status: 409 },
        );
      }
    } else {
      const base = (full_name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "gatepass").slice(0, 15);
      const suffix = Math.floor(1000 + Math.random() * 9000);
      cleanUsername = `gate_${base}_${suffix}`.slice(0, 30);
    }

    // Check if email already exists (incl. orphans from trigger-created stub profiles)
    const { rows: existingEmailRows } = await query(
      `SELECT u.id, p.role
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       WHERE LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [cleanEmail],
    );

    // Password generation
    const tempPassword = custom_password?.trim() || (crypto.randomBytes(6).toString("hex") + "Gp!");
    if (custom_password && custom_password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    const encryptedPassword = await hashPassword(tempPassword);
    const now = new Date().toISOString();
    let newUserId: string;

    if (existingEmailRows.length > 0) {
      const existing = existingEmailRows[0];
      const existingRole = existing.role as string | null;
      const reclaimable =
        !existingRole ||
        existingRole === "public_user" ||
        existingRole === "eo_gate_pass";

      if (!reclaimable) {
        return NextResponse.json(
          { success: false, error: "An account with this email already exists" },
          { status: 409 },
        );
      }

      newUserId = existing.id as string;

      await query(
        `UPDATE auth.users
         SET encrypted_password = $1, email_confirmed_at = COALESCE(email_confirmed_at, $2), updated_at = $2
         WHERE id = $3`,
        [encryptedPassword, now, newUserId],
      );

      await query(
        `UPDATE public.profiles SET
          full_name = $1,
          username = CASE
            WHEN username IS NULL OR username LIKE 'user_%' THEN $2
            ELSE COALESCE($2, username)
          END,
          role = 'eo_gate_pass',
          active_role = 'eo_gate_pass',
          phone = COALESCE($3, phone),
          linked_organizer_id = $4,
          updated_at = $5
         WHERE id = $6`,
        [
          full_name.trim(),
          cleanUsername,
          phone?.trim() || null,
          linked_organizer_id.trim(),
          now,
          newUserId,
        ],
      );
    } else {
      newUserId = uuidv4();

      // 1. Insert into auth.users (trigger creates a stub profiles row)
      await query(
        `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
         VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
        [newUserId, cleanEmail, encryptedPassword, now, now, now],
      );

      // 2. Upsert profile over the trigger stub
      await query(
        `INSERT INTO public.profiles (
          id, full_name, username, role, active_role, phone,
          linked_organizer_id, membership_plan, created_at, updated_at
        ) VALUES ($1, $2, $3, 'eo_gate_pass', 'eo_gate_pass', $4, $5, 'free', $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username,
          role = 'eo_gate_pass',
          active_role = 'eo_gate_pass',
          phone = EXCLUDED.phone,
          linked_organizer_id = EXCLUDED.linked_organizer_id,
          updated_at = EXCLUDED.updated_at`,
        [
          newUserId,
          full_name.trim(),
          cleanUsername,
          phone?.trim() || null,
          linked_organizer_id.trim(),
          now,
          now,
        ],
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: newUserId,
          full_name: full_name.trim(),
          username: cleanUsername,
          email: cleanEmail,
          role: "eo_gate_pass",
          phone: phone?.trim() || null,
          linked_organizer_id: linked_organizer_id.trim(),
          linked_organizer_name: linkedOrganizer.full_name,
          linked_organizer_company: linkedOrganizer.organizer_company,
          created_at: now,
        },
        tempPassword,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CREATE GATE PASS] Error after ${duration}ms:`, error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
