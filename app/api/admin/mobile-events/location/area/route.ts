import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getAreaDetailIntelligence } from "@/lib/analytics/mobile-location";
import type { DateRangeFilter } from "@/lib/analytics/mobile-events";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const neighborhood = request.nextUrl.searchParams.get("neighborhood");
    const range =
      (request.nextUrl.searchParams.get("range") as DateRangeFilter) ?? "7d";

    if (!neighborhood) {
      return NextResponse.json(
        { error: "Neighborhood parameter is required" },
        { status: 400 }
      );
    }

    const data = await getAreaDetailIntelligence(neighborhood, range);

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

    console.error("Failed to load area detail intelligence", error);
    return NextResponse.json(
      { error: "Failed to load area detail intelligence" },
      { status: 500 }
    );
  }
}
