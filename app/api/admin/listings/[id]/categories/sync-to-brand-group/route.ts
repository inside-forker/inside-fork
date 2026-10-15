import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { getBrandGroupForListing } from "@/lib/listings/brand-groups";
import { syncListingCategories } from "@/lib/listings/sync-listing-categories";

/**
 * POST /api/admin/listings/[id]/categories/sync-to-brand-group
 * Syncs the selected category_ids and primary category across all other branches
 * in the same brand group.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing ID" }, { status: 400 });
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();
    const categoryIds = body.category_ids;
    const primaryCategoryId = body.primary_category_id ?? body.category_id;

    if (!categoryIds || (Array.isArray(categoryIds) && categoryIds.length === 0)) {
      return NextResponse.json(
        { error: "At least one category or subcategory is required" },
        { status: 400 },
      );
    }

    // Get brand group
    const group = await getBrandGroupForListing(listingId);
    if (!group || group.members.length <= 1) {
      return NextResponse.json(
        {
          error:
            "This listing does not belong to a brand group with other branches",
        },
        { status: 400 },
      );
    }

    const siblingIds = group.members
      .map((m) => m.listing_id)
      .filter((mId) => mId !== listingId);

    // Sync categories for the source listing first
    await syncListingCategories(listingId, categoryIds, primaryCategoryId);

    // Sync all sibling branches in the brand group
    let syncedCount = 0;
    for (const sibId of siblingIds) {
      await syncListingCategories(sibId, categoryIds, primaryCategoryId);
      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      total_branches: group.members.length,
      brand_group: group.name,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error syncing subcategories to brand group:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
