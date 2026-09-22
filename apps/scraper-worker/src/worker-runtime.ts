import { createServer, IncomingMessage, ServerResponse } from "http";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  executeSyncOperation,
  type SyncConfig,
} from "@/lib/scraper/sync-executor";
import { syncStateManager } from "@/lib/scraper/redis-state-manager";
import { query } from "@/lib/db";
import { checkListingSyncFreshness } from "@/lib/scraper/alerts";
import {
  captureWorkerException,
  redactForLog,
} from "@/lib/sentry/worker-sentry";

const WorkerStartSchema = z.object({
  syncId: z.string().uuid(),
  userId: z.string().uuid(),
  config: z.object({
    maxConcurrent: z.number().min(1).max(10),
    autoPublish: z.boolean(),
    preserveManualEdits: z.boolean(),
    limitEntities: z.boolean(),
    entityLimit: z.number().min(1).max(1000).optional(),
    specificEntityId: z.string().optional(),
    syncMode: z.enum(["report", "create_missing", "full", "deals_only"]).default("report"),
  }),
});

const WorkerAutomationSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["manual", "interval"]).default("manual"),
  intervalMinutes: z.number().min(15).max(1440).default(1440),
  syncDefaults: z.object({
    maxConcurrent: z.number().min(1).max(10).default(5),
    autoPublish: z.boolean().default(false),
    preserveManualEdits: z.boolean().default(true),
    syncMode: z.enum(["report", "create_missing", "full", "deals_only"]).default("report"),
  }),
  canary: z.object({
    enabled: z.boolean().default(false),
    entityLimit: z.number().min(3).max(100).default(10),
    maxErrorRatePercent: z.number().min(1).max(100).default(40),
  }),
});

const WORKER_CONFIG_KEY = "scraper.worker_automation";
const AUTOMATION_LOOP_MS = 60_000;

function getPositiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function json(res: ServerResponse, statusCode: number, body: unknown) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage): boolean {
  const configured = process.env.SCRAPER_WORKER_SECRET?.trim() || "";
  if (!configured) {
    return true;
  }

  const incoming = req.headers["x-worker-secret"];
  const headerValue = Array.isArray(incoming) ? incoming[0] : incoming;
  return (headerValue || "") === configured;
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function handleHealth(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const running = await syncStateManager.isSyncRunning();
  const activeSyncId = await syncStateManager.getActiveSyncId();

  json(res, 200, {
    ok: true,
    running,
    activeSyncId,
    service: "listing-scraper-worker",
    timestamp: new Date().toISOString(),
  });
}

function handleLive(_req: IncomingMessage, res: ServerResponse) {
  json(res, 200, { ok: true });
}

async function handleStatus(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const completedReport = await syncStateManager.getCompletedReport();
  if (completedReport) {
    json(res, 200, {
      status: "completed",
      syncId: completedReport.syncId,
      report: completedReport.report,
      duration: completedReport.duration,
    });
    return;
  }

  const running = await syncStateManager.isSyncRunning();
  if (running) {
    const syncId = await syncStateManager.getActiveSyncId();
    const progress = await syncStateManager.getProgress();
    json(res, 200, { status: "running", syncId, progress });
    return;
  }

  json(res, 200, {
    status: "idle",
    message: "No sync operation in progress",
  });
}

async function handleStart(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  if (await syncStateManager.isSyncRunning()) {
    json(res, 409, {
      error: "Sync already running",
      message: "Please wait for the current sync to complete",
    });
    return;
  }

  const rawBody = await readRequestBody(req);
  let parsedJson: unknown = {};
  if (rawBody.length) {
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      json(res, 400, { error: "Invalid JSON body" });
      return;
    }
  }
  const payload = WorkerStartSchema.parse(parsedJson);
  const ownerToken = randomUUID();
  const lockLeaseMs = getPositiveEnvNumber("SCRAPER_LOCK_LEASE_MS", 10 * 60_000);
  const lockAcquired = await syncStateManager.acquireSyncLock(
    payload.syncId,
    lockLeaseMs,
    ownerToken,
  );

  if (!lockAcquired) {
    json(res, 409, {
      error: "Sync already running",
      message: "Please wait for the current sync to complete",
    });
    return;
  }

  void executeSyncOperation(
    payload.syncId,
    payload.userId,
    payload.config as SyncConfig,
    { ownerToken, lockAlreadyAcquired: true },
  ).catch((error) => {
    console.error("[WORKER] Async sync failed:", redactForLog(error));
    captureWorkerException(error, {
      scope: "worker_runtime",
      operation: "manual_sync",
      syncId: payload.syncId,
    });
  });

  json(res, 200, {
    success: true,
    syncId: payload.syncId,
    status: "running",
    executionMode: "external-worker",
  });
}

