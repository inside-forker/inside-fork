import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";
import {
  getAdminAuthErrorStatus,
  requireSuperAdmin,
} from "@/lib/auth/admin";

interface HistoryRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  entities_processed: number;
  entities_created: number;
  entities_updated: number;
  entities_skipped: number;
  errors_count: number;
  status: string;
  config: unknown;
  error_message: string | null;
  report: unknown;
}

/**
 * GET SYNC HISTORY
 *
 * @route GET /api/admin/listing-scraper/history
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const activeSyncId = await syncStateManager.getActiveSyncId();

    // Fetch sync history from database
    let history: HistoryRow[];
    try {
      const { rows } = await query(
        `SELECT id, started_at, completed_at, duration_ms, entities_processed,
                entities_created, entities_updated, entities_skipped, errors_count,
                status, config, error_message, report
         FROM listing_sync_history
         ORDER BY started_at DESC
         LIMIT 50`,
      );
      history = rows;
    } catch (error) {
      console.error("[LISTING SCRAPER] History query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 },
      );
    }

    // Transform to frontend format
    const formattedHistory = (history || []).map((record) => {
      const cfg =
        record.config && typeof record.config === "object"
          ? (record.config as Record<string, unknown>)
          : {};

      const warning =
        cfg.entity_fetch_warning && typeof cfg.entity_fetch_warning === "object"
          ? (cfg.entity_fetch_warning as Record<string, unknown>)
          : null;

      const offsetDiscovered =
        typeof warning?.fetchedCount === "number"
          ? warning.fetchedCount
          : record.entities_processed;

      const totalDiscovered =
        typeof cfg.total_entities === "number"
          ? cfg.total_entities
          : record.entities_processed;

      const fallbackDiscovered = Math.max(
        0,
        totalDiscovered - offsetDiscovered,
      );

      const reportObj =
        record.report && typeof record.report === "object"
          ? (record.report as Record<string, unknown>)
          : null;
      const summary =
        reportObj?.summary && typeof reportObj.summary === "object"
          ? (reportObj.summary as Record<string, unknown>)
          : null;

      const syncMode =
        typeof cfg.syncMode === "string" ? cfg.syncMode : null;

      const staleRunning =
        record.status === "running" && activeSyncId !== record.id;

      return {
        id: record.id,
        startTime: record.started_at,
        endTime: record.completed_at || new Date().toISOString(),
        entitiesProcessed: record.entities_processed,
        entitiesCreated: record.entities_created,
        entitiesUpdated: record.entities_updated,
        errors: record.errors_count,
        status: staleRunning ? "failed" : record.status,
        staleRunning,
        staleMessage: staleRunning
          ? "Sync was interrupted (worker/session ended before completion)."
          : null,
        discoverySummary: `Discovery: offset ${offsetDiscovered.toLocaleString()} | fallback ${fallbackDiscovered.toLocaleString()} | total ${totalDiscovered.toLocaleString()}`,
        warningMessage:
          typeof warning?.message === "string" ? warning.message : null,
        errorMessage: record.error_message,
        syncMode,
        reportSummary: summary
          ? {
              missingInInside:
                typeof summary.missingInInside === "number"
                  ? summary.missingInInside
                  : null,
              existingWouldUpdate:
                typeof summary.existingWouldUpdate === "number"
                  ? summary.existingWouldUpdate
                  : null,
              existingUnchanged:
                typeof summary.existingUnchanged === "number"
                  ? summary.existingUnchanged
                  : null,
              dealsWouldCreate:
                typeof summary.dealsWouldCreate === "number"
                  ? summary.dealsWouldCreate
                  : null,
              dealsWouldUpdate:
                typeof summary.dealsWouldUpdate === "number"
                  ? summary.dealsWouldUpdate
                  : null,
              skippedConflicts:
                typeof summary.skippedConflicts === "number"
                  ? summary.skippedConflicts
                  : null,
            }
          : null,
      };
    });

    return NextResponse.json({
      history: formattedHistory,
    });
  } catch (error) {
    const authStatus = getAdminAuthErrorStatus(error);
    if (authStatus) {
      return NextResponse.json(
        { error: authStatus === 401 ? "Unauthorized" : "Forbidden" },
        { status: authStatus },
      );
    }

    const historyError = error as Error;
    console.error("[LISTING SCRAPER] History error:", historyError);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
