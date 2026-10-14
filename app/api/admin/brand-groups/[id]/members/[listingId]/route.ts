import { NextRequest, NextResponse } from "next/server";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  removeListingFromBrandGroupId,
  getBrandGroupById,
} from "@/lib/listings/brand-groups";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; listingId: string }> },
) {
  try {
    await requireStaff(request);
    const { id, listingId } = await params;
    const groupId = parseInt(id, 10);
    const parsedListingId = parseInt(listingId, 10);

    if (Number.isNaN(groupId) || Number.isNaN(parsedListingId)) {
      return NextResponse.json(
        { success: false, error: "Invalid group ID or listing ID" },
        { status: 400 },
      );
    }

    await removeListingFromBrandGroupId(groupId, parsedListingId);
    const group = await getBrandGroupById(groupId);

    return NextResponse.json({
      success: true,
      message: "Listing removed from brand group",
      group,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[BrandGroups API] DELETE member error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
