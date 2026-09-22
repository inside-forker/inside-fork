import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  getHomeOpenerConfig,
  previewHomeOpenerSlides,
  saveHomeOpenerConfig,
} from "@/lib/home-opener/resolve";
import {
  HOME_OPENER_MAX_SLIDES,
  parseHomeOpenerConfig,
} from "@/lib/home-opener/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/home-opener
 *
 * Current curated Home hero slides + live previews (image, title, validity).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const config = await getHomeOpenerConfig();
    const resolved = await previewHomeOpenerSlides(config.slides);
    return NextResponse.json({
      success: true,
      data: {
        config,
        resolved,
        max_slides: HOME_OPENER_MAX_SLIDES,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/home-opener] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load home opener config" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/home-opener
 *
 * Body: `{ slides: [{ kind: 'event'|'listing', id: number }], fill_remaining?: boolean }`
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

    const config = parseHomeOpenerConfig(body);
    if (config.slides.length > HOME_OPENER_MAX_SLIDES) {
      return NextResponse.json(
        { error: `At most ${HOME_OPENER_MAX_SLIDES} slides allowed` },
        { status: 400 },
      );
    }

    const saved = await saveHomeOpenerConfig(config, user.id);
    const resolved = await previewHomeOpenerSlides(saved.slides);

    return NextResponse.json({
      success: true,
      data: {
        config: saved,
        resolved,
        max_slides: HOME_OPENER_MAX_SLIDES,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/home-opener] PUT failed:", error);
    return NextResponse.json(
      { error: "Failed to save home opener config" },
      { status: 500 },
    );
  }
}
