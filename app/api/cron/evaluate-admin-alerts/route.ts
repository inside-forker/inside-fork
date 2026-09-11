import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { evaluateAdminAlerts } from "@/lib/alerts/evaluators";

export const dynamic = "force-dynamic";

/**
 * Nightly cron (see vercel.json, runs last of the three so it reads fresh
 * merchant_dashboard_inactive_21d segment membership). Independently
 * re-triggerable by hand for a manual backfill, e.g.:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" https://.../api/cron/evaluate-admin-alerts
 *
 * Only notifies admins about newly-opened incidents - a persisting
 * condition stays open (last_seen_at refreshed) without re-notifying every
 * run. See lib/alerts/evaluators.ts.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await evaluateAdminAlerts();
    return NextResponse.json({ success: true, alerts: results });
  } catch (error) {
    console.error("POST /api/cron/evaluate-admin-alerts failed", error);
    return NextResponse.json(
      { error: "Failed to evaluate admin alerts" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorizedCronRequest() is ever
// checked, regardless of CRON_SECRET being configured correctly.
export const GET = POST;
