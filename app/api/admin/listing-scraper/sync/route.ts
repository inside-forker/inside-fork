import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { z } from "zod";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";
import * as Sentry from "@sentry/nextjs";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

const SyncRequestSchema = z.object({
  maxConcurrent: z.number().min(1).max(10).default(5),
  autoPublish: z.boolean().default(false),
  preserveManualEdits: z.boolean().default(true),
  limitEntities: z.boolean().default(false),
  entityLimit: z.number().min(1).max(1000).optional(),
  specificEntityId: z.string().optional(),
  fullResync: z.boolean().default(false),
  syncMode: z.enum(["deals_only", "full"]).default("deals_only"),
});

/**
 * START LISTING SCRAPER SYNC
 *
 * Initiates a new sync operation to import listings from Peekaboo.guru
 *
 * Security:
 * - Requires super_admin role
 * - Runs async (non-blocking)
 *
 * @route POST /api/admin/listing-scraper/sync
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Auth check
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check super_admin role
    if (profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden", message: "Only super admins can run sync" },
        { status: 403 },
      );
    }

    // Validate request body
    const body = await request.json();
    const config = SyncRequestSchema.parse(body);

    // Generate sync ID
    const syncId = crypto.randomUUID();

    const { enabled, workerUrl, workerSecret } = getWorkerConfig();

    if (!enabled) {
      return NextResponse.json(
        {
          error: "Worker not configured",
          message:
            "SCRAPER_WORKER_URL is required. Local-process mode has been removed.",
        },
        { status: 503 },
      );
    }

    const workerResponse = await requestWorker(
      { enabled, workerUrl, workerSecret },
      "/sync/start",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncId,
          userId: session.userId,
          config,
        }),
      },
    );

    if (!workerResponse.ok) {
      const workerBody = await workerResponse.text();
      return NextResponse.json(
        {
          error: "Worker request failed",
          message: workerBody || `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sync started via external worker",
      syncId,
      status: "running",
      executionMode: "external-worker",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid configuration", details: error.errors },
        { status: 400 },
      );
    }

    const syncError = error as Error;
    console.error("[SYNC API] Sync error:", syncError);
    Sentry.captureException(syncError, {
      tags: {
        service: "next-app",
        operation: "listing_scraper_sync_post",
      },
    });

    return NextResponse.json(
      { error: "Internal server error", message: syncError.message },
      { status: 500 },
    );
  }
}

/**
 * GET SYNC STATUS
 *
 * @route GET /api/admin/listing-scraper/sync
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await requireSuperAdmin(request);

    const { enabled, workerUrl, workerSecret } = getWorkerConfig();

    if (!enabled) {
      return NextResponse.json(
        {
          error: "Worker not configured",
          message:
            "SCRAPER_WORKER_URL is required. Local-process mode has been removed.",
        },
        { status: 503 },
      );
    }

    const workerResponse = await requestWorker(
      { enabled, workerUrl, workerSecret },
      "/sync/status",
      { method: "GET" },
    );

    if (!workerResponse.ok) {
      return NextResponse.json(
        {
          error: "Worker status failed",
          message: `Worker responded with ${workerResponse.status}`,
        },
        { status: 502 },
      );
    }

    const status = await workerResponse.json();
    return NextResponse.json({
      ...status,
      executionMode: "external-worker",
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: authStatus === 401 ? "Unauthorized" : "Forbidden" },
        { status: authStatus },
      );
    }

    const statusError = error as Error;
    console.error("[LISTING SCRAPER] Status check error:", statusError);
    Sentry.captureException(statusError, {
      tags: {
        service: "next-app",
        operation: "listing_scraper_sync_get",
      },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