async function handleStop(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const activeSyncId = await syncStateManager.getActiveSyncId();
  if (!activeSyncId) {
    json(res, 404, { error: "No active sync to stop" });
    return;
  }

  const stopState = await syncStateManager.requestStop(activeSyncId);
  await markSyncAsStopping(activeSyncId);
  json(res, 200, {
    success: true,
    syncId: activeSyncId,
    state: stopState.state,
    message: "Stop requested. Current chunk will finish and sync will stop.",
  });
}

/** Clears orphaned Redis sync lock so a new /sync/start can proceed. */
async function handleForceUnlock(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) {
    json(res, 401, { error: "Unauthorized" });
    return;
  }

  const wasRunning = await syncStateManager.isSyncRunning();
  const activeSyncId = await syncStateManager.getActiveSyncId();
  await syncStateManager.clearActiveSyncLock();

  json(res, 200, {
    success: true,
    cleared: true,
    wasRunning,
    previousSyncId: activeSyncId,
    message: "Sync lock cleared. You can start a new sync.",
  });
}

async function markSyncAsStopping(syncId: string) {
  try {
    await query(
      `UPDATE listing_sync_history
       SET status = 'stopping', updated_at = NOW()
       WHERE id = $1 AND status = 'running'`,
      [syncId],
    );
  } catch (error) {
    console.warn(`[WORKER] Failed to mark sync as stopping (syncId=${syncId}):`, error);
    captureWorkerException(error, {
      scope: "worker_runtime",
      operation: "markSyncAsStopping",
      syncId,
    });
  }
}

