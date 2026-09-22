/**
 * BATCH PROCESSOR
 * Handles parallel processing of multiple listings with rate limiting & progress tracking
 *
 * Features:
 * - Parallel processing with configurable concurrency
 * - Rate limiting (respects Peekaboo API limits)
 * - Progress tracking & reporting
 * - Error resilience (continues on individual failures)
 * - Detailed sync reports
 */

import { EntityScraper } from "../scrapers/entity-scraper";
import {
  DatabaseSync,
  createDatabaseSync,
  type SyncMode,
} from "../core/database-sync";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";
import type { SyncResult, SyncReport } from "@/types/peekaboo-scraper.types";

// ============================================================================
// TYPES
// ============================================================================

export interface BatchProcessorOptions {
  /**
   * Maximum number of concurrent operations
   * Default: 5 (safe for most APIs)
   */
  maxConcurrent?: number;

  /**
   * Auto-publish synced listings
   */
  autoPublish?: boolean;

  /**
   * Preserve manual edits
   */
  preserveManualEdits?: boolean;

  /**
   * deals_only (default) or full listing upsert
   */
  syncMode?: SyncMode;

  /**
   * Callback for progress updates
   */
  onProgress?: (current: number, total: number, result: SyncResult) => void;

  /**
   * Callback for errors
   */
  onError?: (peekabooId: number, error: Error) => void;
}

export interface BatchSyncResult {
  success: boolean;
  wasStopped: boolean;
  report: SyncReport;
  duration: number; // milliseconds
}

// ============================================================================
// BATCH PROCESSOR CLASS
// ============================================================================

export class BatchProcessor {
  private scraper: EntityScraper;
  private dbSync: DatabaseSync | null = null;
  private options: Required<
    Omit<BatchProcessorOptions, "onProgress" | "onError">
  >;
  private onProgress?: (
    current: number,
    total: number,
    result: SyncResult,
  ) => void;
  private onError?: (peekabooId: number, error: Error) => void;

  constructor(scraper: EntityScraper, options: BatchProcessorOptions = {}) {
    this.scraper = scraper;
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 5,
      autoPublish: options.autoPublish ?? false,
      preserveManualEdits: options.preserveManualEdits ?? true,
      syncMode: options.syncMode ?? "deals_only",
    };
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /**
   * Initialize database sync and load config from Redis
   */
  async init(): Promise<void> {
    // Load config from Redis (set by admin UI)
    const redisConfig = await syncStateManager.getConfig();
    if (redisConfig && typeof redisConfig.maxConcurrent === "number") {
      this.options.maxConcurrent = redisConfig.maxConcurrent;
      console.log(
        `[BATCH] Using Redis config: maxConcurrent=${redisConfig.maxConcurrent}`,
      );
    }

    this.dbSync = await createDatabaseSync({
      autoPublish: this.options.autoPublish,
      preserveManualEdits: this.options.preserveManualEdits,
      syncMode: this.options.syncMode,
    });
  }

