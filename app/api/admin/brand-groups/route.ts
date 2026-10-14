import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { listBrandGroups, createBrandGroup } from "@/lib/listings/brand-groups";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireStaff(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") ?? searchParams.get("search") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
    const offset = (page - 1) * limit;

    const result = await listBrandGroups({ search, limit, offset });

    return NextResponse.json({
      success: true,
      groups: result.groups,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status },
      );
    }
    console.error("[BrandGroups API] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

const CreateGroupSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(200, "Brand name too long"),
});

export async function POST(request: NextRequest) {
  try {
    await requireStaff(request);

    const body = await request.json();
    const parsed = CreateGroupSchema.parse(body);

    const group = await createBrandGroup(parsed.name);

    return NextResponse.json(
      {
        success: true,
        group: {
          ...group,
          member_count: 0,
          published_member_count: 0,
        },
      },
      { status: 201 },
    );
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
    console.error("[BrandGroups API] POST error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || "Internal server error" },
      { status: 500 },
    );
  }
}
