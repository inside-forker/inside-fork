import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { refreshMarketplaceHealthDaily } from "@/lib/analytics/marketplace-health";

export const dynamic = "force-dynamic";

/**
 * Nightly marketplace health snapshot (see vercel.json).
 * Prefer running after refresh-search-zero-results so operators have fresh
 * zero-result context alongside this snapshot (snapshot itself reads live events).
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await refreshMarketplaceHealthDaily();
    return NextResponse.json({ success: true, snapshot });
  } catch (error) {
    console.error("POST /api/cron/refresh-marketplace-health failed", error);
    return NextResponse.json(
      { error: "Failed to refresh marketplace health" },
      { status: 500 },
    );
  }
}
