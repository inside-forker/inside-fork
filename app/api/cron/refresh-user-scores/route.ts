import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { refreshUserEngagementScores } from "@/lib/scoring/userEngagement";

export const dynamic = "force-dynamic";

/**
 * Nightly cron (see vercel.json, runs first of the three). Independently
 * re-triggerable by hand for a manual backfill, e.g.:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://.../api/cron/refresh-user-scores
 *
 * A failure here does not roll back or block refresh-segments /
 * evaluate-admin-alerts - they are separate route invocations with no
 * shared transaction.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshUserEngagementScores();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/cron/refresh-user-scores failed", error);
    return NextResponse.json(
      { error: "Failed to refresh user engagement scores" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorizedCronRequest() is ever
// checked, regardless of CRON_SECRET being configured correctly.
export const GET = POST;
