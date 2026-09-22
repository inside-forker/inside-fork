/** Runs Peekaboo listing syncs against Postgres with Redis coordination. */

import { randomUUID } from "crypto";
import { createAPIClient } from "@/scrapers/peekaboo_listings/core/api-client";
import {
  EntityScraper,
  type EntityListFetchWarning,
} from "@/scrapers/peekaboo_listings/scrapers/entity-scraper";
import { createBatchProcessor } from "@/scrapers/peekaboo_listings/core/batch-processor";
import { categoryMapper } from "@/scrapers/peekaboo_listings/transformers/category-mapper";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";
import { query } from "@/lib/db";
import { getPeekabooToken } from "@/lib/utils/peekaboo-token-manager";
import { sendScraperAlert } from "@/lib/scraper/alerts";
import type { SyncReport } from "@/types/peekaboo-scraper.types";
import { Sentry } from "@/lib/sentry/worker-sentry";

export interface SyncConfig {
  maxConcurrent: number;
  autoPublish: boolean;
  preserveManualEdits: boolean;
  limitEntities: boolean;
  entityLimit?: number;
  specificEntityId?: string;
  /** When true, clear processed IDs and re-sync all entities from scratch. */
  fullResync?: boolean;
  /** deals_only refreshes deals only; full upserts listing metadata; report is dry-run; create_missing inserts drafts only. */
  syncMode?: "report" | "create_missing" | "full" | "deals_only";
}

export interface SyncExecutionResult {
  success: boolean;
  syncId: string;
  totalEntities: number;
  report?: SyncReport;
  duration?: number;
  error?: string;
  wasCancelled?: boolean;
}

export interface SyncExecutionOptions {
  ownerToken?: string;
  lockAlreadyAcquired?: boolean;
}

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Execute a full sync operation
 */
