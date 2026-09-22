import { getSessionFromCookies } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getWorkerConfig, requestWorker } from "@/lib/scraper/worker-client";

/**
 * Force-clear a stuck Redis sync lock on the external worker.
 * Use when Start Sync returns 409 / "Sync already running" with nothing active.
 *
 * @route POST /api/admin/listing-scraper/force-unlock
 */
export async function POST(_request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
      "/sync/force-unlock",
      { method: "POST" },
    );

    if (!workerResponse.ok) {
      const workerBody = await workerResponse.text();
      let message =
        workerBody || `Worker responded with ${workerResponse.status}`;
      try {
        const parsed = JSON.parse(workerBody) as {
          message?: string;
          error?: string;
        };
        message = parsed.message || parsed.error || message;
      } catch {
        // keep raw
      }
      const status =
        workerResponse.status === 401 ? 401 : 502;
      return NextResponse.json(
        {
          error: "Worker force-unlock failed",
          message,
          workerStatus: workerResponse.status,
        },
        { status },
      );
    }

    const body = await workerResponse.json();
    return NextResponse.json({
      ...body,
      executionMode: "external-worker",
    });
  } catch (error) {
    const unlockError = error as Error;
    console.error("[SYNC FORCE-UNLOCK] Error:", unlockError);
    return NextResponse.json(
      { error: "Internal server error", message: unlockError.message },
      { status: 500 },
    );
  }
}
