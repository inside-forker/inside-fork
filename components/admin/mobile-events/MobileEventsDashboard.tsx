"use client";

import { Fragment, useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Monitor,
  Users,
  Clock,
  Search,
  Ticket,
  Eye,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Timer,
  BarChartBig,
  Download,
  Smartphone,
  MapPin,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Activity,
  User,
  Globe,
  Target,
  Filter,
  X,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import type {
  MobileEventsFullOverview,
  DateRangeFilter,
  ScreenTimeRow,
  ScreenUserBreakdown,
  ActiveUser,
  DealViewership,
  DealViewerUser,
  SearchEvent,
  RecentMobileEvent,
  ZeroResultQuery,
} from "@/lib/analytics/mobile-events";

/* ===================================================================== */
/* Props                                                                 */
/* ===================================================================== */

interface MobileEventsDashboardProps {
  initialData: MobileEventsFullOverview;
  initialRange: DateRangeFilter;
}

/* ===================================================================== */
/* Helpers                                                               */
/* ===================================================================== */

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateShort(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function screenDisplayName(screen: string): string {
  if (screen === "/") return "Home";
  return screen.startsWith("/") ? screen.slice(1) : screen;
}

const SURFACE_LABELS: Record<SearchEvent["surface"], { label: string; color: string }> = {
  deals: { label: "Deals Page", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  search: { label: "Search", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  explore: { label: "Explore AI", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  listings: { label: "Listings", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  other: { label: "Other", color: "bg-muted text-muted-foreground border-border" },
};

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeFilter; label: string }> = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

/* ===================================================================== */
/* Main Component                                                        */
/* ===================================================================== */

export function MobileEventsDashboard({
  initialData,
  initialRange,
}: MobileEventsDashboardProps) {
  const [data, setData] = useState(initialData);
  const [dateRange, setDateRange] = useState<DateRangeFilter>(initialRange);
  const [isLoading, setIsLoading] = useState(false);

  /* ——— Date range change triggers re-fetch ——— */
  const handleDateRangeChange = useCallback(async (range: DateRangeFilter) => {
    setDateRange(range);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/mobile-events?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // silently fail, keep stale data
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { summary } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* ——— Page Header ——— */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Smartphone className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Mobile Intelligence
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Per-user screen time, navigation journeys, deal engagement, and search behavior from the mobile app.
              </p>
            </div>

            {/* Date Range Controls */}
            <div className="flex items-center gap-2">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleDateRangeChange(opt.value)}
                  disabled={isLoading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    dateRange === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  } ${isLoading ? "opacity-50" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ——— KPI Summary Strip ——— */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Total Screen Time"
          value={formatDuration(summary.totalScreenTimeSeconds)}
          subtext={`Avg ${summary.avgScreenTimeSeconds}s per view`}
          icon={Clock}
        />
        <KpiCard
          label="Screen Views"
          value={summary.screenViews.toLocaleString()}
          subtext={`${summary.totalEvents.toLocaleString()} total events`}
          icon={Monitor}
        />
        <KpiCard
          label="Active Users"
          value={(summary.activeSignedInUsers + summary.activeAnonUsers).toString()}
          subtext={`${summary.activeSignedInUsers} signed in · ${summary.activeAnonUsers} anonymous`}
          icon={Users}
        />
        <KpiCard
          label="Deals Viewed"
          value={summary.dealsViewed.toString()}
          subtext={`${summary.dealsRedeemStarted} redeems started`}
          icon={Ticket}
          tone={summary.dealsViewed > 0 ? "primary" : "neutral"}
        />
        <KpiCard
          label="Searches"
          value={summary.searches.toString()}
          subtext={`${summary.zeroResultSearches} zero-result`}
          icon={Search}
        />
        <KpiCard
          label="Zero-Result Rate"
          value={
            summary.searches > 0
              ? `${Math.round((summary.zeroResultSearches / summary.searches) * 100)}%`
              : "0%"
          }
          subtext="Unmet demand signals"
          icon={AlertTriangle}
          tone={
            summary.searches > 0 && summary.zeroResultSearches / summary.searches > 0.2
              ? "warning"
              : "neutral"
          }
        />
      </div>

      {/* ——— Main Tabbed Dashboard ——— */}
      <Tabs defaultValue="screen-time" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="screen-time" className="gap-1.5 text-xs">
            <Timer className="h-3.5 w-3.5" /> Screen Time
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" /> User Journeys
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5 text-xs">
            <Ticket className="h-3.5 w-3.5" /> Deals Intelligence
          </TabsTrigger>
          <TabsTrigger value="searches" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" /> Searches
          </TabsTrigger>
          <TabsTrigger value="live-events" className="gap-1.5 text-xs">
            <Zap className="h-3.5 w-3.5" /> Event Stream
          </TabsTrigger>
        </TabsList>

        {/* ——— Tab 1: Screen Time ——— */}
        <TabsContent value="screen-time">
          <ScreenTimeTab
            screenTimeRows={data.screenTimeRows}
            totalTime={summary.totalScreenTimeSeconds}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* ——— Tab 2: User Journeys ——— */}
        <TabsContent value="users">
          <UserJourneysTab
            activeUsers={data.activeUsers}
            recentEvents={data.recentEvents}
            dateRange={dateRange}
          />
        </TabsContent>

        {/* ——— Tab 3: Deals Intelligence ——— */}
        <TabsContent value="deals">
          <DealsIntelligenceTab
            dealViewership={data.dealViewership}
            dealViewerUsers={data.dealViewerUsers}
          />
        </TabsContent>

        {/* ——— Tab 4: Searches ——— */}
        <TabsContent value="searches">
          <SearchesTab
            searchEvents={data.searchEvents}
            zeroResultQueries={data.zeroResultQueries}
          />
        </TabsContent>

        {/* ——— Tab 5: Event Stream ——— */}
        <TabsContent value="live-events">
          <EventStreamTab recentEvents={data.recentEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ===================================================================== */
/* KPI Card                                                              */
/* ===================================================================== */

function KpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "primary" | "warning";
}) {
  return (
    <Card className="group border-2 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <p
          className={`text-2xl font-black tracking-tight ${
            tone === "warning"
              ? "text-amber-500"
              : tone === "primary"
                ? "text-primary"
                : "text-foreground"
          }`}
        >
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">{subtext}</p>
      </CardContent>
    </Card>
  );
}

/* ===================================================================== */
/* Tab 1: Screen Time Analytics                                          */
/* ===================================================================== */

function ScreenTimeTab({
  screenTimeRows,
  totalTime,
  dateRange,
}: {
  screenTimeRows: ScreenTimeRow[];
  totalTime: number;
  dateRange: DateRangeFilter;
}) {
  const [pageSearch, setPageSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<ScreenTimeRow | null>(null);

  const filteredRows = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return screenTimeRows;
    return screenTimeRows.filter((row) => {
      const display = screenDisplayName(row.screen).toLowerCase();
      return (
        display.includes(q) ||
        row.screen.toLowerCase().includes(q)
      );
    });
  }, [pageSearch, screenTimeRows]);

  return (
    <>
      <Card className="border-2 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 via-background to-background">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                Screen Time Analytics
              </CardTitle>
              <CardDescription>
                Exact seconds spent on every page. Click a row to see which users visited that page.
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                placeholder="Search pages…"
                className="w-full h-9 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <EmptyState
              message={
                pageSearch.trim()
                  ? "No pages match your search."
                  : "No screen view events recorded for this period."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-bold">Screen / Page</TableHead>
                    <TableHead className="font-bold text-right">Total Time</TableHead>
                    <TableHead className="font-bold text-right">Avg / Visit</TableHead>
                    <TableHead className="font-bold text-right">Views</TableHead>
                    <TableHead className="font-bold text-right">Users</TableHead>
                    <TableHead className="font-bold w-40">Share of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const sharePercent =
                      totalTime > 0 ? (row.totalSecondsSpent / totalTime) * 100 : 0;

                    return (
                      <TableRow
                        key={row.screen}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedRow(row)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary/60" />
                            <code className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/30">
                              {screenDisplayName(row.screen)}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatDuration(row.totalSecondsSpent)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-muted-foreground">
                          {row.avgSecondsPerVisit}s
                        </TableCell>
                        <TableCell className="text-right">
                          {row.viewsCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {row.uniqueUsers}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(sharePercent, 100)}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
                              {sharePercent.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScreenUsersModal
        row={selectedRow}
        open={selectedRow !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
        defaultRange={dateRange}
      />
    </>
  );
}

function ScreenUsersModal({
  row,
  open,
  onOpenChange,
  defaultRange,
}: {
  row: ScreenTimeRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRange: DateRangeFilter;
}) {
  const [modalRange, setModalRange] = useState<DateRangeFilter>(defaultRange);
  const [users, setUsers] = useState<ScreenUserBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const screenKey = row?.screen ?? null;

  useEffect(() => {
    if (!open || !screenKey) return;
    setModalRange(defaultRange);
    setUserSearch("");
  }, [open, screenKey, defaultRange]);

  useEffect(() => {
    if (!open || !screenKey) return;

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/mobile-events/screen-users?screen=${encodeURIComponent(screenKey)}&range=${modalRange}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          setUsers(json.data ?? []);
        } else {
          setUsers([]);
        }
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, screenKey, modalRange]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [u.userDisplay, u.username, u.userId, u.anonId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, userSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            {row ? screenDisplayName(row.screen) : "Screen users"}
          </DialogTitle>
          <DialogDescription>
            {row
              ? `${formatDuration(row.totalSecondsSpent)} total · ${row.viewsCount.toLocaleString()} views · ${row.uniqueUsers} users`
              : "Users who visited this screen"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 min-h-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setModalRange(opt.value)}
                disabled={isLoading}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
                  modalRange === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${isLoading ? "opacity-50" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users…"
              className="w-full h-9 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[50vh] space-y-1.5 pr-1">
            {isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
                Loading users…
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {userSearch.trim()
                  ? "No users match your search."
                  : "No users for this screen in range."}
              </div>
            ) : (
              filteredUsers.map((u, idx) => (
                <div
                  key={`${u.userId ?? u.anonId}-${idx}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{u.userDisplay}</p>
                      {u.username && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          @{u.username}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className="text-muted-foreground">{u.visits} visits</span>
                    <span className="font-bold text-primary">
                      {formatDuration(u.totalSeconds)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===================================================================== */
/* Tab 2: User Journeys                                                  */
/* ===================================================================== */

function UserJourneysTab({
  activeUsers,
  recentEvents,
  dateRange,
}: {
  activeUsers: ActiveUser[];
  recentEvents: RecentMobileEvent[];
  dateRange: DateRangeFilter;
}) {
  const [selectedUser, setSelectedUser] = useState<ActiveUser | null>(null);
  const [journeyEvents, setJourneyEvents] = useState<RecentMobileEvent[]>([]);
  const [isLoadingJourney, setIsLoadingJourney] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return activeUsers;
    return activeUsers.filter((user) => {
      const hay = [
        user.fullName,
        user.username,
        user.userId,
        user.anonId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeUsers, userSearch]);

  const handleSelectUser = useCallback(
    async (user: ActiveUser) => {
      setSelectedUser(user);
      setIsLoadingJourney(true);
      try {
        const id = user.userId ?? user.anonId ?? "";
        const type = user.userId ? "user" : "anon";
        const res = await fetch(
          `/api/admin/mobile-events/journey?id=${encodeURIComponent(id)}&type=${type}&range=${dateRange}`,
        );
        if (res.ok) {
          const json = await res.json();
          setJourneyEvents(json.data ?? []);
        } else {
          const userEvents = recentEvents.filter((e) =>
            user.userId
              ? e.userId === user.userId
              : e.anonId === user.anonId,
          );
          setJourneyEvents(userEvents);
        }
      } catch {
        const userEvents = recentEvents.filter((e) =>
          user.userId ? e.userId === user.userId : e.anonId === user.anonId,
        );
        setJourneyEvents(userEvents);
      } finally {
        setIsLoadingJourney(false);
      }
    },
    [dateRange, recentEvents],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* User List */}
      <Card className="lg:col-span-2 border-2 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-purple-500/5 via-background to-background space-y-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Active Users
            </CardTitle>
            <CardDescription className="text-xs">
              Select a user to view their journey timeline.
            </CardDescription>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search name, @username, id…"
              className="w-full h-9 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <EmptyState
              message={
                userSearch.trim()
                  ? "No users match your search."
                  : "No user activity in this period."
              }
            />
          ) : (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredUsers.map((user) => {
                const isSelected =
                  selectedUser &&
                  ((user.userId && user.userId === selectedUser.userId) ||
                    (user.anonId && user.anonId === selectedUser.anonId));
                const displayName =
                  user.fullName ??
                  (user.anonId
                    ? `Anonymous ${user.anonId.slice(0, 8)}`
                    : "Unknown");
                const platforms = user.platforms ?? [];

                return (
                  <button
                    key={user.userId ?? user.anonId ?? "unknown"}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left p-3 transition-all duration-200 hover:bg-muted/50 ${
                      isSelected
                        ? "bg-primary/10 border-l-4 border-l-primary"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center ${
                          user.userId
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{displayName}</p>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground mt-0.5">
                          {user.username && <span>@{user.username}</span>}
                          <Badge
                            variant={user.userId ? "secondary" : "outline"}
                            className="text-[9px] px-1 py-0"
                          >
                            {user.userId ? "Signed in" : "Anonymous"}
                          </Badge>
                          {platforms.map((p) => (
                            <Badge
                              key={p}
                              variant="outline"
                              className={`text-[9px] px-1 py-0 ${
                                p === "ios"
                                  ? "border-sky-500/40 text-sky-400"
                                  : "border-emerald-500/40 text-emerald-400"
                              }`}
                            >
                              {p === "ios" ? "iOS" : "Android"}
                            </Badge>
                          ))}
                        </div>
                        {user.topScreen && (
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">
                            Most viewed:{" "}
                            <span className="font-semibold text-foreground/80">
                              {screenDisplayName(user.topScreen)}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[10px] space-y-0.5">
                        <p className="font-bold text-primary">
                          {formatDuration(user.totalSeconds)}
                        </p>
                        <p className="text-muted-foreground">
                          {user.eventsCount} events
                        </p>
                        <p className="text-muted-foreground">
                          {user.screensVisited} pages
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journey Timeline */}
      <Card className="lg:col-span-3 border-2 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-cyan-500/5 via-background to-background">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            {selectedUser
              ? `Journey: ${selectedUser.fullName ?? `Anonymous ${(selectedUser.anonId ?? "").slice(0, 8)}`}`
              : "User Journey Timeline"}
          </CardTitle>
          <CardDescription className="text-xs">
            {selectedUser
              ? `${journeyEvents.length} events recorded • Last active ${formatDateTime(selectedUser.lastSeen)}`
              : "Select a user to see their chronological page-by-page journey."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedUser ? (
            <EmptyState message="Select a user from the list to view their journey." />
          ) : isLoadingJourney ? (
            <div className="py-12 text-center text-sm text-muted-foreground animate-pulse">
              Loading user journey...
            </div>
          ) : journeyEvents.length === 0 ? (
            <EmptyState message="No events found for this user in the selected period." />
          ) : (
            <div className="max-h-[600px] overflow-y-auto divide-y">
              {journeyEvents.map((event, idx) => (
                <div
                  key={event.id ?? idx}
                  className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center pt-1">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        event.eventName === "screen_viewed"
                          ? "bg-primary"
                          : event.eventName.includes("search") || event.eventName.includes("filter")
                            ? "bg-cyan-500"
                            : event.eventName.includes("offer") || event.eventName.includes("deal")
                              ? "bg-amber-500"
                              : "bg-muted-foreground"
                      }`}
                    />
                    {idx < journeyEvents.length - 1 && (
                      <div className="w-px h-8 bg-border/50 mt-0.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-[11px] font-mono bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                        {event.eventName}
                      </code>
                      {event.screen && (
                        <span className="text-[10px] text-muted-foreground">
                          on <span className="font-semibold">{screenDisplayName(event.screen)}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDateShort(event.occurredAt)}
                      {event.sourceContext && ` · ${event.sourceContext}`}
                    </p>
                    {/* Show context details for non-screen_viewed events */}
                    {event.eventName !== "screen_viewed" &&
                      event.context &&
                      Object.keys(event.context).length > 0 && (
                        <div className="mt-1 text-[10px] text-muted-foreground bg-muted/30 rounded p-1.5 font-mono">
                          {Object.entries(event.context)
                            .slice(0, 4)
                            .map(([k, v]) => (
                              <div key={k}>
                                <span className="text-primary/80">{k}:</span>{" "}
                                {String(v)}
                              </div>
                            ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ===================================================================== */
/* Tab 3: Deals Intelligence                                             */
/* ===================================================================== */

function DealsIntelligenceTab({
  dealViewership,
  dealViewerUsers,
}: {
  dealViewership: DealViewership[];
  dealViewerUsers: DealViewerUser[];
}) {
  const [expandedDealId, setExpandedDealId] = useState<number | null>(null);

  const viewersForDeal = useMemo(() => {
    if (expandedDealId === null) return [];
    return dealViewerUsers.filter((u) => u.dealId === expandedDealId);
  }, [expandedDealId, dealViewerUsers]);

  return (
    <Card className="border-2 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-amber-500/5 via-background to-background">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          Deals & Offers Intelligence
        </CardTitle>
        <CardDescription>
          Most viewed deals, which users engaged with them, and redemption conversion. Click a deal to see its viewers.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {dealViewership.length === 0 ? (
          <EmptyState message="No deal/offer activity recorded in this period." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/40">
                  <TableHead className="font-bold w-8" />
                  <TableHead className="font-bold">Deal / Offer</TableHead>
                  <TableHead className="font-bold">Merchant</TableHead>
                  <TableHead className="font-bold text-right">Views</TableHead>
                  <TableHead className="font-bold text-right">Redeems Started</TableHead>
                  <TableHead className="font-bold text-right">Conversion</TableHead>
                  <TableHead className="font-bold text-right">Unique Viewers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dealViewership.map((deal) => {
                  const isExpanded = expandedDealId === deal.dealId;
                  const conversionPct =
                    deal.viewCount > 0
                      ? Math.round((deal.redeemStartedCount / deal.viewCount) * 100)
                      : 0;

                  return (
                    <Fragment key={deal.dealId}>
                      <TableRow
                        key={deal.dealId}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() =>
                          setExpandedDealId(isExpanded ? null : deal.dealId)
                        }
                      >
                        <TableCell className="w-8 text-center">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-sm">{deal.dealTitle}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Deal #{deal.dealId}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{deal.listingName}</p>
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {deal.viewCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={deal.redeemStartedCount > 0 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {deal.redeemStartedCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={conversionPct > 0 ? "default" : "outline"}
                            className={`text-xs ${conversionPct >= 50 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}`}
                          >
                            {conversionPct}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {deal.uniqueViewers}
                        </TableCell>
                      </TableRow>

                      {/* Expanded viewer list */}
                      {isExpanded && viewersForDeal.length > 0 && (
                        <TableRow
                          key={`deal-${deal.dealId}-viewers`}
                          className="bg-muted/20"
                        >
                          <TableCell colSpan={7} className="p-4">
                            <div className="rounded-lg border bg-card/80 p-3 space-y-2">
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Who viewed &quot;{deal.dealTitle}&quot;?
                              </p>
                              <div className="grid gap-1.5">
                                {viewersForDeal.map((u, idx) => (
                                  <div
                                    key={`${u.userId ?? u.anonId}-${idx}`}
                                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <Eye className="h-3.5 w-3.5 text-amber-500" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold">{u.userDisplay}</p>
                                        {u.username && (
                                          <p className="text-[10px] text-muted-foreground">
                                            @{u.username}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-muted-foreground">
                                        {u.views} views
                                      </span>
                                      {u.redeemStarted > 0 && (
                                        <Badge
                                          variant="default"
                                          className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400"
                                        >
                                          {u.redeemStarted} redeems
                                        </Badge>
                                      )}
                                      <span className="text-[10px] text-muted-foreground">
                                        Last: {formatDateTime(u.lastViewed)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ===================================================================== */
/* Tab 4: Searches                                                       */
/* ===================================================================== */

function SearchesTab({
  searchEvents,
  zeroResultQueries,
}: {
  searchEvents: SearchEvent[];
  zeroResultQueries: ZeroResultQuery[];
}) {
  const [surfaceFilter, setSurfaceFilter] = useState<SearchEvent["surface"] | "all">("all");

  const filteredSearches = useMemo(() => {
    if (surfaceFilter === "all") return searchEvents;
    return searchEvents.filter((e) => e.surface === surfaceFilter);
  }, [searchEvents, surfaceFilter]);

  const surfaceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: searchEvents.length };
    for (const e of searchEvents) {
      counts[e.surface] = (counts[e.surface] ?? 0) + 1;
    }
    return counts;
  }, [searchEvents]);

  return (
    <div className="space-y-6">
      {/* Surface Filter Buttons */}
      <Card className="border-2 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-cyan-500/5 via-background to-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Search Activity by Surface & User
              </CardTitle>
              <CardDescription className="text-xs">
                Searches on Deals page vs Search/Explore page, attributed to each user.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "deals", label: "Deals Page" },
                  { value: "search", label: "Search" },
                  { value: "explore", label: "Explore AI" },
                  { value: "listings", label: "Listings" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSurfaceFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    surfaceFilter === opt.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}{" "}
                  <span className="opacity-70">({surfaceCounts[opt.value] ?? 0})</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSearches.length === 0 ? (
            <EmptyState message="No searches recorded for this filter and period." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-bold">Query</TableHead>
                    <TableHead className="font-bold">Surface</TableHead>
                    <TableHead className="font-bold">User</TableHead>
                    <TableHead className="font-bold text-right">Results</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSearches.map((search) => {
                    const surfaceStyle = SURFACE_LABELS[search.surface];
                    return (
                      <TableRow
                        key={search.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell>
                          <p className="text-sm font-medium truncate max-w-[200px]">
                            {search.queryText || (
                              <span className="italic text-muted-foreground">
                                (filter only)
                              </span>
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${surfaceStyle.color}`}
                          >
                            {surfaceStyle.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs font-semibold">{search.userDisplay}</p>
                            {search.username && (
                              <p className="text-[10px] text-muted-foreground">
                                @{search.username}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {search.resultCount}
                        </TableCell>
                        <TableCell>
                          {search.hasResults ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-0.5" />
                              Found
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              No results
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(search.occurredAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zero-Result Queries */}
      {zeroResultQueries.length > 0 && (
        <Card className="border-2 shadow-sm">
          <CardHeader className="border-b bg-gradient-to-r from-rose-500/5 via-background to-background">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Zero-Result Search Terms (30d)
            </CardTitle>
            <CardDescription className="text-xs">
              Unmet demand — these queries returned zero listings.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-bold">Query</TableHead>
                    <TableHead className="font-bold text-right">Count</TableHead>
                    <TableHead className="font-bold text-right">Days Active</TableHead>
                    <TableHead className="font-bold">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zeroResultQueries.map((row) => (
                    <TableRow key={row.query} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{row.query}</TableCell>
                      <TableCell className="text-right font-bold">{row.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.daysActive ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.lastSeen.includes("T")
                          ? formatDateTime(row.lastSeen)
                          : row.lastSeen}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ===================================================================== */
/* Tab 5: Event Stream                                                   */
/* ===================================================================== */

function EventStreamTab({
  recentEvents,
}: {
  recentEvents: RecentMobileEvent[];
}) {
  const [inspectedEvent, setInspectedEvent] = useState<RecentMobileEvent | null>(null);
  const [eventFilter, setEventFilter] = useState("");

  const filteredEvents = useMemo(() => {
    if (!eventFilter) return recentEvents;
    const lower = eventFilter.toLowerCase();
    return recentEvents.filter(
      (e) =>
        e.eventName.toLowerCase().includes(lower) ||
        (e.screen ?? "").toLowerCase().includes(lower) ||
        (e.actorName ?? "").toLowerCase().includes(lower) ||
        (e.actorUsername ?? "").toLowerCase().includes(lower) ||
        (e.sourceContext ?? "").toLowerCase().includes(lower),
    );
  }, [recentEvents, eventFilter]);

  return (
    <>
      <Card className="border-2 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-500/5 via-background to-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Live Event Stream
              </CardTitle>
              <CardDescription className="text-xs">
                Raw event log with full context inspector. Click any event to inspect its payload.
              </CardDescription>
            </div>
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter events..."
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {eventFilter && (
                <button
                  type="button"
                  onClick={() => setEventFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <EmptyState message="No events match your filter." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/40">
                    <TableHead className="font-bold">Time</TableHead>
                    <TableHead className="font-bold">Event</TableHead>
                    <TableHead className="font-bold">User</TableHead>
                    <TableHead className="font-bold">Source</TableHead>
                    <TableHead className="font-bold">Screen</TableHead>
                    <TableHead className="font-bold">Platform</TableHead>
                    <TableHead className="font-bold w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => {
                    const userLabel = event.isAuthenticated
                      ? event.actorName && event.actorUsername
                        ? `${event.actorName} (@${event.actorUsername})`
                        : event.actorName ||
                          (event.actorUsername
                            ? `@${event.actorUsername}`
                            : event.userId
                              ? `User ${event.userId.slice(0, 8)}…`
                              : "User")
                      : event.anonId
                        ? `Anon ${event.anonId.slice(0, 8)}…`
                        : "Anon";

                    return (
                      <TableRow
                        key={event.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => setInspectedEvent(event)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(event.occurredAt)}
                        </TableCell>
                        <TableCell>
                          <code className="px-1.5 py-0.5 rounded-md bg-muted/50 text-[11px] font-mono border border-border/30">
                            {event.eventName}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-medium">{userLabel}</p>
                            <Badge
                              variant={event.isAuthenticated ? "secondary" : "outline"}
                              className="text-[9px] px-1 py-0 mt-0.5"
                            >
                              {event.isAuthenticated ? "Signed in" : "Anonymous"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{event.sourceContext}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.screen ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.platform ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Inspector Dialog */}
      <Dialog
        open={inspectedEvent !== null}
        onOpenChange={(open) => !open && setInspectedEvent(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Event Inspector
            </DialogTitle>
            <DialogDescription>
              Full payload and context for this mobile event.
            </DialogDescription>
          </DialogHeader>
          {inspectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Event ID
                  </p>
                  <p className="font-mono">{inspectedEvent.id}</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Event Name
                  </p>
                  <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                    {inspectedEvent.eventName}
                  </code>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Occurred At
                  </p>
                  <p>{formatDateShort(inspectedEvent.occurredAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Screen
                  </p>
                  <p>{inspectedEvent.screen ?? "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Source Context
                  </p>
                  <p>{inspectedEvent.sourceContext}</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Platform
                  </p>
                  <p>{inspectedEvent.platform ?? "—"}</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    User
                  </p>
                  <p>
                    {inspectedEvent.isAuthenticated
                      ? `${inspectedEvent.actorName ?? "User"} ${inspectedEvent.actorUsername ? `(@${inspectedEvent.actorUsername})` : ""}`
                      : `Anonymous ${(inspectedEvent.anonId ?? "").slice(0, 8)}`}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    User ID / Anon ID
                  </p>
                  <p className="font-mono text-[10px] break-all">
                    {inspectedEvent.userId ?? inspectedEvent.anonId ?? "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="font-bold text-muted-foreground uppercase tracking-wider text-[10px] mb-1.5">
                  Context (JSON Payload)
                </p>
                <pre className="text-[11px] font-mono p-3 rounded-lg bg-muted/50 border border-border/50 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectedEvent.context, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ===================================================================== */
/* Shared Empty State                                                    */
/* ===================================================================== */

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
      <BarChartBig className="h-8 w-8 text-muted-foreground/50" />
      <span>{message}</span>
    </div>
  );
}
