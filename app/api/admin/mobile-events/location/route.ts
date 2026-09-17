import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getLocationIntelligenceData,
  type HeatmapFilterType,
} from "@/lib/analytics/mobile-location";
import type { DateRangeFilter } from "@/lib/analytics/mobile-events";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const range =
      (request.nextUrl.searchParams.get("range") as DateRangeFilter) ?? "7d";
    const filter =
      (request.nextUrl.searchParams.get("filter") as HeatmapFilterType) ?? "all";

    const data = await getLocationIntelligenceData(range, filter);

    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown";

    if (message.includes("authentication")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (message.includes("admin access")) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    console.error("Failed to load location intelligence", error);
    return NextResponse.json(
      { error: "Failed to load location intelligence" },
      { status: 500 }
    );
  }
}
