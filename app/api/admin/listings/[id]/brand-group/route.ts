import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import {
  ensureListingInBrandGroup,
  getBrandGroupForListing,
  removeListingFromBrandGroup,
  suggestBrandName,
} from "@/lib/listings/brand-groups";
import { query } from "@/lib/db";
import { z } from "zod";

/**
 * GET /api/admin/listings/[id]/brand-group
 * Current brand group membership for this listing (if any).
 */
export async function GET(
  _request: NextRequest,
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

    const group = await getBrandGroupForListing(listingId);
    const { rows } = await query<{ name: string | null }>(
      `SELECT name FROM listings WHERE id = $1`,
      [listingId],
    );
    return NextResponse.json({
      group,
      suggested_brand_name: suggestBrandName(rows[0]?.name ?? null),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[BrandGroup API] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const AttachSchema = z.object({
  brand_name: z.string().min(1).max(200),
  source: z
    .enum(["manual", "stem_import", "split_from_branch"])
    .optional()
    .default("manual"),
});

/**
 * PUT /api/admin/listings/[id]/brand-group
 * Attach this listing to a brand group (creates group by name/slug if needed).
 */
export async function PUT(
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
      allowBusinessOwner: false,
    });

    const body = AttachSchema.parse(await request.json());
    await ensureListingInBrandGroup({
      listingId,
      brandName: body.brand_name,
      source: body.source,
    });

    const group = await getBrandGroupForListing(listingId);
    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }
    console.error("[BrandGroup API] PUT error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/listings/[id]/brand-group
 * Remove this listing from its brand group.
 */
export async function DELETE(
  _request: NextRequest,
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
      allowBusinessOwner: false,
    });

    await removeListingFromBrandGroup(listingId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("[BrandGroup API] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
