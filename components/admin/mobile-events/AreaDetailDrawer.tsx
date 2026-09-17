"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MapPin,
  Flame,
  Search,
  Building2,
  Ticket,
  Users,
  Clock,
  ExternalLink,
  Smartphone,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type {
  AreaDetailIntelligence,
  NeighborhoodCluster,
} from "@/lib/analytics/mobile-location";
import type { DateRangeFilter } from "@/lib/analytics/mobile-events";

interface AreaDetailDrawerProps {
  neighborhood: string | null;
  clusterData?: NeighborhoodCluster | null;
  dateRange: DateRangeFilter;
  isOpen: boolean;
  onClose: () => void;
}

function formatDwell(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${(seconds / 3600).toFixed(1)}h`;
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

export function AreaDetailDrawer({
  neighborhood,
  clusterData,
  dateRange,
  isOpen,
  onClose,
}: AreaDetailDrawerProps) {
  const [data, setData] = useState<AreaDetailIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("searches");

  useEffect(() => {
    if (!neighborhood || !isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(
      `/api/admin/mobile-events/location/area?neighborhood=${encodeURIComponent(
        neighborhood
      )}&range=${dateRange}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load area data");
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          setData(json.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [neighborhood, dateRange, isOpen]);

  if (!neighborhood) return null;

  const intensityColor =
    clusterData?.intensityLevel === "blazing"
      ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
      : clusterData?.intensityLevel === "hot"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl bg-zinc-950/95 backdrop-blur-xl border-zinc-800 text-zinc-100 p-0 flex flex-col h-full overflow-hidden"
      >
        {/* Header Banner */}
        <div className="relative p-6 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800/80">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <Badge
                  variant="outline"
                  className={`text-xs uppercase font-semibold px-2 py-0.5 border ${intensityColor}`}
                >
                  <Flame className="w-3 h-3 mr-1 inline" />
                  {clusterData?.intensityLevel || "Active"} Zone
                </Badge>
                <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
                  {dateRange.toUpperCase()}
                </Badge>
              </div>
              <SheetTitle className="text-2xl font-bold tracking-tight text-white flex items-center gap-2 pt-1">
                <MapPin className="w-6 h-6 text-primary" />
                {neighborhood}
              </SheetTitle>
              <SheetDescription className="text-zinc-400 text-xs line-clamp-1">
                {clusterData?.categoryAffinity?.join(" • ") || "Karachi Location Intelligence"}
              </SheetDescription>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                Total Events
              </div>
              <div className="text-lg font-bold text-white mt-0.5">
                {data?.overview.totalEvents ?? clusterData?.totalEvents ?? 0}
              </div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                Active Users
              </div>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">
                {data?.overview.uniqueUsers ?? clusterData?.uniqueUsers ?? 0}
              </div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                Dwell Time
              </div>
              <div className="text-lg font-bold text-amber-400 mt-0.5">
                {formatDwell(data?.overview.totalDwellSeconds ?? clusterData?.totalDwellSeconds ?? 0)}
              </div>
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-2.5 text-center">
              <div className="text-zinc-400 text-[10px] font-medium uppercase tracking-wider">
                Peak Time
              </div>
              <div className="text-sm font-bold text-rose-400 mt-1 truncate">
                {data?.overview.peakHour ?? "8:00 PM"}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6 pt-3 border-b border-zinc-800 bg-zinc-950">
            <TabsList className="bg-zinc-900 border border-zinc-800/80 p-1 w-full grid grid-cols-4">
              <TabsTrigger
                value="searches"
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Searches
              </TabsTrigger>
              <TabsTrigger
                value="places"
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" /> Venues & Deals
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
              >
                <Users className="w-3.5 h-3.5" /> Users ({data?.activeUsers.length ?? 0})
              </TabsTrigger>
              <TabsTrigger
                value="stream"
                className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" /> Live Stream
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400 text-xs">Aggregating {neighborhood} intelligence...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {error}
              </div>
            ) : (
              <>
                {/* 1. Searches Tab */}
                <TabsContent value="searches" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Top Search Demand in {neighborhood}
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      {data?.topSearches.length || 0} queries captured
                    </span>
                  </div>

                  {data?.topSearches && data.topSearches.length > 0 ? (
                    <div className="space-y-2">
                      {data.topSearches.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-xs font-mono font-medium text-zinc-300">
                              #{idx + 1}
                            </span>
                            <div>
                              <div className="text-sm font-medium text-white flex items-center gap-2">
                                {s.query}
                                {!s.hasResults && (
                                  <Badge
                                    variant="outline"
                                    className="bg-rose-500/10 border-rose-500/30 text-rose-400 text-[10px] px-1.5 py-0"
                                  >
                                    0 Results (Demand Gap)
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-zinc-500">
                                Last searched {formatRelativeTime(s.lastSeen)}
                              </span>
                            </div>
                          </div>
                          <Badge className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700 font-mono text-xs">
                            {s.count} searches
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                      No search telemetry recorded in {neighborhood} for this date range.
                    </div>
                  )}
                </TabsContent>

                {/* 2. Venues & Deals Tab */}
                <TabsContent value="places" className="mt-0 space-y-5">
                  {/* Visited Places */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      Most Viewed Listings from this Area
                    </h4>
                    {data?.topListings && data.topListings.length > 0 ? (
                      <div className="space-y-2">
                        {data.topListings.map((l) => (
                          <div
                            key={l.listingId}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80"
                          >
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-white">
                                {l.listingName}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {l.uniqueViewers} unique mobile visitors
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-mono font-semibold text-primary">
                                {l.viewCount} views
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                        No listing clicks recorded in this area.
                      </div>
                    )}
                  </div>

                  {/* Deals Engaged */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-amber-400" />
                      Deals & Offers Viewed in {neighborhood}
                    </h4>
                    {data?.topDeals && data.topDeals.length > 0 ? (
                      <div className="space-y-2">
                        {data.topDeals.map((d) => (
                          <div
                            key={d.dealId}
                            className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80"
                          >
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-white">{d.dealTitle}</div>
                              <div className="text-[11px] text-zinc-400">{d.listingName}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs border-zinc-700">
                                {d.views} views
                              </Badge>
                              {d.redeems > 0 && (
                                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                                  {d.redeems} redeems
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                        No deals engaged from this area yet.
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* 3. Users Tab */}
                <TabsContent value="users" className="mt-0 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-cyan-400" />
                      Active Users in {neighborhood}
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      {data?.activeUsers.length || 0} active devices
                    </span>
                  </div>

                  {data?.activeUsers && data.activeUsers.length > 0 ? (
                    <div className="space-y-2.5">
                      {data.activeUsers.map((u, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 border border-zinc-700 bg-zinc-800">
                              <AvatarImage src={u.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs bg-primary/20 text-primary font-bold">
                                {u.fullName
                                  ? u.fullName[0].toUpperCase()
                                  : u.username
                                  ? u.username[0].toUpperCase()
                                  : "U"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-white flex items-center gap-2">
                                {u.fullName || (u.username ? `@${u.username}` : "Anonymous Device")}
                                {u.userId && (
                                  <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">
                                    Signed In
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                                {u.platform && (
                                  <span className="flex items-center gap-1 text-zinc-400">
                                    <Smartphone className="w-3 h-3" />
                                    {u.platform.toUpperCase()}
                                  </span>
                                )}
                                <span>•</span>
                                <span>Top Screen: {u.topScreen || "Home"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-semibold text-white">
                              {u.eventsCount} pings
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {formatRelativeTime(u.lastSeen)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                      No user telemetry recorded in this neighborhood.
                    </div>
                  )}
                </TabsContent>

                {/* 4. Live Stream Tab */}
                <TabsContent value="stream" className="mt-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Recent Activity Stream ({neighborhood})
                    </h4>
                  </div>

                  {data?.recentEvents && data.recentEvents.length > 0 ? (
                    <div className="space-y-2">
                      {data.recentEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-medium text-emerald-400">
                              {evt.eventName}
                            </span>
                            <span className="text-[11px] text-zinc-500">
                              {formatRelativeTime(evt.occurredAt)}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-300 flex items-center justify-between">
                            <span>{evt.userDisplay}</span>
                            {evt.screen && (
                              <span className="text-[11px] text-zinc-500 font-mono">
                                {evt.screen}
                              </span>
                            )}
                          </div>
                          {evt.details && (
                            <div className="text-[11px] text-amber-300/90 font-medium pt-0.5">
                              {evt.details}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs">
                      No live events in this area.
                    </div>
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
