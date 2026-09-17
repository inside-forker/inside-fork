"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Flame,
  Users,
  Search,
  Building2,
  Ticket,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaDetailDrawer } from "./AreaDetailDrawer";
import type {
  LocationIntelligencePayload,
  HeatmapFilterType,
  NeighborhoodCluster,
} from "@/lib/analytics/mobile-location";
import type { DateRangeFilter } from "@/lib/analytics/mobile-events";

// Dynamically load Map Canvas with SSR disabled
const LocationMapCanvas = dynamic(() => import("./LocationMapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[620px] rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center space-y-3">
      <div className="w-9 h-9 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-400 text-xs font-medium">Initializing Karachi Map Canvas...</p>
    </div>
  ),
});

interface LocationHeatmapTabProps {
  dateRange: DateRangeFilter;
}

export function LocationHeatmapTab({ dateRange }: LocationHeatmapTabProps) {
  const [data, setData] = useState<LocationIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<HeatmapFilterType>("all");
  const [intensityMultiplier, setIntensityMultiplier] = useState(1.0);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const fetchLocationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/mobile-events/location?range=${dateRange}&filter=${filterType}`
      );
      if (!res.ok) throw new Error("Failed to load location intelligence");
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching map data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationData();
  }, [dateRange, filterType]);

  const handleSelectArea = (neighborhood: string) => {
    setSelectedArea(neighborhood);
    setIsDrawerOpen(true);
  };

  const selectedCluster = useMemo(() => {
    if (!data || !selectedArea) return null;
    return data.clusters.find((c) => c.name === selectedArea) || null;
  }, [data, selectedArea]);

  return (
    <div className="space-y-6">
      {/* 1. Header Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Geo Pings */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Geo-Located Pings
              </CardDescription>
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground mt-1">
              {data?.summary.totalGeoEvents.toLocaleString() ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground">
              Across {data?.summary.activeHotspotsCount ?? 0} active Karachi clusters
            </div>
          </CardContent>
        </Card>

        {/* Tracked Users */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Tracked Actors
              </CardDescription>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {data?.summary.trackedActors ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>{data?.summary.signedInActors ?? 0} signed-in</span>
              <span>•</span>
              <span>{data?.summary.anonActors ?? 0} anonymous</span>
            </div>
          </CardContent>
        </Card>

        {/* Hottest Zone */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Hottest Zone
              </CardDescription>
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <CardTitle className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
              {data?.summary.hottestNeighborhood ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground">
              {data?.summary.hottestNeighborhoodEvents ?? 0} activity pings recorded
            </div>
          </CardContent>
        </Card>

        {/* Top Local Search */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Top Local Search
              </CardDescription>
              <Search className="w-4 h-4 text-amber-500" />
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-1 truncate">
              &ldquo;{data?.summary.topLocalSearch ?? "—"}&rdquo;
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground">Dominant query in mobile app</div>
          </CardContent>
        </Card>

        {/* Top Visited Listing */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs uppercase font-semibold text-muted-foreground">
                Top Visited Spot
              </CardDescription>
              <Building2 className="w-4 h-4 text-cyan-500" />
            </div>
            <CardTitle className="text-base font-bold text-foreground mt-1 truncate">
              {data?.summary.topLocalListing ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-[11px] text-muted-foreground">Most viewed venue on map</div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Controls & Layer Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-card border border-border rounded-xl shadow-sm">
        {/* Layer Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mr-1">
            Layer:
          </span>
          <Tabs
            value={filterType}
            onValueChange={(v) => setFilterType(v as HeatmapFilterType)}
            className="w-auto"
          >
            <TabsList className="bg-muted p-0.5 h-8">
              <TabsTrigger value="all" className="text-xs px-2.5 h-7">
                All Activity
              </TabsTrigger>
              <TabsTrigger value="searches" className="text-xs px-2.5 h-7 gap-1">
                <Search className="w-3 h-3" /> Searches
              </TabsTrigger>
              <TabsTrigger value="screens" className="text-xs px-2.5 h-7 gap-1">
                <Zap className="w-3 h-3" /> Screens
              </TabsTrigger>
              <TabsTrigger value="deals" className="text-xs px-2.5 h-7 gap-1">
                <Ticket className="w-3 h-3" /> Deals
              </TabsTrigger>
              <TabsTrigger value="listings" className="text-xs px-2.5 h-7 gap-1">
                <Building2 className="w-3 h-3" /> Listings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Heatmap Radiance Intensity & Refresh */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="flex items-center gap-1.5 bg-muted/60 border border-border px-2.5 py-1 rounded-lg">
            <span className="text-[11px] text-muted-foreground font-medium">Radiance:</span>
            <Button
              size="sm"
              variant={intensityMultiplier === 0.7 ? "secondary" : "ghost"}
              onClick={() => setIntensityMultiplier(0.7)}
              className="h-6 px-1.5 text-[10px]"
            >
              Soft
            </Button>
            <Button
              size="sm"
              variant={intensityMultiplier === 1.0 ? "secondary" : "ghost"}
              onClick={() => setIntensityMultiplier(1.0)}
              className="h-6 px-1.5 text-[10px]"
            >
              Standard
            </Button>
            <Button
              size="sm"
              variant={intensityMultiplier === 1.5 ? "secondary" : "ghost"}
              onClick={() => setIntensityMultiplier(1.5)}
              className="h-6 px-1.5 text-[10px] text-rose-500 font-bold"
            >
              Blazing 🔥
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchLocationData}
            disabled={loading}
            className="h-8 text-xs border-border"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 3. Main Heatmap Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Map Canvas (8 Cols) */}
        <div className="lg:col-span-8 space-y-2">
          <LocationMapCanvas
            clusters={data?.clusters || []}
            heatmapPoints={data?.heatmapPoints || []}
            selectedArea={selectedArea}
            onSelectArea={handleSelectArea}
            intensityMultiplier={intensityMultiplier}
            showHotspotBadges={true}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>💡 Tip: Click on any glowing hotspot or neighborhood badge to inspect accumulated data.</span>
            <span>CartoDB Dark Tiles • OpenStreetMap Karachi</span>
          </div>
        </div>

        {/* Right: Karachi Hotspot Leaderboard (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-card border-border shadow-md flex flex-col h-[620px]">
            <CardHeader className="p-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  Karachi Hotspot Rankings
                </CardTitle>
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                  {data?.clusters.length || 0} Areas
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Ranked by real-time density & user footfall
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2">
              {data?.clusters && data.clusters.length > 0 ? (
                data.clusters.map((cluster, idx) => {
                  const isBlazing = cluster.intensityLevel === "blazing";
                  const isHot = cluster.intensityLevel === "hot";

                  return (
                    <div
                      key={cluster.id}
                      onClick={() => handleSelectArea(cluster.name)}
                      className={`group p-3 rounded-xl border transition-all cursor-pointer ${
                        selectedArea === cluster.name
                          ? "bg-primary/10 border-primary/50 shadow-sm"
                          : "bg-muted/40 hover:bg-muted/80 border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                              {cluster.name}
                              {isBlazing && <span className="text-xs">🔥</span>}
                            </span>
                          </div>

                          {/* Top Search Tag Preview */}
                          {cluster.topSearches[0] && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Search className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <span className="truncate">
                                &ldquo;{cluster.topSearches[0].query}&rdquo;
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-semibold ${
                              isBlazing
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                : isHot
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                            }`}
                          >
                            {cluster.uniqueUsers} Users
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {cluster.totalEvents} pings
                          </div>
                        </div>
                      </div>

                      {/* Action trigger footer */}
                      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground group-hover:text-foreground">
                        <span className="text-muted-foreground">Inspect queries & places</span>
                        <span className="flex items-center gap-0.5 text-primary text-xs font-medium">
                          Drilldown <ArrowRight className="w-3 h-3 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 text-muted-foreground text-xs">
                  No Karachi location clusters recorded in this range.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Area Intelligence Drill-Down Drawer */}
      <AreaDetailDrawer
        neighborhood={selectedArea}
        clusterData={selectedCluster}
        dateRange={dateRange}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
