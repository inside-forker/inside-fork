"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { OpeningHoursEditor } from "../../listing/OpeningHoursEditor";
import { OpeningHour, BranchWithHours } from "@/types/listing.types";
import { MapPin, Store, RefreshCw, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type BrandGroupSummary = {
  id: number;
  name: string;
  slug: string;
  members: Array<{
    listing_id: number;
    name: string;
    slug: string;
    status: string;
    sort_order: number;
  }>;
};

interface HoursTabProps {
  listingId?: number | null;
  openingHours: OpeningHour[];
  onChange: (hours: OpeningHour[]) => void;
  isLoading: boolean;
  branches?: BranchWithHours[];
  syncToAllBranches?: boolean;
  onSyncToAllBranchesChange?: (sync: boolean) => void;
}

export function HoursTab({
  listingId,
  openingHours,
  onChange,
  isLoading,
  branches,
  syncToAllBranches = false,
  onSyncToAllBranchesChange,
}: HoursTabProps) {
  const { toast } = useToast();
  const [brandGroup, setBrandGroup] = React.useState<BrandGroupSummary | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncToAll, setSyncToAll] = React.useState(syncToAllBranches);

  // Keep internal state in sync with prop
  React.useEffect(() => {
    setSyncToAll(syncToAllBranches);
  }, [syncToAllBranches]);

  // Fetch brand group if listingId is provided
  React.useEffect(() => {
    if (!listingId) {
      setBrandGroup(null);
      return;
    }
    let isMounted = true;
    fetch(`/api/admin/listings/${listingId}/brand-group`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (isMounted && data?.group) {
          setBrandGroup(data.group);
        }
      })
      .catch((err) => console.error("Error loading brand group in HoursTab:", err));

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  const siblingMembers = React.useMemo(() => {
    if (!brandGroup?.members || !listingId) return [];
    return brandGroup.members.filter((m) => m.listing_id !== listingId);
  }, [brandGroup, listingId]);

  const hasMultipleLocations = siblingMembers.length > 0 || (branches?.length ?? 0) > 1;
  const totalBranchesCount = siblingMembers.length > 0
    ? brandGroup?.members.length ?? 0
    : branches?.length ?? 0;

  const primaryBranch = branches?.find((b) => b.is_primary);

  const handleSyncToggle = (checked: boolean) => {
    setSyncToAll(checked);
    onSyncToAllBranchesChange?.(checked);
  };

  const handleSyncNow = async () => {
    if (!listingId) return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}/opening-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opening_hours: openingHours,
          sync_to_brand_group: true,
          sync_to_branches: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync opening hours");
      }

      toast({
        title: "Timings Synced",
        description: data.total_synced > 0
          ? `Opening hours successfully synced to ${data.total_synced} branch(es)!`
          : "Opening hours successfully synced to all branches!",
      });
    } catch (err) {
      console.error("Sync error:", err);
      toast({
        title: "Sync Failed",
        description: err instanceof Error ? err.message : "Failed to sync opening hours",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <TabsContent value="hours" className="space-y-6">
      {hasMultipleLocations && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {brandGroup?.name ? `${brandGroup.name} Branches` : "Multiple Branches"}
                </span>
                <Badge variant="outline" className="text-xs bg-background">
                  {totalBranchesCount} branches
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {syncToAll
                  ? `Sync enabled: Saving this listing will update timings across all ${totalBranchesCount} branches.`
                  : "Custom timings: This branch has independent timings. Different branches can open or close at different times."}
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
              <div className="flex items-center space-x-2 bg-background/80 px-3 py-1.5 rounded-lg border border-border/50">
                <Switch
                  id="sync-hours-to-all"
                  checked={syncToAll}
                  onCheckedChange={handleSyncToggle}
                />
                <Label htmlFor="sync-hours-to-all" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                  Sync to all branches
                </Label>
              </div>

              {listingId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSyncing || isLoading}
                  onClick={handleSyncNow}
                  className="text-xs h-8 whitespace-nowrap"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      Sync now
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="py-2">
        <OpeningHoursEditor
          value={openingHours}
          onChange={onChange}
          disabled={isLoading}
          customAction={
            primaryBranch && (
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1 rounded-full text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                <span>Branch: {primaryBranch.name}</span>
              </div>
            )
          }
          description={
            syncToAll ? (
              <p className="text-xs text-primary font-medium">
                Changes will be synced to all {totalBranchesCount} branches upon saving.
              </p>
            ) : undefined
          }
        />
      </div>
    </TabsContent>
  );
}
