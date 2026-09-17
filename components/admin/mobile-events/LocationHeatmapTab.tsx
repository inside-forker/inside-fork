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
  Navigation,
  ChevronLeft,
  X,
  Smartphone,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AreaDetailDrawer } from "./AreaDetailDrawer";
import type {
  LocationIntelligencePayload,
  HeatmapFilterType,
  NeighborhoodCluster,
  PinnedUserTarget,
  TrackedUserSummary,
  UserPingHistoryItem,
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

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

export function LocationHeatmapTab({ dateRange }: LocationHeatmapTabProps) {
  const [data, setData] = useState<LocationIntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<HeatmapFilterType>("all");
  const [intensityMultiplier, setIntensityMultiplier] = useState(1.0);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [pinnedUser, setPinnedUser] = useState<PinnedUserTarget | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // User Tracker Mode State
  const [sidebarMode, setSidebarMode] = useState<"hotspots" | "tracker">("hotspots");
  const [trackedUsers, setTrackedUsers] = useState<TrackedUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedTrackedUser, setSelectedTrackedUser] = useState<TrackedUserSummary | null>(null);
  const [userPings, setUserPings] = useState<UserPingHistoryItem[]>([]);
  const [loadingPings, setLoadingPings] = useState(false);
  const [focusedPing, setFocusedPing] = useState<UserPingHistoryItem | null>(null);

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

  const fetchTrackedUsers = async (query = "") => {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `/api/admin/mobile-events/location/users?range=${dateRange}&q=${encodeURIComponent(query)}`
      );
      if (!res.ok) throw new Error("Failed to load tracked users");
      const json = await res.json();
      setTrackedUsers(json.data.users || []);
    } catch (err) {
      console.error("Error loading tracked users", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSelectTrackedUser = async (user: TrackedUserSummary) => {
    setSelectedTrackedUser(user);
    setPinnedUser(null);
    setIsDrawerOpen(false);
    setLoadingPings(true);
    try {
      const res = await fetch(
        `/api/admin/mobile-events/location/user-pings?actorId=${encodeURIComponent(
          user.actorId
        )}&isUserId=${user.isUserId}&range=${dateRange}`
      );
      if (!res.ok) throw new Error("Failed to load user pings");
      const json = await res.json();
      setUserPings(json.data.pings || []);
    } catch (err) {
      console.error("Error loading user pings", err);
    } finally {
      setLoadingPings(false);
    }
  };

  const handleClearTrackedUser = () => {
    setSelectedTrackedUser(null);
    setUserPings([]);
    setFocusedPing(null);
  };

  useEffect(() => {
    fetchLocationData();
    if (sidebarMode === "tracker") {
      fetchTrackedUsers(userSearchQuery);
    }
  }, [dateRange, filterType]);

  useEffect(() => {
    if (sidebarMode === "tracker") {
      const timer = setTimeout(() => {
        fetchTrackedUsers(userSearchQuery);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [userSearchQuery, sidebarMode, dateRange]);

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
            pinnedUser={pinnedUser}
            onClearPinnedUser={() => setPinnedUser(null)}
            trackedUser={selectedTrackedUser}
            userPings={userPings}
            focusedPing={focusedPing}
            onClearTrackedUser={handleClearTrackedUser}
            onSelectPing={(ping) => setFocusedPing(ping)}
            intensityMultiplier={intensityMultiplier}
            showHotspotBadges={sidebarMode === "hotspots" && !selectedTrackedUser}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>
              {selectedTrackedUser
                ? `🧭 Tracking ${selectedTrackedUser.fullName || selectedTrackedUser.username || "User"} (${userPings.length} sequential GPS pings plotted on map)`
                : "💡 Tip: Click on any glowing hotspot or switch to User Tracker Mode to inspect user GPS ping locations."}
            </span>
            <span>Esri Dark Canvas • OpenStreetMap Karachi</span>
          </div>
        </div>

        {/* Right: Karachi Hotspot Leaderboard & User Tracker Mode (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-card border-border shadow-md flex flex-col h-[620px]">
            {/* Sidebar Mode Switcher Header */}
            <CardHeader className="p-3 pb-2 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <Tabs
                  value={sidebarMode}
                  onValueChange={(v) => {
                    const mode = v as "hotspots" | "tracker";
                    setSidebarMode(mode);
                    if (mode === "tracker" && trackedUsers.length === 0) {
                      fetchTrackedUsers(userSearchQuery);
                    }
                  }}
                  className="w-full"
                >
                  <TabsList className="grid grid-cols-2 bg-muted p-0.5 h-8">
                    <TabsTrigger value="hotspots" className="text-xs px-2 h-7 gap-1 font-semibold">
                      <Flame className="w-3.5 h-3.5 text-rose-500" /> Hotspots
                    </TabsTrigger>
                    <TabsTrigger value="tracker" className="text-xs px-2 h-7 gap-1 font-semibold">
                      <Navigation className="w-3.5 h-3.5 text-sky-500" /> User Tracker
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Secondary Subtitle */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {sidebarMode === "hotspots"
                    ? "Ranked by real-time density"
                    : selectedTrackedUser
                    ? "Trip Journey Timeline"
                    : "Track users across Karachi"}
                </span>
                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                  {sidebarMode === "hotspots"
                    ? `${data?.clusters.length || 0} Areas`
                    : `${trackedUsers.length} Users`}
                </Badge>
              </div>
            </CardHeader>

            {/* Sidebar Content Area */}
            <CardContent className="p-3 flex-1 overflow-y-auto space-y-2">
              {sidebarMode === "hotspots" ? (
                /* Hotspot Rankings List */
                data?.clusters && data.clusters.length > 0 ? (
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
                )
              ) : (
                /* User Tracker Mode */
                <div className="space-y-3">
                  {/* Search Bar when viewing user list */}
                  {!selectedTrackedUser && (
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search user, @username, or area..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="h-8 pl-8 pr-8 text-xs bg-muted/50 border-border"
                      />
                      {userSearchQuery && (
                        <button
                          onClick={() => setUserSearchQuery("")}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* If a User is Selected: Show Detailed Travel Path & Steps */}
                  {selectedTrackedUser ? (
                    <div className="space-y-3">
                      {/* User Hero Header */}
                      <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleClearTrackedUser}
                            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" /> Back to Users
                          </Button>
                          <Badge className="bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 text-[10px]">
                            Live Path
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-10 h-10 border border-border bg-muted">
                            <AvatarImage src={selectedTrackedUser.avatarUrl || undefined} />
                            <AvatarFallback className="text-xs bg-sky-500/20 text-sky-500 font-bold">
                              {selectedTrackedUser.fullName
                                ? selectedTrackedUser.fullName[0].toUpperCase()
                                : selectedTrackedUser.username
                                ? selectedTrackedUser.username[0].toUpperCase()
                                : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-0.5 overflow-hidden">
                            <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                              <span>
                                {selectedTrackedUser.fullName ||
                                  (selectedTrackedUser.username
                                    ? `@${selectedTrackedUser.username}`
                                    : "Anonymous Device")}
                              </span>
                              {selectedTrackedUser.isUserId && (
                                <Badge className="bg-primary/20 text-primary text-[9px] px-1 py-0 border border-primary/30">
                                  Signed In
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              {selectedTrackedUser.platform && (
                                <span className="flex items-center gap-0.5">
                                  <Smartphone className="w-3 h-3" />
                                  {selectedTrackedUser.platform.toUpperCase()}
                                </span>
                              )}
                              <span>•</span>
                              <span>{selectedTrackedUser.totalPings} total pings</span>
                            </div>
                          </div>
                        </div>

                        {/* Neighborhoods Visited Chips */}
                        {selectedTrackedUser.neighborhoodsVisited.length > 0 && (
                          <div className="pt-2 border-t border-border/60">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
                              Areas Traversed ({selectedTrackedUser.neighborhoodsVisited.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {selectedTrackedUser.neighborhoodsVisited.map((n) => (
                                <Badge
                                  key={n}
                                  variant="outline"
                                  className="text-[10px] bg-background border-border text-foreground px-1.5 py-0"
                                >
                                  {n}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Journey Step-by-Step Timeline */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground px-1">
                          <span className="flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5 text-sky-500" />
                            GPS Pings Path ({userPings.length})
                          </span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            Click to focus on map
                          </span>
                        </div>

                        {loadingPings ? (
                          <div className="flex flex-col items-center justify-center py-12 space-y-2">
                            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-muted-foreground">Plotting path on map...</span>
                          </div>
                        ) : userPings.length > 0 ? (
                          <div className="space-y-1.5 max-h-[310px] overflow-y-auto pr-1">
                            {userPings.map((ping, idx) => {
                              const isLatest = idx === userPings.length - 1;
                              const isFocused = focusedPing?.id === ping.id;

                              return (
                                <div
                                  key={ping.id || idx}
                                  onClick={() => setFocusedPing(ping)}
                                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 ${
                                    isFocused
                                      ? "bg-sky-500/15 border-sky-500 shadow-sm"
                                      : "bg-muted/40 hover:bg-muted/80 border-border"
                                  }`}
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 ${
                                      isLatest
                                        ? "bg-rose-500 text-white shadow-sm"
                                        : "bg-sky-600 text-white"
                                    }`}
                                  >
                                    {idx + 1}
                                  </div>

                                  <div className="space-y-0.5 overflow-hidden flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="text-xs font-bold text-foreground truncate">
                                        {ping.neighborhood || "Karachi"}
                                        {isLatest && <span className="text-[10px] text-rose-500 ml-1 font-semibold">(Latest)</span>}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {formatRelativeTime(ping.occurredAt)}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                      {ping.screen ? `Screen: ${ping.screen}` : `Event: ${ping.eventName}`}
                                    </div>
                                    <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                                      {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                            No location pings found for this user in selected range.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* User Roster List */
                    loadingUsers ? (
                      <div className="flex flex-col items-center justify-center py-16 space-y-2">
                        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">Loading tracked users...</span>
                      </div>
                    ) : trackedUsers.length > 0 ? (
                      <div className="space-y-2 max-h-[490px] overflow-y-auto pr-1">
                        {trackedUsers.map((u) => (
                          <div
                            key={u.actorId}
                            onClick={() => handleSelectTrackedUser(u)}
                            className="p-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted/80 hover:border-sky-500/50 transition-all cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <Avatar className="w-8 h-8 border border-border bg-muted flex-shrink-0">
                                  <AvatarImage src={u.avatarUrl || undefined} />
                                  <AvatarFallback className="text-[11px] bg-primary/20 text-primary font-bold">
                                    {u.fullName
                                      ? u.fullName[0].toUpperCase()
                                      : u.username
                                      ? u.username[0].toUpperCase()
                                      : "U"}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="space-y-0.5 overflow-hidden">
                                  <div className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                                    <span>{u.fullName || (u.username ? `@${u.username}` : "Anonymous Device")}</span>
                                    {u.isUserId && (
                                      <Badge className="bg-primary/20 text-primary text-[8px] px-1 py-0 border border-primary/30">
                                        Signed In
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    {u.platform && (
                                      <span className="flex items-center gap-0.5">
                                        <Smartphone className="w-2.5 h-2.5" />
                                        {u.platform.toUpperCase()}
                                      </span>
                                    )}
                                    <span>•</span>
                                    <span>{formatRelativeTime(u.lastSeen)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                >
                                  {u.totalPings} pings
                                </Badge>
                              </div>
                            </div>

                            {/* Neighborhood tag footer */}
                            {u.neighborhoodsVisited.length > 0 && (
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                <span className="truncate">
                                  📍 {u.neighborhoodsVisited.slice(0, 2).join(", ")}
                                  {u.neighborhoodsVisited.length > 2 && ` +${u.neighborhoodsVisited.length - 2} more`}
                                </span>
                                <span className="text-sky-500 font-semibold flex items-center gap-0.5 flex-shrink-0">
                                  Track Path <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                        No tracked users matching &ldquo;{userSearchQuery}&rdquo;
                      </div>
                    )
                  )}
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
        onPinUser={(userTarget) => {
          setPinnedUser(userTarget);
          setIsDrawerOpen(false);
        }}
      />
    </div>
  );
}
