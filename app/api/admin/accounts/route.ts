import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/accounts";

// GET /api/admin/accounts - Get EO and Gate Pass operators with linked data and stats
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role") || ""; // 'organizer', 'eo_gate_pass', or '' (all)
    const organizerId = searchParams.get("organizer_id") || ""; // filter gate passes by linked EO

    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Filter to only EO and EO Gate Pass roles
    if (role === "organizer" || role === "eo_gate_pass") {
      conditions.push(`p.role = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    } else {
      conditions.push(`p.role IN ('organizer', 'eo_gate_pass')`);
    }

    if (organizerId) {
      conditions.push(`p.linked_organizer_id = $${paramIdx}`);
      params.push(organizerId);
      paramIdx++;
    }

    if (search) {
      conditions.push(`(
        p.full_name ILIKE $${paramIdx} OR
        p.username ILIKE $${paramIdx} OR
        u.email ILIKE $${paramIdx} OR
        p.organizer_company ILIKE $${paramIdx}
      )`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Fetch accounts with linked EO name and company
    const accountsSql = `
      SELECT 
        p.id, 
        p.full_name, 
        p.username, 
        p.avatar_url, 
        p.role, 
        p.active_role,
        p.phone, 
        p.organizer_company, 
        p.organizer_bio, 
        p.organizer_website, 
        p.is_verified_organizer,
        p.linked_organizer_id,
        p.created_at, 
        p.updated_at,
        u.email, 
        u.email_confirmed_at, 
        u.last_sign_in_at,
        eo.full_name AS linked_organizer_name,
        eo.organizer_company AS linked_organizer_company,
        eo.username AS linked_organizer_username,
        (SELECT COUNT(*)::int FROM public.events WHERE organizer_id = p.id) AS event_count,
        (SELECT COUNT(*)::int FROM public.profiles WHERE linked_organizer_id = p.id AND role = 'eo_gate_pass') AS gate_pass_count
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.profiles eo ON eo.id = p.linked_organizer_id
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

    const { rows: accounts } = await query(accountsSql, params);
    const { rows: countRows } = await query(countSql, countParams);
    const total = (countRows[0] as { total: number })?.total ?? 0;

    // Get aggregate counts for header cards
    const { rows: statsRows } = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE role = 'organizer')::int AS total_eos,
        COUNT(*) FILTER (WHERE role = 'eo_gate_pass')::int AS total_gate_passes,
        COUNT(*) FILTER (WHERE role = 'organizer' AND is_verified_organizer = true)::int AS verified_eos
      FROM public.profiles
    `);
    const stats = statsRows[0] as {
      total_eos: number;
      total_gate_passes: number;
      verified_eos: number;
    } || { total_eos: 0, total_gate_passes: 0, verified_eos: 0 };

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: { search, role, organizer_id: organizerId },
      },
    });
  } catch (error) {
    console.error("Admin accounts API error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
