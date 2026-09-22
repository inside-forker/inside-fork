"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  Download,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SyncRecord {
  id: string;
  startTime: string;
  endTime: string;
  entitiesProcessed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  errors: number;
  status: "running" | "stopping" | "completed" | "failed" | "partial" | "cancelled";
  staleRunning?: boolean;
  staleMessage?: string | null;
  discoverySummary?: string | null;
  warningMessage?: string | null;
  syncMode?: string | null;
  reportSummary?: {
    missingInInside: number | null;
    existingWouldUpdate: number | null;
    existingUnchanged: number | null;
    dealsWouldCreate: number | null;
    dealsWouldUpdate: number | null;
    skippedConflicts: number | null;
  } | null;
}

interface SyncError {
  peekabooId: number;
  error: string;
  stack?: string;
  occurredAt?: string;
}

export function SyncHistory() {
  const [syncHistory, setSyncHistory] = React.useState<SyncRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedErrors, setSelectedErrors] = React.useState<
    SyncError[] | null
  >(null);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = React.useState(false);
  const [isLoadingErrors, setIsLoadingErrors] = React.useState(false);
  const [selectedErrorMessage, setSelectedErrorMessage] = React.useState<string | null>(
    null,
  );
  const [stoppingSyncId, setStoppingSyncId] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/admin/listing-scraper/history");
      const data = await response.json();

      if (data.history) {
        setSyncHistory(data.history);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (recordId: string) => {
    try {
      const response = await fetch(
        `/api/admin/listing-scraper/report/${recordId}`
      );
      const data = await response.json();

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sync-report-${recordId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download report:", error);
    }
  };

  const handleViewErrors = async (recordId: string) => {
    try {
      setIsLoadingErrors(true);
      setIsErrorDialogOpen(true);
      const response = await fetch(
        `/api/admin/listing-scraper/report/${recordId}`
      );
      const data = await response.json();

      if (data?.report?.errors && Array.isArray(data.report.errors)) {
        setSelectedErrors(data.report.errors);
        setSelectedErrorMessage(null);
      } else if (Array.isArray(data?.liveErrors) && data.liveErrors.length > 0) {
        setSelectedErrors(data.liveErrors as SyncError[]);
        setSelectedErrorMessage(
          "Live error feed from in-progress sync. A full error report will be available after completion.",
        );
      } else {
        setSelectedErrors([]);
        setSelectedErrorMessage(
          data?.status === "running" || data?.status === "stopping"
            ? "Errors are still being collected. Detailed report will be available once this sync run completes."
            : null,
        );
      }
    } catch (error) {
      console.error("Failed to fetch report errors:", error);
      setSelectedErrors([]);
      setSelectedErrorMessage("Unable to load errors for this sync report.");
    } finally {
      setIsLoadingErrors(false);
    }
  };

  const handleStopSync = async (recordId: string) => {
    try {
      setStoppingSyncId(recordId);
      const response = await fetch("/api/admin/listing-scraper/stop", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to request stop");
      }
      await fetchHistory();
    } catch (error) {
      console.error("Failed to stop sync:", error);
    } finally {
      setStoppingSyncId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (syncHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>
            No sync operations have been performed yet
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-sm text-muted-foreground text-center mb-4">
            Start your first sync to see history here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>
              View past sync operations and download detailed reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-center">Processed</TableHead>
                  <TableHead className="text-center">Created</TableHead>
                  <TableHead className="text-center">Updated</TableHead>
                  <TableHead className="text-center">Errors</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory.map((record) => {
                  const duration =
                    new Date(record.endTime).getTime() -
                    new Date(record.startTime).getTime();
                  const durationMinutes = Math.floor(duration / 60000);
                  const durationSeconds = Math.floor((duration % 60000) / 1000);

                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {new Date(record.startTime).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {durationMinutes}m {durationSeconds}s
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <div>{record.entitiesProcessed}</div>
                          {record.syncMode && (
                            <div className="text-[10px] text-muted-foreground">
                              mode: {record.syncMode}
                            </div>
                          )}
                          {record.discoverySummary && (
                            <div className="text-[10px] text-muted-foreground">
                              {record.discoverySummary}
                            </div>
                          )}
                          {record.reportSummary &&
                            (record.reportSummary.missingInInside != null ||
                              record.reportSummary.existingWouldUpdate !=
                                null) && (
                              <div className="text-[10px] text-muted-foreground space-y-0.5">
                                {record.reportSummary.missingInInside !=
                                  null && (
                                  <div>
                                    missing:{" "}
                                    {record.reportSummary.missingInInside}
                                  </div>
                                )}
                                {record.reportSummary.existingWouldUpdate !=
                                  null && (
                                  <div>
                                    would update:{" "}
                                    {
                                      record.reportSummary
                                        .existingWouldUpdate
                                    }
                                  </div>
                                )}
                                {record.reportSummary.existingUnchanged !=
                                  null && (
                                  <div>
                                    unchanged:{" "}
                                    {record.reportSummary.existingUnchanged}
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {record.entitiesCreated}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {record.entitiesUpdated}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "font-medium",
                            record.errors > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {record.errors}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <Badge
                            variant={
                              record.status === "completed"
                                ? "default"
                                : record.status === "failed"
                                ? "destructive"
                                : record.status === "cancelled"
                                  ? "outline"
                                : "secondary"
                            }
                            className="gap-1"
                          >
                            {record.status === "completed" ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : record.status === "failed" ? (
                              <XCircle className="h-3 w-3" />
                            ) : record.status === "cancelled" ? (
                              <Clock className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {record.status}
                          </Badge>

                          {record.staleRunning && record.staleMessage && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              {record.staleMessage}
                            </div>
                          )}

                          {record.warningMessage && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              {record.warningMessage}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(record.status === "running" || record.status === "stopping") && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStopSync(record.id)}
                              disabled={
                                stoppingSyncId === record.id || record.status === "stopping"
                              }
                            >
                              {record.status === "stopping" || stoppingSyncId === record.id
                                ? "Stopping..."
                                : "Stop"}
                            </Button>
                          )}
                          {record.errors > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => handleViewErrors(record.id)}
                            >
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Errors
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReport(record.id)}
                            title="Download Full Report (JSON)"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Sync Errors</DialogTitle>
            <DialogDescription>
              Errors encountered during the sync process.
            </DialogDescription>
          </DialogHeader>

          {isLoadingErrors ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-8 w-8 text-muted-foreground animate-pulse" />
            </div>
          ) : selectedErrors && selectedErrors.length > 0 ? (
            <ScrollArea className="flex-1 pr-4">
              {selectedErrorMessage && (
                <div className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                  {selectedErrorMessage}
                </div>
              )}
              <div className="space-y-4">
                {selectedErrors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Entity ID: {error.peekabooId}</AlertTitle>
                    <AlertDescription className="mt-2 font-mono text-xs whitespace-pre-wrap">
                      {error.error}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mb-2 text-green-500" />
              <p>{selectedErrorMessage || "No errors found in this report."}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
