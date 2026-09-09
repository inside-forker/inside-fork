import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import {
  getScreenUsers,
  type DateRangeFilter,
} from "@/lib/analytics/mobile-events";

const VALID_RANGES: DateRangeFilter[] = ["24h", "7d", "30d", "all"];

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = request.nextUrl;
    const screen = searchParams.get("screen");
    const rangeParam = searchParams.get("range") ?? "7d";
    const range = (
      VALID_RANGES.includes(rangeParam as DateRangeFilter)
        ? rangeParam
        : "7d"
    ) as DateRangeFilter;

    const prefix = searchParams.get("prefix") === "true";

    if (!screen) {
      return NextResponse.json(
        { error: "Missing screen parameter" },
        { status: 400 },
      );
    }

    const data = await getScreenUsers(screen, range, prefix);

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

    console.error("Failed to load screen users", error);
    return NextResponse.json(
      { error: "Failed to load screen users" },
      { status: 500 },
    );
  }
}