  /**
   * Process a batch of entity IDs with concurrency control
   */
  async processBatch(
    entities: Array<{ id: number; slug: string }>,
  ): Promise<BatchSyncResult> {
    if (!this.dbSync) {
      throw new Error("BatchProcessor not initialized. Call init() first.");
    }

    const startTime = Date.now();
    const results: SyncResult[] = [];
    const conflicts: SyncReport["conflicts"] = [];
    const errors: SyncReport["errors"] = [];

    console.log(
      `\n[BATCH] Starting batch processing of ${entities.length} entities...`,
    );
    console.log(`[BATCH] Concurrency: ${this.options.maxConcurrent}`);
    console.log(
      `[BATCH] Sync mode: ${this.options.syncMode}`,
    );
    console.log(
      `[BATCH] Auto-publish: ${this.options.autoPublish ? "Yes" : "No"}`,
    );

    let processed = 0;
    let wasStopped = false;

    // Process in chunks to respect concurrency limit
    for (let i = 0; i < entities.length; i += this.options.maxConcurrent) {
      // Check for graceful stop request
      if (await syncStateManager.isStopRequested()) {
        console.log(
          `\n[BATCH] Stop requested. Finishing current batch and stopping gracefully...`,
        );
        console.log(
          `[BATCH] Processed ${processed}/${entities.length} entities before stopping`,
        );
        wasStopped = true;
        break;
      }

      const chunk = entities.slice(i, i + this.options.maxConcurrent);

      console.log(
        `\n[BATCH] Processing chunk ${
          Math.floor(i / this.options.maxConcurrent) + 1
        }/${Math.ceil(
          entities.length / this.options.maxConcurrent,
        )} (entities ${i + 1}-${Math.min(i + chunk.length, entities.length)})`,
      );

      // Process chunk in parallel
      const chunkResults = await Promise.allSettled(
        chunk.map((entity) => this.processEntity(entity.id, entity.slug)),
      );

      // Collect results
      for (let j = 0; j < chunkResults.length; j++) {
        const result = chunkResults[j];
        const entity = chunk[j];
        processed++;

        if (result.status === "fulfilled") {
          results.push(result.value);

          // Report progress
          if (this.onProgress) {
            await this.onProgress(processed, entities.length, result.value);
          }

          // Track conflicts
          if (result.value.action === "conflict") {
            conflicts.push({
              peekabooId: entity.id,
              listingId: result.value.listingId!,
              changes: {}, // Would need to implement detailed diff
            });
          }
        } else {
          // Error occurred
          const error = result.reason as Error;
          console.error(
            `[BATCH] Failed to process entity ${entity.id}:`,
            error,
          );

          errors.push({
            peekabooId: entity.id,
            error: error.message,
            stack: error.stack,
          });

          // Report error
          if (this.onError) {
            this.onError(entity.id, error);
          }

          // Add failed result
          results.push({
            peekabooId: entity.id,
            action: "skip",
            success: false,
            error: error.message,
            details: {
              imagesProcessed: 0,
              branchesProcessed: 0,
              categoryMapped: false,
            },
          });
        }
      }

      // Brief pause between chunks to avoid overwhelming the system
      if (i + this.options.maxConcurrent < entities.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;

    // Generate report
    const report: SyncReport = {
      summary: {
        entitiesProcessed: results.length,
        entitiesCreated: results.filter((r) => r.action === "create").length,
        entitiesUpdated: results.filter(
          (r) => r.action === "update" || r.action === "conflict",
        ).length,
        entitiesSkipped: results.filter((r) => r.action === "skip").length,
        imagesSynced: results.reduce(
          (sum, r) => sum + (r.details.imagesProcessed || 0),
          0,
        ),
        branchesSynced: results.reduce(
          (sum, r) => sum + (r.details.branchesProcessed || 0),
          0,
        ),
        errors: errors.length,
        startTime: new Date(startTime),
        endTime: new Date(),
      },
      results,
      conflicts,
      errors,
    };

    console.log(`\n[BATCH] Batch processing complete!`);
    console.log(`[BATCH] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[BATCH] Created: ${report.summary.entitiesCreated}`);
    console.log(`[BATCH] Updated: ${report.summary.entitiesUpdated}`);
    console.log(`[BATCH] Skipped: ${report.summary.entitiesSkipped}`);
    console.log(`[BATCH] Errors: ${report.summary.errors}`);
    console.log(`[BATCH] Conflicts: ${conflicts.length}`);

    return {
      success: errors.length === 0 && !wasStopped,
      wasStopped,
      report,
      duration,
    };
  }

  /**
   * Process a single entity (scrape + sync)
   */
  private async processEntity(
    entityId: number,
    slug: string,
  ): Promise<SyncResult> {
    if (!this.dbSync) {
      throw new Error("DatabaseSync not initialized");
    }

    console.log(`\n[BATCH] Processing entity ${entityId} (${slug})...`);

    try {
      // Step 1: Scrape entity data
      const processed = await this.scraper.processEntity(entityId, slug);

      // Step 2: Sync to database (listing first, then images, branches, deals)
      const result = await this.dbSync.syncListing(
        processed.listing,
        processed.branches,
        processed.pendingImages, // Pass pending images (not uploaded yet)
        processed.deals,
      );

      console.log(
        `[BATCH] Entity ${entityId} synced (action: ${result.action})`,
      );

      return result;
    } catch (error) {
      const processError = error as Error;
      console.error(`[BATCH] Entity ${entityId} failed:`, processError);
      throw processError;
    }
  }

  /**
   * Get summary statistics from a report
   */
  static getSummaryStats(report: SyncReport): {
    totalProcessed: number;
    successRate: number;
    avgImagesPerListing: number;
    avgBranchesPerListing: number;
  } {
    const totalProcessed = report.summary.entitiesProcessed;
    const successRate =
      totalProcessed > 0
        ? ((totalProcessed - report.summary.errors) / totalProcessed) * 100
        : 0;
    const avgImagesPerListing =
      totalProcessed > 0 ? report.summary.imagesSynced / totalProcessed : 0;
    const avgBranchesPerListing =
      totalProcessed > 0 ? report.summary.branchesSynced / totalProcessed : 0;

    return {
      totalProcessed,
      successRate,
      avgImagesPerListing,
      avgBranchesPerListing,
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.dbSync) {
      await this.dbSync.cleanup();
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create and initialize a BatchProcessor instance
 */
export async function createBatchProcessor(
  scraper: EntityScraper,
  options?: BatchProcessorOptions,
): Promise<BatchProcessor> {
  const processor = new BatchProcessor(scraper, options);
  await processor.init();
  return processor;
}
