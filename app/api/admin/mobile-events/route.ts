import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import {
  getMobileEventsFullOverview,
  type DateRangeFilter,
} from "@/lib/analytics/mobile-events";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const range =
      (request.nextUrl.searchParams.get("range") as DateRangeFilter) ?? "7d";

    const data = await getMobileEventsFullOverview(range);

    return NextResponse.json(
      { data },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : "unknown";

    if (message.includes("authentication")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    if (message.includes("admin access")) {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }

    console.error("Failed to load mobile events overview", error);
    return NextResponse.json(
      { error: "Failed to load mobile events overview" },
      { status: 500 },
    );
  }
}