export async function executeSyncOperation(
  syncId: string,
  userId: string | null,
  config: SyncConfig,
  options: SyncExecutionOptions = {},
): Promise<SyncExecutionResult> {
  const startTime = Date.now();
  let report: SyncReport | undefined;
  let entityListWarning: EntityListFetchWarning | null = null;
  const ownerToken = options.ownerToken || randomUUID();
  const lockLeaseMs = getPositiveEnvNumber(
    "SCRAPER_LOCK_LEASE_MS",
    10 * 60_000,
  );
  const heartbeatMs = Math.min(
    getPositiveEnvNumber("SCRAPER_LOCK_HEARTBEAT_MS", 30_000),
    Math.max(1000, Math.floor(lockLeaseMs / 2)),
  );
  let lockLost = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const assertLockStillOwned = () => {
    if (lockLost) {
      throw new Error(
        "Sync lock was lost; aborting to preserve single-flight execution",
      );
    }
  };

  const throwIfStopRequested = async () => {
    if (await syncStateManager.isStopRequested(syncId)) {
      throw new Error("Sync cancellation requested");
    }
  };

  try {
    const lockAcquired =
      options.lockAlreadyAcquired ||
      (await syncStateManager.acquireSyncLock(syncId, lockLeaseMs, ownerToken));

    if (!lockAcquired) {
      console.warn(
        `[SYNC ${syncId}] Sync lock is already held; skipping start`,
      );
      return {
        success: false,
        syncId,
        totalEntities: 0,
        error: "Sync already running",
      };
    }

    heartbeat = setInterval(() => {
      void syncStateManager
        .extendSyncLock(syncId, lockLeaseMs, ownerToken)
        .then((extended) => {
          if (!extended) {
            lockLost = true;
            console.error(`[SYNC ${syncId}] Failed to extend sync lock lease`);
          }
        })
        .catch((error) => {
          lockLost = true;
          console.error(`[SYNC ${syncId}] Sync lock heartbeat failed:`, error);
        });
    }, heartbeatMs);

    console.log(`[SYNC ${syncId}] Starting sync operation...`);
    console.log(`[SYNC ${syncId}] Config:`, config);
    await throwIfStopRequested();

    // Step 1: Save config to Redis for scraper access
    await syncStateManager.saveConfig(
      config as unknown as Record<string, unknown>,
    );

    // Step 2: Get auth token from database (with fallback to env)
    console.log(`[SYNC ${syncId}] Fetching authentication token...`);
    const authToken = await getPeekabooToken({ autoRegenerate: false });
    assertLockStillOwned();
    await throwIfStopRequested();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: any = {
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: 30000,
      token: authToken,
      config: {},
      stats: {},
    };

    // Step 2: Initialize API client
    console.log(`[SYNC ${syncId}] Initializing API client...`);
    const apiClient = await createAPIClient(context);

    // Step 3: Load category mappings
    console.log(`[SYNC ${syncId}] Loading category mappings...`);
    await categoryMapper.loadCategories();
    assertLockStillOwned();
    await throwIfStopRequested();

    // Step 4: Create initial database record IMMEDIATELY for real-time UI feedback
    // This ensures ProgressMonitor shows sync status right away (before fetching entities)
    console.log(`[SYNC ${syncId}] Creating initial sync record...`);
    await createSyncHistoryRecord(syncId, userId, config, 0); // 0 entities initially
    await markSyncStoppingIfRequested(syncId);

    // Step 5: Create entity scraper
    const scraper = new EntityScraper(apiClient, context);

    // Step 6: Fetch all entity IDs (this can take 30-60 seconds for 10k+ entities)
    console.log(`[SYNC ${syncId}] Fetching entity list from Peekaboo...`);
    let entityList = await scraper.getAllEntityIds();
    entityListWarning = scraper.getEntityListFetchWarning();
    assertLockStillOwned();
    await throwIfStopRequested();

    if (entityListWarning) {
      console.warn(
        `[SYNC ${syncId}] Entity list warning: ${entityListWarning.message}`,
      );
    }

    // Apply specific entity ID filter (single entity mode)
    if (config.specificEntityId) {
      const targetId = parseInt(config.specificEntityId);
      console.log(
        `[SYNC ${syncId}] Filtering for specific entity ID: ${targetId}`,
      );

      const foundEntity = entityList.find((e) => e.id === targetId);
      if (foundEntity) {
        entityList = [foundEntity];
        console.log(
          `[SYNC ${syncId}] Found target entity ${targetId} (${foundEntity.slug})`,
        );
      } else {
        console.log(
          `[SYNC ${syncId}] Entity ${targetId} not found in list, creating placeholder`,
        );
        entityList = [{ id: targetId, slug: `entity-${targetId}` }];
      }
    }
    // Apply limit if specified (multiple entities mode)
    else if (config.limitEntities && config.entityLimit) {
      console.log(
        `[SYNC ${syncId}] Limiting to ${config.entityLimit} entities for testing`,
      );
      entityList = entityList.slice(0, config.entityLimit);
    }

    // Incremental sync: skip entities that were already processed in previous
    // runs. Full resync clears the set first so everything gets re-evaluated.
    if (config.fullResync) {
      console.log(
        `[SYNC ${syncId}] Full resync requested - clearing processed IDs`,
      );
      await syncStateManager.clearProcessedIds();
    } else if (!config.specificEntityId) {
      const totalBefore = entityList.length;
      const processedIds = await syncStateManager.getProcessedIds();
      if (processedIds.size > 0) {
        // Re-queue stale listings (last synced > 7 days ago) so upstream
        // Peekaboo changes are eventually picked up even in incremental mode.
        const staleIds = new Set<number>();
        try {
          const staleDays = getPositiveEnvNumber("SCRAPER_STALE_DAYS", 7);
          const { rows: staleRows } = await query(
            `SELECT * FROM get_stale_peekaboo_ids($1::interval)`,
            [`${staleDays} days`],
          );
          if (staleRows) {
            for (const row of staleRows) {
              staleIds.add(row.peekaboo_id);
            }
          }
          if (staleIds.size > 0) {
            console.log(
              `[SYNC ${syncId}] Found ${staleIds.size} stale listings (>${staleDays} days) for re-sync`,
            );
          }
        } catch (err) {
          console.warn(
            `[SYNC ${syncId}] Stale check failed (RPC may not exist yet):`,
            err,
          );
        }

        entityList = entityList.filter(
          (e) => !processedIds.has(e.id) || staleIds.has(e.id),
        );
        console.log(
          `[SYNC ${syncId}] Incremental mode: skipped ${totalBefore - entityList.length} already-processed entities, ${entityList.length} remaining (${staleIds.size} stale re-queued)`,
        );
      }
    }

    const totalEntities = entityList.length;
    console.log(`[SYNC ${syncId}] Found ${totalEntities} entities to process`);

    if (totalEntities === 0) {
      console.log(
        `[SYNC ${syncId}] All entities already processed - nothing to sync`,
      );
      await createSyncHistoryRecord(syncId, userId, config, 0);
      return {
        success: true,
        syncId,
        totalEntities: 0,
        duration: Date.now() - startTime,
      };
    }

    // Step 7: Update DB record with total entity count
    console.log(`[SYNC ${syncId}] Updating sync record with entity count...`);
    await updateSyncTotalEntities(syncId, totalEntities, entityListWarning);

    // Step 8: Initialize state manager
    await syncStateManager.startSync(
      syncId,
      userId || "system",
      config as unknown as Record<string, unknown>,
      totalEntities,
    );
    await markSyncStoppingIfRequested(syncId);

    // Step 7: Create batch processor
    console.log(`[SYNC ${syncId}] Initializing batch processor...`);
    const batchProcessor = await createBatchProcessor(scraper, {
      maxConcurrent: config.maxConcurrent,
      autoPublish: config.autoPublish,
      preserveManualEdits: config.preserveManualEdits,
      syncMode: config.syncMode ?? "report",
      onProgress: async (current, total, result) => {
        assertLockStillOwned();
        const entityName =
          entityList.find((e) => e.id === result.peekabooId)?.slug || "";
        await syncStateManager.updateProgress(result, entityName);

        // Update database every 5 entities for realtime updates (batched for performance)
        if (current % 5 === 0 || current === total) {
          await updateSyncProgress(
            syncId,
            (await syncStateManager.getProgress())!,
          );
        }

        console.log(
          `[SYNC ${syncId}] Progress: ${current}/${total} - ${result.action}`,
        );
      },
      onError: (peekabooId, error) => {
        console.error(`[SYNC ${syncId}] Error on entity ${peekabooId}:`, error);
        void appendLiveSyncError(syncId, {
          peekabooId,
          error: error.message,
          stack: error.stack,
          occurredAt: new Date().toISOString(),
        });
      },
    });

    // Step 8: Execute batch processing
    console.log(`[SYNC ${syncId}] Starting batch processing...`);
    const batchResult = await batchProcessor.processBatch(entityList);

    report = batchResult.report;
    const duration = Date.now() - startTime;

    // Step 9: Update state manager
    await syncStateManager.completeSync(report, duration, ownerToken);

    // Step 10: Update final status in database
    console.log(`[SYNC ${syncId}] Finalizing sync history...`);
    await completeSyncHistory(
      syncId,
      report,
      duration,
      batchResult.wasStopped
        ? "cancelled"
        : batchResult.success
          ? "completed"
          : "partial",
      entityListWarning?.message,
    );

    console.log(`[SYNC ${syncId}] Sync completed successfully`);
    console.log(`[SYNC ${syncId}] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[SYNC ${syncId}] Created: ${report.summary.entitiesCreated}`);
    console.log(`[SYNC ${syncId}] Updated: ${report.summary.entitiesUpdated}`);
    console.log(`[SYNC ${syncId}] Errors: ${report.summary.errors}`);

    return {
      success: batchResult.success,
      syncId,
      totalEntities,
      report,
      duration,
      wasCancelled: batchResult.wasStopped,
    };
  } catch (error) {
    const syncError = error as Error;
    const duration = Date.now() - startTime;

    console.error(`[SYNC ${syncId}] Sync failed:`, syncError);
    Sentry.captureException(syncError, {
      tags: {
        service: "scraper-worker",
        operation: "executeSyncOperation",
        syncId,
      },
      extra: {
        duration,
        config,
      },
    });
    const wasCancelled = syncError.message === "Sync cancellation requested";

    // Update state manager
    if (wasCancelled) {
      const emptyReport: SyncReport = {
        summary: {
          entitiesProcessed: 0,
          entitiesCreated: 0,
          entitiesUpdated: 0,
          entitiesSkipped: 0,
          imagesSynced: 0,
          branchesSynced: 0,
          errors: 0,
          startTime: new Date(startTime),
          endTime: new Date(),
        },
        results: [],
        conflicts: [],
        errors: [],
      };
      await syncStateManager.completeSync(emptyReport, duration, ownerToken);
      await completeSyncHistory(
        syncId,
        report,
        duration,
        "cancelled",
        undefined,
        "Sync cancelled by operator",
      );
      return {
        success: false,
        syncId,
        totalEntities: 0,
        error: "Sync cancelled by operator",
        wasCancelled: true,
      };
    }

    await syncStateManager.failSync(syncError, ownerToken);

    await sendScraperAlert({
      kind: "sync_failure",
      title: "Listing scraper sync failed",
      message: syncError.message,
      syncId,
      severity: "error",
      metadata: {
        durationMs: duration,
        stack: syncError.stack,
      },
    });

    // Update failure in database
    await completeSyncHistory(
      syncId,
      report,
      duration,
      "failed",
      undefined,
      syncError.message,
      syncError.stack,
    );

    return {
      success: false,
      syncId,
      totalEntities: 0,
      error: syncError.message,
    };
  } finally {
    if (heartbeat) {
      clearInterval(heartbeat);
    }
  }
}

