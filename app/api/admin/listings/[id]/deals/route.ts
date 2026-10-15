import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import { getBrandGroupForListing } from "@/lib/listings/brand-groups";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Get deals for the listing
    let deals;
    try {
      const { rows } = await query(
        `SELECT d.*, b.id AS bank_id_full, b.name AS bank_name, b.logo_url AS bank_logo_url
         FROM deals d
         LEFT JOIN banks b ON b.id = d.bank_id
         WHERE d.listing_id = $1
         ORDER BY d.created_at DESC`,
        [listingId],
      );
      deals = rows.map((row) => {
        const { bank_id_full, bank_name, bank_logo_url, ...rest } = row;
        return {
          ...rest,
          banks: bank_id_full
            ? { id: bank_id_full, name: bank_name, logo_url: bank_logo_url }
            : null,
        };
      });
    } catch (error) {
      console.error("Error fetching deals:", error);
      return NextResponse.json(
        { error: "Failed to fetch deals" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deals });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const startDate = body.start_date
      ? new Date(body.start_date).toISOString()
      : null;
    const endDate = body.end_date ? new Date(body.end_date).toISOString() : null;

    let deal;
    try {
      const { rows } = await query(
        `INSERT INTO deals (
           listing_id, title, description, deal_type, bank_id, discount_value,
           start_date, end_date, is_active, valid_card_variants
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          listingId,
          body.title,
          body.description,
          body.deal_type,
          body.bank_id || null,
          body.discount_value,
          startDate,
          endDate,
          body.is_active ?? true,
          body.valid_card_variants || null,
        ],
      );
      const inserted = rows[0];

      let bank = null;
      if (inserted.bank_id) {
        const { rows: bankRows } = await query(
          `SELECT id, name, logo_url FROM banks WHERE id = $1`,
          [inserted.bank_id],
        );
        bank = bankRows[0] || null;
      }

      deal = { ...inserted, banks: bank };

      let appliedCount = 0;
      if (
        Array.isArray(body.apply_to_listing_ids) &&
        body.apply_to_listing_ids.length > 0
      ) {
        const group = await getBrandGroupForListing(listingId);
        const validMemberIds = new Set(
          group ? group.members.map((m) => m.listing_id) : [],
        );
        const validTargetIds = body.apply_to_listing_ids
          .map((tid: unknown) => parseInt(String(tid), 10))
          .filter(
            (tid: number) =>
              Number.isFinite(tid) &&
              validMemberIds.has(tid) &&
              tid !== listingId,
          );

        for (const targetId of validTargetIds) {
          const { rows: existing } = await query(
            `SELECT id FROM deals
             WHERE listing_id = $1
               AND title = $2
               AND (bank_id = $3 OR (bank_id IS NULL AND $3 IS NULL))
               AND discount_value = $4
               AND is_active = true`,
            [targetId, body.title, body.bank_id || null, body.discount_value],
          );

          if (existing.length === 0) {
            await query(
              `INSERT INTO deals (
                 listing_id, title, description, deal_type, bank_id, discount_value,
                 start_date, end_date, is_active, valid_card_variants
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                targetId,
                body.title,
                body.description,
                body.deal_type,
                body.bank_id || null,
                body.discount_value,
                startDate,
                endDate,
                body.is_active ?? true,
                body.valid_card_variants || null,
              ],
            );
            appliedCount++;
          }
        }
      }

      return NextResponse.json({
        deal,
        applied_to_count: appliedCount,
      });
    } catch (error) {
      console.error("Error creating deal:", error);
      return NextResponse.json(
        { error: "Failed to create deal" },
        { status: 500 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals POST:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const dealId = body.id;

    if (!dealId) {
      return NextResponse.json(
        { error: "Deal ID is required" },
        { status: 400 }
      );
    }

    const startDate = body.start_date
      ? new Date(body.start_date).toISOString()
      : null;
    const endDate = body.end_date ? new Date(body.end_date).toISOString() : null;

    let deal;
    try {
      const { rows } = await query(
        `UPDATE deals SET
           title = $1, description = $2, deal_type = $3, bank_id = $4,
           discount_value = $5, start_date = $6, end_date = $7,
           is_active = $8, valid_card_variants = $9
         WHERE id = $10 AND listing_id = $11
         RETURNING *`,
        [
          body.title,
          body.description,
          body.deal_type,
          body.bank_id || null,
          body.discount_value,
          startDate,
          endDate,
          body.is_active ?? true,
          body.valid_card_variants || null,
          parseInt(dealId),
          listingId,
        ],
      );
      const updated = rows[0];

      let bank = null;
      if (updated?.bank_id) {
        const { rows: bankRows } = await query(
          `SELECT id, name, logo_url FROM banks WHERE id = $1`,
          [updated.bank_id],
        );
        bank = bankRows[0] || null;
      }

      deal = updated ? { ...updated, banks: bank } : null;
    } catch (error) {
      console.error("Error updating deal:", error);
      return NextResponse.json(
        { error: "Failed to update deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ deal });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals PUT:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get("dealId");

    if (!dealId) {
      return NextResponse.json(
        { error: "Deal ID is required" },
        { status: 400 }
      );
    }

    try {
      await query(`DELETE FROM deals WHERE id = $1 AND listing_id = $2`, [
        parseInt(dealId),
        listingId,
      ]);
    } catch (error) {
      console.error("Error deleting deal:", error);
      return NextResponse.json(
        { error: "Failed to delete deal" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Error in deals DELETE:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
