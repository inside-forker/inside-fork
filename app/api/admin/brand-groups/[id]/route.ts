import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  getBrandGroupById,
  updateBrandGroupName,
  deleteBrandGroup,
} from "@/lib/listings/brand-groups";

export const dynamic = "force-dynamic";

export async function GET(
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

    const group = await getBrandGroupById(groupId);
    if (!group) {
      return NextResponse.json({ success: false, error: "Brand group not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, group });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[BrandGroups API] GET [id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

const UpdateGroupSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(200, "Brand name too long"),
});

export async function PATCH(
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
    const parsed = UpdateGroupSchema.parse(body);

    const group = await updateBrandGroupName(groupId, parsed.name);
    return NextResponse.json({ success: true, group });
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
    console.error("[BrandGroups API] PATCH [id] error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    await deleteBrandGroup(groupId);
    return NextResponse.json({ success: true, message: "Brand group deleted" });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[BrandGroups API] DELETE [id] error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
