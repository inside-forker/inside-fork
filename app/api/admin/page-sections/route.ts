import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  getPageSectionsConfig,
  savePageSectionsConfig,
} from "@/lib/page-sections/resolve";
import { parsePageSectionsConfig } from "@/lib/page-sections/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/page-sections
 *
 * Current mobile feed section on/off toggles for Home, Explore, Events, Deals.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const config = await getPageSectionsConfig();
    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/page-sections] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load page sections config" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/page-sections
 *
 * Upserts mobile.page_sections in system_config.
 */
export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireAdmin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const config = parsePageSectionsConfig(body);
    const saved = await savePageSectionsConfig(config, user.id);

    return NextResponse.json({
      success: true,
      data: saved,
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/page-sections] PUT failed:", error);
    return NextResponse.json(
      { error: "Failed to save page sections config" },
      { status: 500 },
    );
  }
}
