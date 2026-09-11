import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { refreshSearchZeroResultsDaily } from "@/lib/analytics/search-zero-results";

export const dynamic = "force-dynamic";

/** Nightly rebuild of search_zero_results_daily from mobile + web search events. */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshSearchZeroResultsDaily(30);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/cron/refresh-search-zero-results failed", error);
    return NextResponse.json(
      { error: "Failed to refresh search zero-result rollup" },
      { status: 500 },
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorizedCronRequest() is ever
// checked, regardless of CRON_SECRET being configured correctly.
export const GET = POST;
