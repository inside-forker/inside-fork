import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

// GET: List eligible business owners for a listing (minimal info)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Get user profile
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    // Only allow lister, admin, super_admin
    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing id" },
        { status: 400 }
      );
    }
    // Search users by query param (for autocomplete)
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    const whereParams: unknown[] = [];
    let whereSql = "role != 'super_admin'";
    if (q) {
      whereParams.push(`%${q}%`);
      whereSql += ` AND (full_name ILIKE $${whereParams.length} OR username ILIKE $${whereParams.length})`;
    }

    let users;
    try {
      const result = await query(
        `SELECT id, full_name, username, avatar_url, role
         FROM profiles
         WHERE ${whereSql}
         LIMIT 10`,
        whereParams,
      );
      users = result.rows;
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error("[API][GET] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Assign business owner(s) to a listing
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Get user profile
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const listingId = parseInt(params.id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing id" },
        { status: 400 }
      );
    }
    // If lister, check ownership
    if (profile.role === "lister") {
      const { rows: listingRows } = await query(
        `SELECT id, owner_id FROM listings WHERE id = $1`,
        [listingId],
      );
      const listing = listingRows[0];
      if (!listing || listing.owner_id !== session.userId) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }
    // Parse new owner(s) from body
    const { owner_id } = await request.json();
    if (!owner_id) {
      return NextResponse.json(
        { error: "owner_id is required" },
        { status: 400 }
      );
    }
    // Update listing owner
    try {
      await query(`UPDATE listings SET owner_id = $1 WHERE id = $2`, [
        owner_id,
        listingId,
      ]);
    } catch {
      return NextResponse.json(
        { error: "Failed to update owner" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
