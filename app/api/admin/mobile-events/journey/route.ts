import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/admin";
import {
  getUserJourney,
  type DateRangeFilter,
} from "@/lib/analytics/mobile-events";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");
    const type = searchParams.get("type") ?? "user"; // "user" | "anon"
    const range =
      (searchParams.get("range") as DateRangeFilter) ?? "7d";

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 },
      );
    }

    const userId = type === "user" ? id : null;
    const anonId = type === "anon" ? id : null;

    const data = await getUserJourney(userId, anonId, range);

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

    console.error("Failed to load user journey", error);
    return NextResponse.json(
      { error: "Failed to load user journey" },
      { status: 500 },
    );
  }
}
