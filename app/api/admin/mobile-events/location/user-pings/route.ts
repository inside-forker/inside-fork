import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getUserLocationPings } from "@/lib/analytics/mobile-location";
import type { DateRangeFilter } from "@/lib/analytics/mobile-events";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const actorId = request.nextUrl.searchParams.get("actorId");
    if (!actorId) {
      return NextResponse.json(
        { error: "actorId parameter is required" },
        { status: 400 }
      );
    }

    const isUserId = request.nextUrl.searchParams.get("isUserId") === "true";
    const range =
      (request.nextUrl.searchParams.get("range") as DateRangeFilter) ?? "all";

    const pings = await getUserLocationPings(actorId, isUserId, range);

    return NextResponse.json(
      { data: { pings } },
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

    console.error("Failed to fetch user location pings", error);
    return NextResponse.json(
      { error: "Failed to fetch user location pings" },
      { status: 500 }
    );
  }
}