/**
 * Create initial sync history record (called at sync start - BEFORE fetching entities)
 * This enables real-time UI feedback immediately when sync starts
 */
async function createSyncHistoryRecord(
  syncId: string,
  userId: string | null,
  config: SyncConfig,
  totalEntities: number,
): Promise<void> {
  try {
    const recordConfig = {
      ...config,
      total_entities: totalEntities, // Will be updated after fetch
    } as unknown as Record<string, unknown>;

    await query(
      `INSERT INTO listing_sync_history (
         id, started_at, config, entities_processed, entities_created,
         entities_updated, entities_skipped, images_synced, branches_synced,
         errors_count, status, triggered_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        syncId,
        new Date().toISOString(),
        recordConfig,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        "running",
        userId,
      ],
    );

    console.log(
      `[SYNC ${syncId}] Created database record for realtime tracking`,
    );
  } catch (error) {
    console.error("Error creating sync history:", error);
  }
}

/**
 * Update total entities in sync record (called after fetching entity list)
 */
async function updateSyncTotalEntities(
  syncId: string,
  totalEntities: number,
  entityListWarning?: EntityListFetchWarning | null,
): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT config FROM listing_sync_history WHERE id = $1 LIMIT 1`,
      [syncId],
    );
    const existingRecord = rows[0];

    const existingConfig =
      existingRecord?.config && typeof existingRecord.config === "object"
        ? (existingRecord.config as Record<string, unknown>)
        : {};

    const updatedConfig: Record<string, unknown> = {
      ...existingConfig,
      total_entities: totalEntities,
    };

    if (entityListWarning) {
      updatedConfig.entity_fetch_warning = entityListWarning;
    }

    await query(
      `UPDATE listing_sync_history SET config = $1, updated_at = $2 WHERE id = $3`,
      [updatedConfig, new Date().toISOString(), syncId],
    );

    console.log(`[SYNC ${syncId}] Updated total entities: ${totalEntities}`);
  } catch (error) {
    console.error("Error updating total entities:", error);
  }
}

