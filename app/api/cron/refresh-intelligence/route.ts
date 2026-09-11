import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { refreshTasteGraph } from "@/lib/analytics/taste-graph";
import { refreshPropensityScores } from "@/lib/analytics/propensity";

export const dynamic = "force-dynamic";

/**
 * Nightly Phase 3 intelligence refresh: taste graph + propensity scores.
 * Prefer after refresh-user-scores so lifecycle is fresh before segments.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [taste, propensity] = await Promise.all([
      refreshTasteGraph(),
      refreshPropensityScores(),
    ]);
    return NextResponse.json({ success: true, taste, propensity });
  } catch (error) {
    console.error("POST /api/cron/refresh-intelligence failed", error);
    return NextResponse.json(
      { error: "Failed to refresh intelligence scores" },
      { status: 500 },
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorizedCronRequest() is ever
// checked, regardless of CRON_SECRET being configured correctly.
export const GET = POST;
