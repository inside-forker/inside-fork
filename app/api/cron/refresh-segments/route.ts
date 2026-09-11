import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { refreshSegments } from "@/lib/segments/refresh";

export const dynamic = "force-dynamic";

/**
 * Nightly cron (see vercel.json, runs ~15min after refresh-user-scores so
 * segments read fresh engagement scores). Independently re-triggerable by
 * hand for a manual backfill, e.g.:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://.../api/cron/refresh-segments
 *
 * Only reconciles membership - it does NOT send any notifications. Use
 * lib/segments/dispatch.ts notifySegment() separately (from an admin
 * action or a dedicated evaluator) to message a segment.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await refreshSegments();
    return NextResponse.json({ success: true, segments: results });
  } catch (error) {
    console.error("POST /api/cron/refresh-segments failed", error);
    return NextResponse.json(
      { error: "Failed to refresh segments" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorizedCronRequest() is ever
// checked, regardless of CRON_SECRET being configured correctly.
export const GET = POST;
