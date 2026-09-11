import { NextRequest, NextResponse } from "next/server";

import {
  dispatchEmailOutboxBatch,
  dispatchPushOutboxBatch,
} from "@/lib/notifications";

const DISPATCH_SECRET =
  process.env.NOTIFICATIONS_DISPATCH_TOKEN ?? process.env.CRON_SECRET ?? null;

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader?.length) {
    return cronHeader.trim();
  }

  const tokenParam = request.nextUrl.searchParams.get("token");
  return tokenParam ? tokenParam.trim() : null;
}

function isAuthorized(request: NextRequest): boolean {
  if (!DISPATCH_SECRET) {
    console.warn(
      "POST /api/notifications/dispatch: no NOTIFICATIONS_DISPATCH_TOKEN or CRON_SECRET configured - denying request"
    );
    return false;
  }

  const token = extractToken(request);
  return token === DISPATCH_SECRET;
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const startedAt = Date.now();

  try {
    const [email, push] = await Promise.all([
      dispatchEmailOutboxBatch({ limit }),
      dispatchPushOutboxBatch({ limit }),
    ]);
    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      durationMs,
      summary: { email, push },
    });
  } catch (error) {
    console.error("POST /api/notifications/dispatch failed", error);
    return NextResponse.json(
      { error: "Failed to dispatch notifications" },
      { status: 500 }
    );
  }
}

// Vercel Cron Jobs invoke this path with a GET request, not POST - without
// this alias the scheduled run 405s before isAuthorized() is ever checked,
// regardless of CRON_SECRET being configured correctly.
export const GET = POST;
