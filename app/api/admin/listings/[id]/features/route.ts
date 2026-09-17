import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/admin/listings/[id]/features
 * Returns the master feature list plus (for an existing listing) which
 * feature ids are currently assigned to it. `[id]` is "new" for create mode.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const listingId = parseInt(id, 10);

    const { rows: masterFeatures } = await query(
      `SELECT id, name, description, icon_emoji
       FROM listing_features_master
       ORDER BY name ASC`,
    );

    let assignedFeatureIds: number[] = [];
    if (!Number.isNaN(listingId)) {
      const { rows: assignedRows } = await query(
        `SELECT feature_id FROM listing_features WHERE listing_id = $1`,
        [listingId],
      );
      assignedFeatureIds = assignedRows.map((row) => row.feature_id as number);
    }

    return NextResponse.json({
      success: true,
      data: { masterFeatures, assignedFeatureIds },
    });
  } catch (error) {
    console.error("Admin features GET API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user and verify admin/staff role (RLS is no longer
    // in play now that we talk to Postgres directly, so this check must be
    // explicit here, matching the sibling admin/listings routes).
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { listingId, featureId, action } = await request.json();

    if (action === "add") {
      let data;
      try {
        const result = await query(
          `INSERT INTO listing_features (listing_id, feature_id)
           VALUES ($1, $2)
           RETURNING *`,
          [listingId, featureId],
        );
        data = result.rows[0];
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to add feature", details: error },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, data });
    }

    if (action === "remove") {
      try {
        await query(
          `DELETE FROM listing_features WHERE listing_id = $1 AND feature_id = $2`,
          [listingId, featureId],
        );
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to remove feature", details: error },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "add" or "remove"' },
      { status: 400 },
    );
  } catch (error) {
    console.error("Admin features API error:", error);
    return NextResponse.json(
      { error: "Unauthorized or server error" },
      { status: 401 },
    );
  }
}