/**
 * Update sync progress in database (called periodically during sync)
 */
async function updateSyncProgress(
  syncId: string,
  progress: {
    current: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  } | null,
): Promise<void> {
  if (!progress) return;

  try {
    await query(
      `UPDATE listing_sync_history SET
         entities_processed = $1,
         entities_created = $2,
         entities_updated = $3,
         entities_skipped = $4,
         errors_count = $5,
         updated_at = $6
       WHERE id = $7`,
      [
        progress.current,
        progress.created,
        progress.updated,
        progress.skipped,
        progress.errors,
        new Date().toISOString(),
        syncId,
      ],
    );
  } catch (error) {
    console.error("Error updating sync progress:", error);
  }
}

async function appendLiveSyncError(
  syncId: string,
  errorEntry: {
    peekabooId: number;
    error: string;
    stack?: string;
    occurredAt: string;
  },
): Promise<void> {
  try {
    const { rows } = await query(
      `SELECT config FROM listing_sync_history WHERE id = $1 LIMIT 1`,
      [syncId],
    );
    const existingRecord = rows[0];

    const config =
      existingRecord?.config && typeof existingRecord.config === "object"
        ? (existingRecord.config as Record<string, unknown>)
        : {};

    const currentErrors = Array.isArray(config.live_errors)
      ? (config.live_errors as Array<Record<string, unknown>>)
      : [];

    const nextErrors = [...currentErrors, errorEntry].slice(-200);

    await query(
      `UPDATE listing_sync_history SET config = $1, updated_at = $2 WHERE id = $3`,
      [
        { ...config, live_errors: nextErrors },
        new Date().toISOString(),
        syncId,
      ],
    );
  } catch (error) {
    console.error(`[SYNC ${syncId}] Failed to append live error log:`, error);
  }
}

