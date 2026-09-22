"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Worker /sync/status response shapes (see apps/scraper-worker/src/worker-runtime.ts
// handleStatus + lib/scraper/redis-state-manager.ts), proxied through
// /api/admin/listing-scraper/status.
interface WorkerSyncProgress {
  current: number;
  total: number;
  status: string;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  currentEntity?: string;
}

interface WorkerScraperStats {
  entitiesProcessed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
  errors: number;
  missingInInside?: number;
  existingWouldUpdate?: number;
  existingUnchanged?: number;
  dealsWouldCreate?: number;
  dealsWouldUpdate?: number;
  skippedConflicts?: number;
}

interface WorkerStatusResponse {
  status?: "running" | "completed" | "idle" | string;
  syncId?: string;
  progress?: WorkerSyncProgress;
  report?: { summary: WorkerScraperStats };
  message?: string;
  error?: string;
}

interface ProgressMonitorProps {
  onSyncComplete?: () => void;
  onSyncFailed?: (error: string) => void;
}

export function ProgressMonitor({
  onSyncComplete,
  onSyncFailed,
}: ProgressMonitorProps) {
  const { toast } = useToast();
  const [progress, setProgress] = React.useState<{
    current: number;
    total: number;
    status: string;
    created: number;
    updated: number;
    errors: number;
    currentEntity?: string;
    chunkSize?: number;
    chunkIndex?: number;
    chunkTotal?: number;
    chunkProgress?: string;
    missingInInside?: number;
    existingWouldUpdate?: number;
    existingUnchanged?: number;
    dealsWouldCreate?: number;
    dealsWouldUpdate?: number;
  } | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<
    "idle" | "running" | "completed" | "failed" | "partial" | "stopping" | "cancelled"
  >("idle");
  const [isStopping, setIsStopping] = React.useState(false);
  const [entityFetchWarning, setEntityFetchWarning] = React.useState<string | null>(null);

  // Poll the worker sync status (Supabase Realtime is no longer available).
  // Polls quickly (4s) while a sync is running/stopping so the progress bar
  // feels live, and backs off to a slow heartbeat (15s) when idle/completed
  // so a newly-started sync is still picked up without hammering the worker.
  React.useEffect(() => {
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let previousStatus: "idle" | "running" | "completed" = "idle";

    async function poll() {
      try {
        const res = await fetch("/api/admin/listing-scraper/status", {
          cache: "no-store",
        });

        if (!isMounted) return;

        if (!res.ok) {
          scheduleNext("idle");
          return;
        }

        const data = (await res.json()) as WorkerStatusResponse;
        updateProgressFromStatus(data);
        scheduleNext(
          data.status === "running" ? "running" : "idle"
        );
      } catch (error) {
        console.error("[ProgressMonitor] Poll failed:", error);
        if (isMounted) scheduleNext("idle");
      }
    }

    function scheduleNext(effectiveStatus: "running" | "idle") {
      if (!isMounted) return;
      const delay = effectiveStatus === "running" ? 4000 : 15000;
      timer = setTimeout(poll, delay);
    }

    function updateProgressFromStatus(data: WorkerStatusResponse) {
      const newStatus: "idle" | "running" | "completed" =
        data.status === "running"
          ? "running"
          : data.status === "completed"
            ? "completed"
            : "idle";

      setSyncStatus(newStatus);
      if (newStatus !== "running") {
        setIsStopping(false);
      }
      setEntityFetchWarning(null);

      if (newStatus === "running" && data.progress) {
        const p = data.progress;
        setProgress({
          current: p.current,
          total: p.total,
          status: p.status || "running",
          created: p.created,
          updated: p.updated,
          errors: p.errors,
          currentEntity: p.currentEntity,
        });
      } else if (newStatus === "completed" && data.report?.summary) {
        const s = data.report.summary;
        setProgress({
          current: s.entitiesProcessed,
          total: s.entitiesProcessed,
          status: "completed",
          created: s.entitiesCreated,
          updated: s.entitiesUpdated,
          errors: s.errors,
          missingInInside: s.missingInInside,
          existingWouldUpdate: s.existingWouldUpdate,
          existingUnchanged: s.existingUnchanged,
          dealsWouldCreate: s.dealsWouldCreate,
          dealsWouldUpdate: s.dealsWouldUpdate,
        });
      } else if (newStatus === "idle") {
        setProgress(null);
      }

      // Trigger callbacks on status transitions
      if (
        previousStatus === "running" &&
        newStatus === "completed" &&
        onSyncComplete
      ) {
        onSyncComplete();
      } else if (
        previousStatus === "running" &&
        newStatus === "idle" &&
        onSyncFailed
      ) {
        onSyncFailed("Sync operation stopped");
      }

      previousStatus = newStatus;
    }

    void poll();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [onSyncComplete, onSyncFailed]);

  // Show "No Active Sync" only when truly idle
  if (syncStatus === "idle" && !progress) {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
            <div>
              <p className="font-semibold text-lg">No Active Sync</p>
              <p className="text-sm text-muted-foreground mt-1">
                There is no sync operation currently running.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Start a new sync from the Configuration tab.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show "Initializing" when running but no progress data yet
  // This happens when DB record is created but entities haven't been fetched yet
  if (syncStatus === "running" && !progress) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <div>
              <p className="text-sm font-semibold">
                Initializing Sync Operation...
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Fetching entity list from Peekaboo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take 30-60 seconds for large datasets (10k+ entities)
              </p>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">
                💡 Progress bar will appear once entities are counted
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Shouldn't reach here, but fallback just in case
  if (!progress) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Waiting for sync to start...
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This may take a few moments
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercent =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  async function handleStopSync() {
    try {
      setIsStopping(true);
      const response = await fetch("/api/admin/listing-scraper/stop", {
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to stop sync");
      }

      toast({
        title: "Stop Requested",
        description:
          data.message ||
          "Sync will finish the current chunk and stop gracefully.",
      });
    } catch (error) {
      const stopError = error as Error;
      setIsStopping(false);
      toast({
        title: "Stop Failed",
        description: stopError.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Main Progress */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {syncStatus === "stopping" || isStopping
                  ? "Stopping Sync..."
                  : "Sync in Progress"}
              </CardTitle>
              {(syncStatus === "running" || syncStatus === "stopping") && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopSync}
                  disabled={isStopping || syncStatus === "stopping"}
                >
                  {isStopping || syncStatus === "stopping"
                    ? "Stopping..."
                    : "Stop Sync"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {entityFetchWarning && (
              <div className="rounded-lg border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Source warning: {entityFetchWarning}
              </div>
            )}

            {(syncStatus === "running" || syncStatus === "stopping") && progress.chunkSize && (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Chunk info: size {progress.chunkSize} | chunk {progress.chunkIndex}/{progress.chunkTotal}
                {syncStatus === "stopping" && progress.chunkProgress
                  ? ` | finishing current chunk progress ${progress.chunkProgress}`
                  : ""}
              </div>
            )}

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {progress.current} of {progress.total} entities
                </span>
                <span className="text-muted-foreground">
                  {progressPercent.toFixed(1)}%
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>

            {/* Current Entity */}
            {progress.currentEntity && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Processing: {progress.currentEntity}</span>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {progress.created}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Created</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {progress.updated}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Updated</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {progress.errors}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {(progress.missingInInside != null ||
              progress.existingWouldUpdate != null ||
              progress.existingUnchanged != null) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t">
                <div className="text-center rounded-lg bg-muted/40 p-2">
                  <div className="text-lg font-semibold">
                    {progress.missingInInside ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Missing in Inside
                  </p>
                </div>
                <div className="text-center rounded-lg bg-muted/40 p-2">
                  <div className="text-lg font-semibold">
                    {progress.existingWouldUpdate ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Would update
                  </p>
                </div>
                <div className="text-center rounded-lg bg-muted/40 p-2">
                  <div className="text-lg font-semibold">
                    {progress.existingUnchanged ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Unchanged</p>
                </div>
                {(progress.dealsWouldCreate != null ||
                  progress.dealsWouldUpdate != null) && (
                  <>
                    <div className="text-center rounded-lg bg-muted/40 p-2">
                      <div className="text-lg font-semibold">
                        {progress.dealsWouldCreate ?? 0}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Deals would create
                      </p>
                    </div>
                    <div className="text-center rounded-lg bg-muted/40 p-2">
                      <div className="text-lg font-semibold">
                        {progress.dealsWouldUpdate ?? 0}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Deals would update
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Status Message */}
            <div
              className={cn(
                "text-center p-3 rounded-lg text-sm font-medium",
                progress.status === "running"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : progress.status === "stopping"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "bg-muted",
              )}
            >
              {progress.status === "running"
                ? "Sync in progress..."
                : progress.status === "stopping"
                  ? `Stop requested. Finishing current chunk (${progress.chunkProgress || "..."})...`
                : progress.status}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Estimated Time */}
      {progressPercent > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-sm text-muted-foreground"
        >
          <Clock className="h-4 w-4 inline mr-1" />
          Estimated time remaining: ~
          {Math.ceil((progress.total - progress.current) / 2)} minutes
        </motion.div>
      )}
    </div>
  );
}
