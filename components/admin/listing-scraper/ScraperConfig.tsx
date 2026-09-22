"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  Settings2,
  AlertTriangle,
  Activity,
  RotateCcw,
  Timer,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ScraperConfigProps {
  onRunningChange: (running: boolean) => void;
  _onComplete?: () => void;
}

export function ScraperConfig({ onRunningChange }: ScraperConfigProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingWorker, setIsCheckingWorker] = React.useState(false);
  const [isResettingState, setIsResettingState] = React.useState(false);
  const [isSavingWorkerConfig, setIsSavingWorkerConfig] = React.useState(false);
  const [workerConfig, setWorkerConfig] = React.useState({
    enabled: false,
    mode: "manual" as "manual" | "interval",
    intervalMinutes: 1440,
    syncDefaults: {
      maxConcurrent: 5,
      autoPublish: false,
      preserveManualEdits: true,
      syncMode: "report" as
        | "report"
        | "create_missing"
        | "full"
        | "deals_only",
    },
    canary: {
      enabled: false,
      entityLimit: 10,
      maxErrorRatePercent: 40,
    },
  });

  // Configuration state
  const [config, setConfig] = React.useState({
    maxConcurrent: 5,
    autoPublish: false,
    preserveManualEdits: true,
    syncMode: "report" as
      | "report"
      | "create_missing"
      | "full"
      | "deals_only",
    limitEntities: false,
    entityLimit: 10,
    specificEntityId: "",
  });

  const handleStartSync = async () => {
    setIsLoading(true);
    onRunningChange(true);

    try {
      const response = await fetch("/api/admin/listing-scraper/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start sync");
      }

      toast({
        title: "Sync Started",
        description: "Switching to Progress tab...",
      });

      // Auto-switch to progress tab for immediate feedback
      // The ProgressMonitor will show real-time updates via Supabase Realtime
      setTimeout(() => {
        // Trigger tab change via parent (ListingScraperDashboard)
        // We'll emit a custom event that the parent listens to
        window.dispatchEvent(new CustomEvent("scraper-sync-started"));
      }, 100);
    } catch (error) {
      const syncError = error as Error;
      setIsLoading(false);
      onRunningChange(false);

      toast({
        title: "Error",
        description: syncError.message,
        variant: "destructive",
      });
    }
  };

  const handleCheckWorkerHealth = async () => {
    setIsCheckingWorker(true);

    try {
      const response = await fetch("/api/admin/listing-scraper/worker-health", {
        method: "GET",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Worker health check failed");
      }

      if (!data.configured) {
        toast({
          title: "Worker Not Configured",
          description: "SCRAPER_WORKER_URL is missing. API will run in local-process mode.",
        });
        return;
      }

      if (data.reachable) {
        toast({
          title: "Worker Reachable",
          description: "External scraper worker is healthy and reachable.",
        });
        return;
      }

      toast({
        title: "Worker Unreachable",
        description: "Worker is configured but health check failed.",
        variant: "destructive",
      });
    } catch (error) {
      const checkError = error as Error;
      toast({
        title: "Worker Health Check Failed",
        description: checkError.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingWorker(false);
    }
  };

  React.useEffect(() => {
    const loadWorkerConfig = async () => {
      try {
        const response = await fetch("/api/admin/listing-scraper/worker-config");
        if (!response.ok) return;
        const data = (await response.json()) as {
          config?: typeof workerConfig;
        };
        if (data.config) {
          setWorkerConfig({
            ...data.config,
            syncDefaults: {
              ...data.config.syncDefaults,
              syncMode: data.config.syncDefaults.syncMode ?? "report",
            },
          });
        }
      } catch (error) {
        console.error("Failed to load worker config:", error);
      }
    };

    void loadWorkerConfig();
  }, []);

  const handleSaveWorkerConfig = async () => {
    setIsSavingWorkerConfig(true);
    try {
      const response = await fetch("/api/admin/listing-scraper/worker-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workerConfig),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to save worker config");
      }

      toast({
        title: "Worker Config Saved",
        description: "Automation settings were saved successfully.",
      });
    } catch (error) {
      const saveError = error as Error;
      toast({
        title: "Failed to Save Worker Config",
        description: saveError.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingWorkerConfig(false);
    }
  };

  const handleResetDevState = async () => {
    setIsResettingState(true);
    try {
      const response = await fetch("/api/admin/listing-scraper/reset-dev-state", {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to reset scraper state");
      }

      toast({
        title: "Dev State Reset",
        description: data.message || "Scraper state has been reset.",
      });
    } catch (error) {
      const resetError = error as Error;
      toast({
        title: "Reset Failed",
        description: resetError.message,
        variant: "destructive",
      });
    } finally {
      setIsResettingState(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              <CardTitle>Sync Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure how listings will be imported and synced from
              Peekaboo.guru
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Concurrency Settings */}
            <div className="space-y-2">
              <Label htmlFor="maxConcurrent">
                Concurrent Operations (1-10)
              </Label>
              <Input
                id="maxConcurrent"
                type="number"
                min={1}
                max={10}
                value={config.maxConcurrent}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxConcurrent: parseInt(e.target.value) || 5,
                  })
                }
                disabled={isLoading}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                Number of listings to process simultaneously (default: 5)
              </p>
            </div>

            {/* Sync Mode */}
            <div className="space-y-2">
              <Label htmlFor="syncMode">Sync Mode</Label>
              <Select
                value={config.syncMode}
                onValueChange={(
                  value: "report" | "create_missing" | "full" | "deals_only",
                ) => setConfig({ ...config, syncMode: value })}
                disabled={isLoading}
              >
                <SelectTrigger id="syncMode" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="report">
                    Report only (safe preview)
                  </SelectItem>
                  <SelectItem value="create_missing">
                    Create missing drafts
                  </SelectItem>
                  <SelectItem value="deals_only">Deals only</SelectItem>
                  <SelectItem value="full">Full listing sync</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Report compares Peekaboo vs Inside with no writes. Create missing
                adds drafts for Peekaboo venues you lack. Deals only refreshes
                discounts. Full upserts listing metadata (not prices/capacity).
              </p>
            </div>

            {/* Auto Publish */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="autoPublish">Auto-Publish Listings</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically set status to &quot;published&quot; instead of
                  &quot;draft&quot; (Full mode only)
                </p>
              </div>
              <Switch
                id="autoPublish"
                checked={config.autoPublish}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, autoPublish: checked })
                }
                disabled={
                  isLoading ||
                  config.syncMode === "deals_only" ||
                  config.syncMode === "report" ||
                  config.syncMode === "create_missing"
                }
              />
            </div>

            {/* Preserve Manual Edits */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="preserveManualEdits">
                  Preserve Manual Edits
                </Label>
                <p className="text-sm text-muted-foreground">
                  Skip updates for listings that were manually edited after last
                  sync
                </p>
              </div>
              <Switch
                id="preserveManualEdits"
                checked={config.preserveManualEdits}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, preserveManualEdits: checked })
                }
                disabled={isLoading}
              />
            </div>

            {/* Limit Entities (Testing) */}
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="limitEntities">
                    Limit Entities (Testing)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Process only a subset for testing purposes
                  </p>
                </div>
                <Switch
                  id="limitEntities"
                  checked={config.limitEntities}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, limitEntities: checked })
                  }
                  disabled={isLoading}
                />
              </div>

              {config.limitEntities && (
                <div className="space-y-2">
                  <Label htmlFor="entityLimit">Number of Entities</Label>
                  <Input
                    id="entityLimit"
                    type="number"
                    min={1}
                    max={100}
                    value={config.entityLimit}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        entityLimit: parseInt(e.target.value) || 10,
                      })
                    }
                    disabled={isLoading}
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Specific Entity ID (Testing Single Listing) */}
            <div className="space-y-4 p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30">
              <div className="space-y-0.5">
                <Label
                  htmlFor="specificEntityId"
                  className="text-blue-700 dark:text-blue-400"
                >
                  Specific Entity ID (Quick Test)
                </Label>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  Scrape a single listing by Peekaboo entity ID (e.g., 192 for
                  &quot;1st Step Shoes & Bags&quot;)
                </p>
              </div>
              <Input
                id="specificEntityId"
                type="number"
                placeholder="Enter entity ID (e.g., 192)"
                value={config.specificEntityId}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    specificEntityId: e.target.value,
                  })
                }
                disabled={isLoading}
                className="max-w-xs"
              />
              {config.specificEntityId && (
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  ✓ Will only scrape entity ID {config.specificEntityId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Warnings */}
      {config.syncMode === "report" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Report mode scrapes and compares only — no database writes. Use this
            to see what is missing or would change before Create missing / Full /
            Deals.
          </AlertDescription>
        </Alert>
      )}

      {config.syncMode === "create_missing" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Create missing will insert new <strong>draft</strong> listings for
            Peekaboo venues not already in Inside. Existing listings are left
            untouched. Categories are assigned from existing tags only — no new
            category rows.
          </AlertDescription>
        </Alert>
      )}

      {config.syncMode === "full" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Full sync will update listing metadata from Peekaboo (name, address,
            contacts, etc.). Categories, status (when auto-publish is off),
            featured flags, and price/capacity fields are preserved — but prefer
            Report or Deals only unless you intentionally need a metadata
            refresh.
          </AlertDescription>
        </Alert>
      )}

      {config.autoPublish && config.syncMode === "full" && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Auto-publish is enabled. All synced listings will be immediately
            visible on the website. Review carefully before running.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <CardTitle>Worker Automation</CardTitle>
          </div>
          <CardDescription>
            Control external worker automation for long-term sync operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="workerAutomationEnabled">Enable Automation</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, worker can trigger syncs on interval mode.
              </p>
            </div>
            <Switch
              id="workerAutomationEnabled"
              checked={workerConfig.enabled}
              onCheckedChange={(checked) =>
                setWorkerConfig((prev) => ({ ...prev, enabled: checked }))
              }
              disabled={isSavingWorkerConfig}
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="workerMode" className="block leading-none">
              Mode
            </Label>
            <select
              id="workerMode"
              value={workerConfig.mode}
              onChange={(e) =>
                setWorkerConfig((prev) => ({
                  ...prev,
                  mode: e.target.value as "manual" | "interval",
                }))
              }
              className="mt-1 h-10 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
              disabled={isSavingWorkerConfig}
            >
              <option value="manual">Manual</option>
              <option value="interval">Interval</option>
            </select>
          </div>

          {workerConfig.mode === "interval" && (
            <div className="space-y-2">
              <Label htmlFor="intervalMinutes">Interval (minutes)</Label>
              <Input
                id="intervalMinutes"
                type="number"
                min={15}
                max={1440}
                value={workerConfig.intervalMinutes}
                onChange={(e) =>
                  setWorkerConfig((prev) => ({
                    ...prev,
                    intervalMinutes: Math.max(15, Math.min(1440, parseInt(e.target.value) || 1440)),
                  }))
                }
                disabled={isSavingWorkerConfig}
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 1440 for daily or 15 for near real-time checks.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label htmlFor="workerDefaultConcurrent">Default Concurrency</Label>
              <Input
                id="workerDefaultConcurrent"
                type="number"
                min={1}
                max={10}
                value={workerConfig.syncDefaults.maxConcurrent}
                onChange={(e) =>
                  setWorkerConfig((prev) => ({
                    ...prev,
                    syncDefaults: {
                      ...prev.syncDefaults,
                      maxConcurrent: Math.max(1, Math.min(10, parseInt(e.target.value) || 5)),
                    },
                  }))
                }
                disabled={isSavingWorkerConfig}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workerDefaultSyncMode">Default Sync Mode</Label>
              <Select
                value={workerConfig.syncDefaults.syncMode}
                onValueChange={(
                  value: "report" | "create_missing" | "full" | "deals_only",
                ) =>
                  setWorkerConfig((prev) => ({
                    ...prev,
                    syncDefaults: { ...prev.syncDefaults, syncMode: value },
                  }))
                }
                disabled={isSavingWorkerConfig}
              >
                <SelectTrigger id="workerDefaultSyncMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="report">Report only</SelectItem>
                  <SelectItem value="create_missing">Create missing</SelectItem>
                  <SelectItem value="deals_only">Deals only</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Interval automation defaults to Report only. Change only if you
                intentionally want auto writes.
              </p>
            </div>
            <div className="flex items-end">
              <div className="flex items-center justify-between w-full rounded-md border px-3 py-2">
                <Label htmlFor="workerDefaultPublish" className="text-sm">Auto Publish</Label>
                <Switch
                  id="workerDefaultPublish"
                  checked={workerConfig.syncDefaults.autoPublish}
                  onCheckedChange={(checked) =>
                    setWorkerConfig((prev) => ({
                      ...prev,
                      syncDefaults: { ...prev.syncDefaults, autoPublish: checked },
                    }))
                  }
                  disabled={isSavingWorkerConfig}
                />
              </div>
            </div>
            <div className="flex items-end">
              <div className="flex items-center justify-between w-full rounded-md border px-3 py-2">
                <Label htmlFor="workerDefaultPreserve" className="text-sm">Preserve Edits</Label>
                <Switch
                  id="workerDefaultPreserve"
                  checked={workerConfig.syncDefaults.preserveManualEdits}
                  onCheckedChange={(checked) =>
                    setWorkerConfig((prev) => ({
                      ...prev,
                      syncDefaults: {
                        ...prev.syncDefaults,
                        preserveManualEdits: checked,
                      },
                    }))
                  }
                  disabled={isSavingWorkerConfig}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="canaryEnabled">Canary Gate</Label>
                <p className="text-xs text-muted-foreground">
                  Run a small pre-check sync before full interval run and block when error rate is too high.
                </p>
              </div>
              <Switch
                id="canaryEnabled"
                checked={workerConfig.canary.enabled}
                onCheckedChange={(checked) =>
                  setWorkerConfig((prev) => ({
                    ...prev,
                    canary: { ...prev.canary, enabled: checked },
                  }))
                }
                disabled={isSavingWorkerConfig}
              />
            </div>

            {workerConfig.canary.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="canaryEntityLimit">Canary Entity Limit</Label>
                  <Input
                    id="canaryEntityLimit"
                    type="number"
                    min={3}
                    max={100}
                    value={workerConfig.canary.entityLimit}
                    onChange={(e) =>
                      setWorkerConfig((prev) => ({
                        ...prev,
                        canary: {
                          ...prev.canary,
                          entityLimit: Math.max(
                            3,
                            Math.min(100, parseInt(e.target.value) || 10),
                          ),
                        },
                      }))
                    }
                    disabled={isSavingWorkerConfig}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="canaryMaxErrorRate">Max Error Rate %</Label>
                  <Input
                    id="canaryMaxErrorRate"
                    type="number"
                    min={1}
                    max={100}
                    value={workerConfig.canary.maxErrorRatePercent}
                    onChange={(e) =>
                      setWorkerConfig((prev) => ({
                        ...prev,
                        canary: {
                          ...prev.canary,
                          maxErrorRatePercent: Math.max(
                            1,
                            Math.min(100, parseInt(e.target.value) || 40),
                          ),
                        },
                      }))
                    }
                    disabled={isSavingWorkerConfig}
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSaveWorkerConfig}
            disabled={isSavingWorkerConfig}
            variant="secondary"
            className="gap-2"
          >
            {isSavingWorkerConfig ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Worker Config
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-amber-500/40">
        <CardHeader>
          <CardTitle className="text-amber-700 dark:text-amber-400">
            Dev State Reset
          </CardTitle>
          <CardDescription>
            Clears local scraper Redis state (processed IDs, active lock, cached report/config).
            Development only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleResetDevState}
            disabled={isResettingState || isLoading || isCheckingWorker}
            variant="destructive"
            className="gap-2"
          >
            {isResettingState ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                Reset Dev Scraper State
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Start Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap gap-3"
      >
        <Button
          onClick={handleStartSync}
          disabled={isLoading || isCheckingWorker}
          className="w-full sm:w-auto gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Sync
            </>
          )}
        </Button>

        <Button
          onClick={handleCheckWorkerHealth}
          disabled={isLoading || isCheckingWorker}
          variant="outline"
          className="w-full sm:w-auto gap-2"
        >
          {isCheckingWorker ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking Worker...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4" />
              Test Worker Connection
            </>
          )}
        </Button>
      </motion.div>

      {/* Info Footer */}
      <div className="text-sm text-muted-foreground space-y-1 p-4 rounded-lg border bg-muted/20">
        <p className="font-medium">What happens during sync:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Authenticate with Peekaboo.guru API</li>
          <li>Fetch all entity IDs from the restaurant directory</li>
          <li>Process listings with branches and images</li>
          <li>Sync to database with conflict detection</li>
          <li>Generate comprehensive report with statistics</li>
        </ul>
      </div>
    </div>
  );
}