async function markSyncStoppingIfRequested(syncId: string): Promise<void> {
  try {
    const stopRequested = await syncStateManager.isStopRequested(syncId);
    if (!stopRequested) return;

    await query(
      `UPDATE listing_sync_history SET status = $1, updated_at = $2
       WHERE id = $3 AND status = $4`,
      ["stopping", new Date().toISOString(), syncId, "running"],
    );
  } catch (error) {
    console.error(`[SYNC ${syncId}] Failed to mark stopping state:`, error);
  }
}

/**
 * Complete sync history record (called at sync end)
 */
async function completeSyncHistory(
  syncId: string,
  report: SyncReport | undefined,
  duration: number,
  status: "completed" | "failed" | "partial" | "cancelled",
  warningMessage?: string,
  errorMessage?: string,
  errorStack?: string,
): Promise<void> {
  try {
    const now = new Date().toISOString();

    await query(
      `UPDATE listing_sync_history SET
         completed_at = $1,
         duration_ms = $2,
         entities_processed = COALESCE($3, entities_processed),
         entities_created = COALESCE($4, entities_created),
         entities_updated = COALESCE($5, entities_updated),
         entities_skipped = COALESCE($6, entities_skipped),
         images_synced = COALESCE($7, images_synced),
         branches_synced = COALESCE($8, branches_synced),
         errors_count = COALESCE($9, errors_count),
         status = $10,
         report = $11,
         error_message = $12,
         error_stack = $13,
         updated_at = $14
       WHERE id = $15`,
      [
        now,
        duration,
        report ? report.summary.entitiesProcessed : null,
        report ? report.summary.entitiesCreated : null,
        report ? report.summary.entitiesUpdated : null,
        report ? report.summary.entitiesSkipped : null,
        report ? report.summary.imagesSynced : null,
        report ? report.summary.branchesSynced : null,
        report ? report.summary.errors : null,
        status,
        report ? (report as unknown as Record<string, unknown>) : null,
        errorMessage || warningMessage || null,
        errorStack || null,
        now,
        syncId,
      ],
    );

    console.log(
      `[SYNC ${syncId}] Updated database with final status: ${status}`,
    );
  } catch (error) {
    console.error("Error completing sync history:", error);
  }
}
