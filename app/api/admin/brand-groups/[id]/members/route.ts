import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  addListingToBrandGroupId,
  getBrandGroupById,
} from "@/lib/listings/brand-groups";

export const dynamic = "force-dynamic";

const AddMemberSchema = z.object({
  listing_id: z.number().int().positive("Valid listing ID required"),
  sort_order: z.number().int().optional().default(0),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaff(request);
    const { id } = await params;
    const groupId = parseInt(id, 10);
    if (Number.isNaN(groupId)) {
      return NextResponse.json({ success: false, error: "Invalid group ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = AddMemberSchema.parse(body);

    await addListingToBrandGroupId({
      groupId,
      listingId: parsed.listing_id,
      sortOrder: parsed.sort_order,
      source: "manual",
    });

    const group = await getBrandGroupById(groupId);
    return NextResponse.json({
      success: true,
      message: "Listing added to brand group",
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0]?.message ?? "Invalid body" },
        { status: 400 },
      );
    }
    console.error("[BrandGroups API] POST member error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
