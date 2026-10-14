import { NextRequest, NextResponse } from "next/server";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { searchListingsForBrandGrouping } from "@/lib/listings/brand-groups";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));

    if (!q.trim()) {
      return NextResponse.json({ success: true, listings: [] });
    }

    const listings = await searchListingsForBrandGrouping(q, limit);

    return NextResponse.json({
      success: true,
      listings,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[BrandGroups API] Search listings error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
