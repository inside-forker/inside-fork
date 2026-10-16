import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import {
  searchListingsForDuplication,
  getSourceListingForDuplication,
  executeListingDuplication,
  type DuplicateListingsPayload,
} from "@/lib/listings/duplicate-listings";

export const dynamic = "force-dynamic";

async function verifyStaffSession(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: "Authentication required", status: 401 };
  }

  const { rows } = await query<{ role: string }>(
    `SELECT role FROM profiles WHERE id = $1 LIMIT 1`,
    [session.userId],
  );
  const profile = rows[0];

  if (!profile) {
    return { error: "Profile not found", status: 403 };
  }

  const allowedRoles = ["admin", "super_admin", "lister", "data_entry"];
  if (!allowedRoles.includes(profile.role)) {
    return { error: "Access denied: Staff or admin role required", status: 403 };
  }

  return { session, profile };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyStaffSession(request);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    const searchQuery = searchParams.get("search") || searchParams.get("q") || "";

    // If an ID is provided, return full source listing details
    if (idParam) {
      const listingId = parseInt(idParam, 10);
      if (isNaN(listingId)) {
        return NextResponse.json(
          { success: false, error: "Invalid listing ID" },
          { status: 400 },
        );
      }

      const listing = await getSourceListingForDuplication(listingId);
      if (!listing) {
        return NextResponse.json(
          { success: false, error: "Listing not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        listing,
      });
    }

    // Otherwise perform search
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const listings = await searchListingsForDuplication(searchQuery, limit);

    return NextResponse.json({
      success: true,
      listings,
    });
  } catch (error) {
    console.error("[Listings Duplicator API] GET error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyStaffSession(request);
    if ("error" in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as DuplicateListingsPayload;

    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;

    const result = await executeListingDuplication(
      body,
      auth.session.userId,
      ipAddress,
      userAgent,
    );

    return NextResponse.json({
      success: true,
      message: `Successfully duplicated ${result.created_listings.length} listings linked under "${result.brand_group.name}"`,
      data: result,
    });
  } catch (error) {
    console.error("[Listings Duplicator API] POST error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Failed to duplicate listings" },
      { status: 400 },
    );
  }
}