async function loadWorkerAutomationConfig() {
  let configValue: unknown;
  try {
    const { rows } = await query(
      `SELECT config_value FROM system_config WHERE config_key = $1 LIMIT 1`,
      [WORKER_CONFIG_KEY],
    );
    configValue = rows[0]?.config_value;
  } catch (error) {
    throw new Error(
      `Failed to load worker automation config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = WorkerAutomationSchema.safeParse(configValue || {});
  if (!parsed.success) {
    throw new Error("Worker automation config is invalid");
  }

  return parsed.data;
}

async function runAutomationTick(lastRunAt: number): Promise<number> {
  try {
    await checkListingSyncFreshness();

    const workerConfig = await loadWorkerAutomationConfig();
    if (!workerConfig.enabled || workerConfig.mode !== "interval") {
      return lastRunAt;
    }

    const running = await syncStateManager.isSyncRunning();
    if (running) {
      return lastRunAt;
    }

    const intervalMs = workerConfig.intervalMinutes * 60_000;
    if (Date.now() - lastRunAt < intervalMs) {
      return lastRunAt;
    }

    const nextRunAt = Date.now();

    const autoSyncConfig: SyncConfig = {
      maxConcurrent: workerConfig.syncDefaults.maxConcurrent,
      autoPublish: workerConfig.syncDefaults.autoPublish,
      preserveManualEdits: workerConfig.syncDefaults.preserveManualEdits,
      // Automation always defaults to report unless explicitly overridden in saved config
      syncMode: workerConfig.syncDefaults.syncMode ?? "report",
      limitEntities: false,
    };

    if (workerConfig.canary.enabled) {
      const canarySyncId = crypto.randomUUID();
      const canaryConfig: SyncConfig = {
        maxConcurrent: Math.min(workerConfig.syncDefaults.maxConcurrent, 3),
        autoPublish: false,
        preserveManualEdits: workerConfig.syncDefaults.preserveManualEdits,
        syncMode: "report",
        limitEntities: true,
        entityLimit: workerConfig.canary.entityLimit,
      };

      console.log(
        `[WORKER] Starting canary sync before full interval run, syncId=${canarySyncId}`,
      );

      const canaryResult = await executeSyncOperation(
        canarySyncId,
        null,
        canaryConfig,
      );

      const processed = canaryResult.report?.summary.entitiesProcessed || 0;
      const errors = canaryResult.report?.summary.errors || 0;
      const errorRatePercent =
        processed > 0 ? (errors / processed) * 100 : 100;

      console.log(
        `[WORKER] Canary result: processed=${processed}, errors=${errors}, errorRate=${errorRatePercent.toFixed(
          1,
        )}%`,
      );

      if (errorRatePercent > workerConfig.canary.maxErrorRatePercent) {
        console.warn(
          `[WORKER] Canary gate blocked full sync. Error rate ${errorRatePercent.toFixed(
            1,
          )}% > threshold ${workerConfig.canary.maxErrorRatePercent}%`,
        );
        return nextRunAt;
      }
    }

    const autoSyncId = crypto.randomUUID();
    console.log(
      `[WORKER] Starting automated interval sync (${workerConfig.intervalMinutes}m), syncId=${autoSyncId}`,
    );

    void executeSyncOperation(autoSyncId, null, autoSyncConfig).catch((error) => {
      console.error("[WORKER] Automated sync failed:", redactForLog(error));
      captureWorkerException(error, {
        scope: "worker_runtime",
        operation: "automated_sync",
        syncId: autoSyncId,
      });
    });

    return nextRunAt;
  } catch (error) {
    console.error("[WORKER] Automation tick failed:", redactForLog(error));
    captureWorkerException(error, {
      scope: "worker_runtime",
      operation: "automation_tick",
    });
    return lastRunAt;
  }
}

function startAutomationLoop() {
  let lastRunAt = 0;

  setInterval(() => {
    void runAutomationTick(lastRunAt).then((next) => {
      lastRunAt = next;
    });
  }, AUTOMATION_LOOP_MS);

  void runAutomationTick(lastRunAt).then((next) => {
    lastRunAt = next;
  });
}

async function recoverOrphanedActiveSyncLock() {
  const lock = await syncStateManager.getSyncLockInfo();
  const ttlMs = await syncStateManager.getSyncLockTtlMs();

  // The sync lock is lease-based. On startup, keep any lock with a live TTL
  // (or unexpired metadata) so another worker cannot double-run a sync.
  if (lock && (ttlMs > 0 || lock.expiresAt > Date.now())) {
    return;
  }

  const activeSyncId = await syncStateManager.getActiveSyncId();
  if (!activeSyncId) {
    return;
  }

  const cleared = await syncStateManager.clearExpiredActiveSyncState();
  if (!cleared) {
    return;
  }

  console.warn(
    `[WORKER] Cleared expired orphaned active sync state on startup${
      activeSyncId ? ` (syncId=${activeSyncId})` : ""
    }.`,
  );
}

export async function startScraperWorker(port: number): Promise<void> {
  const server = createServer(async (req, res) => {
    try {
      const method = req.method || "GET";
      const url = new URL(req.url || "/", `http://localhost:${port}`);
      const path = url.pathname;

      if (method === "GET" && path === "/live") {
        handleLive(req, res);
        return;
      }

      if (method === "GET" && path === "/health") {
        await handleHealth(req, res);
        return;
      }

      if (method === "GET" && path === "/sync/status") {
        await handleStatus(req, res);
        return;
      }

      if (method === "POST" && path === "/sync/start") {
        await handleStart(req, res);
        return;
      }

      if (method === "POST" && path === "/sync/stop") {
        await handleStop(req, res);
        return;
      }

      if (method === "POST" && path === "/sync/force-unlock") {
        await handleForceUnlock(req, res);
        return;
      }

      json(res, 404, {
        error: "Not found",
        method,
        path,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        json(res, 400, {
          error: "Invalid payload",
          details: error.issues,
        });
        return;
      }

      console.error("[WORKER] HTTP request error:", redactForLog(error));
      captureWorkerException(error, {
        scope: "worker_runtime",
        operation: "http_request_handler",
      });
      json(res, 500, { error: "Internal server error" });
    }
  });

  await recoverOrphanedActiveSyncLock();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`[WORKER] Listing scraper worker listening on port ${port}`);
  startAutomationLoop();
}
