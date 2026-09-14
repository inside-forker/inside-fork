import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { hashPassword } from "@/lib/auth/password";
import { v4 as uuidv4 } from "uuid";

const ROUTE = "/api/admin/users";

// GET /api/admin/users - Get all users with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    // Use existing admin authentication utility
    const adminAuth = await requireAdmin(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const offset = (page - 1) * limit;

    // Build query using direct SQL
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (adminAuth.profile.role !== "super_admin") {
      conditions.push(`p.role != 'super_admin'`);
    }
    if (search) {
      conditions.push(`p.full_name ILIKE $${paramIdx}`);
      params.push(`%${search}%`);
      paramIdx++;
    }
    const validRoles = ["public_user", "business_owner", "writer", "lister", "data_entry", "organizer", "eo_gate_pass", "admin", "super_admin"];
    if (role && validRoles.includes(role)) {
      conditions.push(`p.role = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    if (status === "active") {
      conditions.push(`p.updated_at >= $${paramIdx}`);
      params.push(thirtyDaysAgo);
      paramIdx++;
    } else if (status === "inactive") {
      conditions.push(`p.updated_at < $${paramIdx}`);
      params.push(thirtyDaysAgo);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const usersSql = `
      SELECT p.id, p.full_name, p.username, p.avatar_url, p.role, p.active_role,
             p.membership_plan, p.phone, p.created_at, p.updated_at, p.deleted_at,
             u.email, u.email_confirmed_at, u.last_sign_in_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      ${where}
    `;
    const countParams = params.slice(0, paramIdx - 1);

    const { rows: users } = await query(usersSql, params);
    const { rows: countRows } = await query(countSql, countParams);
    const total = (countRows[0] as { total: number })?.total ?? 0;

    const transformedUsers = users.map((user) => {
      const u = user as Record<string, unknown>;
      return {
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        email: u.email || null,
        avatar_url: u.avatar_url,
        role: u.role,
        active_role: u.active_role,
        membership_plan: u.membership_plan,
        phone: u.phone,
        email_confirmed: !!u.email_confirmed_at,
        last_sign_in: u.last_sign_in_at || null,
        created_at: u.created_at,
        updated_at: u.updated_at,
        deleted_at: u.deleted_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        users: transformedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: { search, role, status },
      },
    });
  } catch (error) {
    console.error("Admin users API error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/admin/users - Create a new user
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
    const { full_name, username, email, role, membership_plan, phone } = body;

    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: "Email and role are required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 },
      );
    }

    const disposableDomains = await import("disposable-email-domains");
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain && disposableDomains.default.includes(emailDomain)) {
      return NextResponse.json(
        { success: false, error: "Disposable email addresses are not allowed" },
        { status: 400 },
      );
    }

    const validCreateRoles = ["public_user", "business_owner", "writer", "lister", "data_entry", "organizer", "eo_gate_pass", "admin", "super_admin"];
    if (!validCreateRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 },
      );
    }

    // Get admin's role for role escalation check (from the requireAdmin result)
    const adminRole = adminAuth.profile.role;

    if (role === "super_admin" && adminRole !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super_admin can create super_admin users" },
        { status: 403 },
      );
    }
    if (role === "admin" && adminRole !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "Only super_admin can create admin users" },
        { status: 403 },
      );
    }

    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return NextResponse.json(
          { success: false, error: "Username must be 3-30 characters and contain only letters, numbers, and underscores" },
          { status: 400 },
        );
      }

      const { rows: existingUsernames } = await query(
        "SELECT id FROM public.profiles WHERE LOWER(username) = LOWER($1) LIMIT 1",
        [username]
      );
      if (existingUsernames.length > 0) {
        return NextResponse.json(
          { success: false, error: "Username is already taken" },
          { status: 409 },
        );
      }
    }

    // Check if user with this email already exists
    const { rows: existingEmailRows } = await query(
      "SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );
    if (existingEmailRows.length > 0) {
      return NextResponse.json(
        { success: false, error: "User with this email already exists" },
        { status: 409 },
      );
    }

    // Generate secure temporary password and hash it
    const crypto = await import("crypto");
    const tempPassword = crypto.randomBytes(8).toString("hex") + "Temp!";
    const encryptedPassword = await hashPassword(tempPassword);
    const newUserId = uuidv4();
    const now = new Date().toISOString();

    // Insert into auth.users directly
    await query(
      `INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, role, aud)
       VALUES ($1, $2, $3, $4, $5, $6, 'authenticated', 'authenticated')`,
      [newUserId, email, encryptedPassword, now, now, now]
    );

    // Upsert profile (trigger may have created it already, or not)
    const { rows: existingProfileRows } = await query(
      "SELECT id FROM public.profiles WHERE id = $1 LIMIT 1",
      [newUserId]
    );

    if (existingProfileRows.length > 0) {
      await query(
        `UPDATE public.profiles SET full_name=$1, username=$2, role=$3, active_role=$4,
         membership_plan=$5, phone=$6 WHERE id=$7`,
        [full_name || null, username || null, role, role, membership_plan || "free", phone || null, newUserId]
      );
    } else {
      await query(
        `INSERT INTO public.profiles (id, full_name, username, role, active_role, membership_plan, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newUserId, full_name || null, username || null, role, role, membership_plan || "free", phone || null]
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: newUserId,
          full_name: full_name || null,
          username: username || null,
          email,
          role,
          membership_plan: membership_plan || "free",
          phone: phone || null,
          email_confirmed: true,
          created_at: now,
          updated_at: now,
        },
        tempPassword,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CREATE USER] Unexpected error after ${duration}ms:`, error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
