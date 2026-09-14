import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashPassword } from "@/lib/auth/password";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const ROUTE = "/api/admin/accounts/eo";

// POST /api/admin/accounts/eo - Create an Event Organizer account
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
      organizer_company,
      organizer_bio,
      organizer_website,
      is_verified_organizer = true,
      custom_password,
    } = body;

    // Required fields
    if (!email?.trim() || !full_name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Email and full name are required" },
        { status: 400 },
      );
    }

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
      // Auto-generate username from full_name or email prefix if not supplied
      const base = (full_name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "")).slice(0, 15);
      const suffix = Math.floor(1000 + Math.random() * 9000);
      cleanUsername = `${base}_${suffix}`.slice(0, 30);
    }

    // Check if email already exists
    const { rows: existingEmailRows } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [cleanEmail],
    );
    if (existingEmailRows.length > 0) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    // Password generation
    const tempPassword = custom_password?.trim() || (crypto.randomBytes(6).toString("hex") + "Eo!");
    if (custom_password && custom_password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    const encryptedPassword = await hashPassword(tempPassword);
    const newUserId = uuidv4();
    const now = new Date().toISOString();

    // 1. Insert into auth.users
    await query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
       VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
      [newUserId, cleanEmail, encryptedPassword, now, now, now],
    );

    // 2. Insert / Upsert into profiles
    const { rows: existingProfileRows } = await query(
      "SELECT id FROM public.profiles WHERE id = $1 LIMIT 1",
      [newUserId],
    );

    if (existingProfileRows.length > 0) {
      await query(
        `UPDATE public.profiles SET 
          full_name = $1, 
          username = $2, 
          role = 'organizer', 
          active_role = 'organizer',
          phone = $3,
          organizer_company = $4,
          organizer_bio = $5,
          organizer_website = $6,
          is_verified_organizer = $7,
          updated_at = $8
         WHERE id = $9`,
        [
          full_name.trim(),
          cleanUsername,
          phone?.trim() || null,
          organizer_company?.trim() || null,
          organizer_bio?.trim() || null,
          organizer_website?.trim() || null,
          !!is_verified_organizer,
          now,
          newUserId,
        ],
      );
    } else {
      await query(
        `INSERT INTO public.profiles (
          id, full_name, username, role, active_role, phone,
          organizer_company, organizer_bio, organizer_website, is_verified_organizer,
          membership_plan, created_at, updated_at
        ) VALUES ($1, $2, $3, 'organizer', 'organizer', $4, $5, $6, $7, $8, 'pro', $9, $10)`,
        [
          newUserId,
          full_name.trim(),
          cleanUsername,
          phone?.trim() || null,
          organizer_company?.trim() || null,
          organizer_bio?.trim() || null,
          organizer_website?.trim() || null,
          !!is_verified_organizer,
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
          role: "organizer",
          phone: phone?.trim() || null,
          organizer_company: organizer_company?.trim() || null,
          organizer_bio: organizer_bio?.trim() || null,
          organizer_website: organizer_website?.trim() || null,
          is_verified_organizer: !!is_verified_organizer,
          created_at: now,
        },
        tempPassword,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CREATE EO] Error after ${duration}ms:`, error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
