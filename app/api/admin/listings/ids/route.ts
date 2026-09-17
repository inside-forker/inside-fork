import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET ALL LISTING IDS (for bulk selection across pages)
 *
 * Returns only IDs of listings matching current filters
 * Used for "Select All" functionality across pagination
 *
 * @route GET /api/admin/listings/ids
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const categoryId = searchParams.get("category_id") || "";

    // Build query to get only IDs, applying same filters as main listing endpoint
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(
        `(name ILIKE $${params.length} OR description ILIKE $${params.length})`,
      );
    }

    if (status && status !== "all") {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (categoryId && categoryId !== "all") {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        params.push(categoryIdNum);
        whereClauses.push(
          `EXISTS (
             SELECT 1 FROM listing_categories lc
             WHERE lc.listing_id = listings.id AND lc.category_id = $${params.length}
           )`,
        );
      }
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let listings;
    try {
      const result = await query(
        `SELECT id FROM listings ${whereSql}`,
        params,
      );
      listings = result.rows;
    } catch (error) {
      console.error("Error fetching listing IDs:", error);
      return NextResponse.json(
        { error: "Failed to fetch listing IDs" },
        { status: 500 },
      );
    }

    const ids = listings.map((l) => l.id);

    return NextResponse.json({
      success: true,
      data: {
        ids,
        count: ids.length,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
