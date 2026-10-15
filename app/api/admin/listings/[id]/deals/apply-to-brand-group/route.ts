import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { getBrandGroupForListing } from "@/lib/listings/brand-groups";
import { query } from "@/lib/db";

/**
 * POST /api/admin/listings/[id]/deals/apply-to-brand-group
 * Copies an existing deal from this listing to other sibling branches in the same brand group.
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
    const dealId = parseInt(body.dealId || body.deal_id, 10);
    if (Number.isNaN(dealId)) {
      return NextResponse.json(
        { error: "Valid deal ID is required" },
        { status: 400 },
      );
    }

    // Fetch the source deal
    const { rows: dealRows } = await query(
      `SELECT * FROM deals WHERE id = $1 AND listing_id = $2`,
      [dealId, listingId],
    );
    const deal = dealRows[0];
    if (!deal) {
      return NextResponse.json(
        { error: "Deal not found for this listing" },
        { status: 404 },
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

    const validMemberIds = new Set(group.members.map((m) => m.listing_id));
    const requestedTargetIds = Array.isArray(body.targetListingIds)
      ? body.targetListingIds
          .map((t: unknown) => parseInt(String(t), 10))
          .filter(Number.isFinite)
      : group.members
          .map((m) => m.listing_id)
          .filter((mId) => mId !== listingId);

    const validTargets = requestedTargetIds.filter(
      (tid: number) => validMemberIds.has(tid) && tid !== listingId,
    );

    let insertedCount = 0;
    for (const targetId of validTargets) {
      // Check if identical active deal already exists on target listing
      const { rows: existing } = await query(
        `SELECT id FROM deals
         WHERE listing_id = $1
           AND title = $2
           AND (bank_id = $3 OR (bank_id IS NULL AND $3 IS NULL))
           AND discount_value = $4
           AND is_active = true`,
        [targetId, deal.title, deal.bank_id, deal.discount_value],
      );

      if (existing.length === 0) {
        await query(
          `INSERT INTO deals (
             listing_id, title, description, deal_type, bank_id, discount_value,
             start_date, end_date, is_active, valid_card_variants, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            targetId,
            deal.title,
            deal.description,
            deal.deal_type,
            deal.bank_id,
            deal.discount_value,
            deal.start_date,
            deal.end_date,
            deal.is_active,
            deal.valid_card_variants,
            deal.metadata || {},
          ],
        );
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      applied_count: insertedCount,
      total_targets: validTargets.length,
      brand_group: group.name,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in apply-to-brand-group:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
