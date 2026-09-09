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
  ChevronRight,
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
  House,
  Tag,
  ShoppingCart,
  Building2,
  Trophy,
  Sparkles,
  LayoutGrid,
  List,
  SlidersHorizontal,
  ArrowUpDown,
  Compass,
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
  if (!screen || screen === "/") return "Home";
  const raw = screen.startsWith("/") ? screen.slice(1) : screen;
  return raw
    .split("/")
    .map((part) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
        return `[id:${part.slice(0, 8)}]`;
      }
      return part
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    })
    .join(" / ");
}

function formatPreviewSlug(slug: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
    return `[${slug.slice(0, 8)}]`;
  }
  return slug.replace(/[-_]/g, " ");
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
  const [activeTab, setActiveTab] = useState("screen-time");
  const [journeyTarget, setJourneyTarget] = useState<{
    id: string;
    type: "user" | "anon";
    displayName: string;
  } | null>(null);

  const handleJumpToUserJourney = useCallback(
    (u: { userId: string | null; anonId: string | null; displayName: string }) => {
      const id = u.userId ?? u.anonId;
      if (!id) return;
      setJourneyTarget({
        id,
        type: u.userId ? "user" : "anon",
        displayName: u.displayName,
      });
      setActiveTab("users");
    },
    [],
  );

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
            onJumpToUserJourney={handleJumpToUserJourney}
          />
        </TabsContent>

        {/* ——— Tab 2: User Journeys ——— */}
        <TabsContent value="users">
          <UserJourneysTab
            activeUsers={data.activeUsers}
            recentEvents={data.recentEvents}
            dateRange={dateRange}
            externalTarget={journeyTarget}
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
/* App Domain Taxonomy & Classification                                  */
/* ===================================================================== */

type AppDomainKey =
  | "core"
  | "deals"
  | "events"
  | "places"
  | "discovery"
  | "account";

interface AppDomainConfig {
  key: AppDomainKey;
  name: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: {
    text: string;
    bg: string;
    border: string;
    barBg: string;
    badge: string;
    dot: string;
  };
}

const APP_DOMAINS: Record<AppDomainKey, AppDomainConfig> = {
  core: {
    key: "core",
    name: "Home & Core Feed",
    shortLabel: "Core Hub",
    description: "Main feed, home landing & core navigation",
    icon: House,
    accent: {
      text: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/30",
      barBg: "bg-indigo-500",
      badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
      dot: "bg-indigo-400",
    },
  },
  deals: {
    key: "deals",
    name: "Deals & Commerce",
    shortLabel: "Deals",
    description: "Discounts, category filters, deal terms & redemptions",
    icon: Tag,
    accent: {
      text: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      barBg: "bg-amber-500",
      badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      dot: "bg-amber-400",
    },
  },
  events: {
    key: "events",
    name: "Events & Ticketing",
    shortLabel: "Events",
    description: "Festivals, concerts, event listings & organizer profiles",
    icon: Ticket,
    accent: {
      text: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      barBg: "bg-violet-500",
      badge: "bg-violet-500/15 text-violet-400 border-violet-500/30",
      dot: "bg-violet-400",
    },
  },
  places: {
    key: "places",
    name: "Places & Venues",
    shortLabel: "Places",
    description: "Directory listings, venue profiles & outlet locations",
    icon: MapPin,
    accent: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      barBg: "bg-emerald-500",
      badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-400",
    },
  },
  discovery: {
    key: "discovery",
    name: "Discovery & AI Search",
    shortLabel: "Discovery",
    description: "Search queries, explore recommendations & city discover",
    icon: Globe,
    accent: {
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      barBg: "bg-cyan-500",
      badge: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      dot: "bg-cyan-400",
    },
  },
  account: {
    key: "account",
    name: "Account & System",
    shortLabel: "Account",
    description: "User authentication, profile, onboarding & dashboard",
    icon: User,
    accent: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      barBg: "bg-rose-500",
      badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      dot: "bg-rose-400",
    },
  },
};

function getScreenDomain(screen: string): AppDomainKey {
  const s = screen.toLowerCase().trim();
  const normalized = s.startsWith("/") ? s.slice(1) : s;

  if (!normalized || normalized === "home") return "core";

  if (
    normalized.startsWith("deal") ||
    normalized.startsWith("checkout") ||
    normalized.startsWith("redeem") ||
    normalized.includes("deal_term")
  ) {
    return "deals";
  }

  if (normalized.startsWith("event") || normalized.startsWith("organizer")) {
    return "events";
  }

  if (
    normalized.startsWith("listing") ||
    normalized.startsWith("venue") ||
    normalized.startsWith("place")
  ) {
    return "places";
  }

  if (
    normalized.startsWith("search") ||
    normalized.startsWith("explore") ||
    normalized.startsWith("discover")
  ) {
    return "discovery";
  }

  if (
    normalized.startsWith("profile") ||
    normalized.startsWith("sign-in") ||
    normalized.startsWith("signin") ||
    normalized.startsWith("auth") ||
    normalized.startsWith("onboarding") ||
    normalized.startsWith("dashboard") ||
    normalized.startsWith("contact")
  ) {
    return "account";
  }

  return "core";
}

function formatCleanScreenTitle(screen: string): string {
  if (!screen || screen === "/" || screen.toLowerCase() === "home") {
    return "Home Feed";
  }
  const s = screen.startsWith("/") ? screen.slice(1) : screen;

  if (s === "deals") return "Deals Directory";
  if (s === "deals-category") return "Deals Category View";
  if (s === "deals-filter") return "Deals Filter & Search";
  if (s === "deals-bank") return "Deals Bank Partners";
  if (s === "listing_deal_terms") return "Deal Terms & Redemption";
  if (s === "sign-in" || s === "signin") return "Sign In / Authentication";
  if (s === "checkout") return "Checkout Flow";
  if (s === "events") return "Events Directory";
  if (s === "explore") return "Explore AI City Guide";
  if (s === "listings") return "Listings Directory";
  if (s === "search") return "Global Search";
  if (s === "profile") return "User Profile";
  if (s === "contact") return "Contact Support";
  if (s === "onboarding") return "User Onboarding";

  const parts = s.split("/").filter(Boolean);
  return parts
    .map((part) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
        return `[id:${part.slice(0, 8)}]`;
      }
      return part
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    })
    .join(" › ");
}

type SelectedScreenTarget = {
  screen: string;
  displayTitle: string;
  routeSlug: string;
  totalSeconds: number;
  viewsCount: number;
  uniqueUsers: number;
  isPrefix: boolean;
  domain: AppDomainKey;
};

/* ===================================================================== */
/* Tab 1: Screen Time — Executive Intelligence Architecture               */
/* ===================================================================== */

function ScreenTimeTab({
  screenTimeRows,
  totalTime,
  dateRange,
  onJumpToUserJourney,
}: {
  screenTimeRows: ScreenTimeRow[];
  totalTime: number;
  dateRange: DateRangeFilter;
  onJumpToUserJourney?: (user: {
    userId: string | null;
    anonId: string | null;
    displayName: string;
  }) => void;
}) {
  const [viewMode, setViewMode] = useState<"modules" | "leaderboard">("modules");
  const [selectedDomain, setSelectedDomain] = useState<AppDomainKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [leaderboardSort, setLeaderboardSort] = useState<"time" | "views" | "users">("time");
  const [expandedModules, setExpandedModules] = useState<Set<AppDomainKey>>(
    new Set(["core", "deals", "events", "places", "discovery", "account"]),
  );
  const [selectedTarget, setSelectedTarget] = useState<SelectedScreenTarget | null>(null);

  // Group rows by app domain
  const domainGroups = useMemo(() => {
    const groups: Record<
      AppDomainKey,
      {
        domain: AppDomainConfig;
        totalSeconds: number;
        totalViews: number;
        uniqueUsers: number;
        screens: ScreenTimeRow[];
        sharePercent: number;
      }
    > = {
      core: { domain: APP_DOMAINS.core, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
      deals: { domain: APP_DOMAINS.deals, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
      events: { domain: APP_DOMAINS.events, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
      places: { domain: APP_DOMAINS.places, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
      discovery: { domain: APP_DOMAINS.discovery, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
      account: { domain: APP_DOMAINS.account, totalSeconds: 0, totalViews: 0, uniqueUsers: 0, screens: [], sharePercent: 0 },
    };

    for (const row of screenTimeRows) {
      const dKey = getScreenDomain(row.screen);
      const grp = groups[dKey];
      grp.totalSeconds += row.totalSecondsSpent;
      grp.totalViews += row.viewsCount;
      grp.uniqueUsers += row.uniqueUsers;
      grp.screens.push(row);
    }

    for (const dKey of Object.keys(groups) as AppDomainKey[]) {
      groups[dKey].screens.sort((a, b) => b.totalSecondsSpent - a.totalSecondsSpent);
      groups[dKey].sharePercent = totalTime > 0 ? (groups[dKey].totalSeconds / totalTime) * 100 : 0;
    }

    return groups;
  }, [screenTimeRows, totalTime]);

  // Executive Spotlight Metrics
  const highlights = useMemo(() => {
    if (screenTimeRows.length === 0) return null;

    const mostEngaged = [...screenTimeRows].sort((a, b) => b.totalSecondsSpent - a.totalSecondsSpent)[0];
    const mostViewed = [...screenTimeRows].sort((a, b) => b.viewsCount - a.viewsCount)[0];
    const broadestReach = [...screenTimeRows].sort((a, b) => b.uniqueUsers - a.uniqueUsers)[0];
    const totalViews = screenTimeRows.reduce((acc, r) => acc + r.viewsCount, 0);
    const avgDwell = totalViews > 0 ? Math.round(totalTime / totalViews) : 0;

    return {
      mostEngaged: {
        title: formatCleanScreenTitle(mostEngaged.screen),
        seconds: mostEngaged.totalSecondsSpent,
        share: totalTime > 0 ? ((mostEngaged.totalSecondsSpent / totalTime) * 100).toFixed(1) : "0",
        raw: mostEngaged,
      },
      mostViewed: {
        title: formatCleanScreenTitle(mostViewed.screen),
        views: mostViewed.viewsCount,
        raw: mostViewed,
      },
      broadestReach: {
        title: formatCleanScreenTitle(broadestReach.screen),
        users: broadestReach.uniqueUsers,
        raw: broadestReach,
      },
      avgDwell: {
        seconds: avgDwell,
        totalViews,
      },
    };
  }, [screenTimeRows, totalTime]);

  // Filtered rows for Leaderboard
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return screenTimeRows.filter((r) => {
      const d = getScreenDomain(r.screen);
      if (selectedDomain !== "all" && d !== selectedDomain) return false;
      if (!q) return true;
      const clean = formatCleanScreenTitle(r.screen).toLowerCase();
      const raw = r.screen.toLowerCase();
      const domainName = APP_DOMAINS[d].name.toLowerCase();
      return clean.includes(q) || raw.includes(q) || domainName.includes(q);
    });
  }, [screenTimeRows, selectedDomain, searchQuery]);

  const sortedLeaderboardRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      if (leaderboardSort === "views") return b.viewsCount - a.viewsCount;
      if (leaderboardSort === "users") return b.uniqueUsers - a.uniqueUsers;
      return b.totalSecondsSpent - a.totalSecondsSpent;
    });
  }, [filteredRows, leaderboardSort]);

  const toggleModuleExpand = useCallback((dKey: AppDomainKey) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(dKey)) next.delete(dKey);
      else next.add(dKey);
      return next;
    });
  }, []);

  const domainsList = useMemo(() => {
    return (Object.keys(domainGroups) as AppDomainKey[])
      .map((k) => domainGroups[k])
      .filter((g) => g.screens.length > 0)
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [domainGroups]);

  return (
    <div className="space-y-6">
      {/* ——— Section 1: Executive Share of Attention Strip ——— */}
      <Card className="border-2 shadow-sm bg-gradient-to-br from-background via-background to-muted/20">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Share of User Attention by App Domain
              </CardTitle>
              <CardDescription className="text-xs">
                Proportional breakdown of total active screen time across mobile app features
              </CardDescription>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 w-fit">
              {formatDuration(totalTime)} Total Dwell
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Multi-segment stacked distribution bar */}
          <div className="relative h-4 w-full rounded-full bg-muted/60 overflow-hidden flex border border-border/40 shadow-inner">
            {domainsList.map((grp) => {
              if (grp.sharePercent <= 0) return null;
              return (
                <div
                  key={grp.domain.key}
                  style={{ width: `${grp.sharePercent}%` }}
                  className={`h-full ${grp.domain.accent.barBg} transition-all duration-300 relative group cursor-pointer`}
                  onClick={() =>
                    setSelectedDomain((prev) => (prev === grp.domain.key ? "all" : grp.domain.key))
                  }
                  title={`${grp.domain.name}: ${formatDuration(grp.totalSeconds)} (${grp.sharePercent.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Interactive domain pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {domainsList.map((grp) => {
              const isSelected = selectedDomain === grp.domain.key;
              const Icon = grp.domain.icon;
              return (
                <button
                  key={grp.domain.key}
                  type="button"
                  onClick={() =>
                    setSelectedDomain((prev) => (prev === grp.domain.key ? "all" : grp.domain.key))
                  }
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                    isSelected
                      ? `${grp.domain.accent.bg} ${grp.domain.accent.border} ${grp.domain.accent.text} ring-2 ring-primary/20 shadow-sm`
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${grp.domain.accent.dot}`} />
                  <Icon className="h-3.5 w-3.5" />
                  <span>{grp.domain.shortLabel}</span>
                  <span className="text-[11px] font-mono opacity-80">
                    {grp.sharePercent.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    ({formatDuration(grp.totalSeconds)})
                  </span>
                </button>
              );
            })}
            {selectedDomain !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedDomain("all")}
                className="px-2 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Reset filter
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ——— Section 2: Executive Metric Highlights ——— */}
      {highlights && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Most Engaged */}
          <Card
            onClick={() =>
              setSelectedTarget({
                screen: highlights.mostEngaged.raw.screen,
                displayTitle: highlights.mostEngaged.title,
                routeSlug: highlights.mostEngaged.raw.screen,
                totalSeconds: highlights.mostEngaged.raw.totalSecondsSpent,
                viewsCount: highlights.mostEngaged.raw.viewsCount,
                uniqueUsers: highlights.mostEngaged.raw.uniqueUsers,
                isPrefix: false,
                domain: getScreenDomain(highlights.mostEngaged.raw.screen),
              })
            }
            className="border border-border/70 bg-gradient-to-br from-amber-500/10 via-background to-background p-4 rounded-xl cursor-pointer hover:border-amber-500/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Top Screen Engagement
              </span>
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/10">
                {highlights.mostEngaged.share}% share
              </Badge>
            </div>
            <p className="text-base font-bold truncate group-hover:text-primary transition-colors">
              {highlights.mostEngaged.title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black tabular-nums">
                {formatDuration(highlights.mostEngaged.seconds)}
              </span>
              <span className="text-xs text-muted-foreground">total spent</span>
            </div>
          </Card>

          {/* Card 2: Most Viewed */}
          <Card
            onClick={() =>
              setSelectedTarget({
                screen: highlights.mostViewed.raw.screen,
                displayTitle: highlights.mostViewed.title,
                routeSlug: highlights.mostViewed.raw.screen,
                totalSeconds: highlights.mostViewed.raw.totalSecondsSpent,
                viewsCount: highlights.mostViewed.raw.viewsCount,
                uniqueUsers: highlights.mostViewed.raw.uniqueUsers,
                isPrefix: false,
                domain: getScreenDomain(highlights.mostViewed.raw.screen),
              })
            }
            className="border border-border/70 bg-gradient-to-br from-violet-500/10 via-background to-background p-4 rounded-xl cursor-pointer hover:border-violet-500/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-violet-400" />
                Most Visited Screen
              </span>
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/10">
                Footfall
              </Badge>
            </div>
            <p className="text-base font-bold truncate group-hover:text-primary transition-colors">
              {highlights.mostViewed.title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black tabular-nums">
                {highlights.mostViewed.views.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">views recorded</span>
            </div>
          </Card>

          {/* Card 3: Broadest Reach */}
          <Card
            onClick={() =>
              setSelectedTarget({
                screen: highlights.broadestReach.raw.screen,
                displayTitle: highlights.broadestReach.title,
                routeSlug: highlights.broadestReach.raw.screen,
                totalSeconds: highlights.broadestReach.raw.totalSecondsSpent,
                viewsCount: highlights.broadestReach.raw.viewsCount,
                uniqueUsers: highlights.broadestReach.raw.uniqueUsers,
                isPrefix: false,
                domain: getScreenDomain(highlights.broadestReach.raw.screen),
              })
            }
            className="border border-border/70 bg-gradient-to-br from-indigo-500/10 via-background to-background p-4 rounded-xl cursor-pointer hover:border-indigo-500/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                Broadest Reach
              </span>
              <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                Audience
              </Badge>
            </div>
            <p className="text-base font-bold truncate group-hover:text-primary transition-colors">
              {highlights.broadestReach.title}
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black tabular-nums">
                {highlights.broadestReach.users}
              </span>
              <span className="text-xs text-muted-foreground">unique viewers</span>
            </div>
          </Card>

          {/* Card 4: Avg Dwell Time */}
          <Card className="border border-border/70 bg-gradient-to-br from-emerald-500/10 via-background to-background p-4 rounded-xl">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                Avg Screen Dwell
              </span>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                Global
              </Badge>
            </div>
            <p className="text-base font-bold text-muted-foreground">
              App-Wide Pace
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black tabular-nums">
                {formatDuration(highlights.avgDwell.seconds)}
              </span>
              <span className="text-xs text-muted-foreground">
                per view across {highlights.avgDwell.totalViews} views
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ——— Section 3: Navigation Toolbar & View Switcher ——— */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        {/* View mode toggle */}
        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/50 self-start">
          <button
            type="button"
            onClick={() => setViewMode("modules")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "modules"
                ? "bg-background text-foreground shadow-sm font-bold border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span>Feature Modules</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("leaderboard")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "leaderboard"
                ? "bg-background text-foreground shadow-sm font-bold border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5 text-primary" />
            <span>Ranked Leaderboard</span>
          </button>
        </div>

        {/* Search and Sort controls */}
        <div className="flex items-center gap-2 flex-1 md:justify-end">
          {viewMode === "leaderboard" && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60 shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sort:</span>
              <select
                value={leaderboardSort}
                onChange={(e) => setLeaderboardSort(e.target.value as "time" | "views" | "users")}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="time" className="bg-background text-foreground">Total Time</option>
                <option value="views" className="bg-background text-foreground">Views Count</option>
                <option value="users" className="bg-background text-foreground">Unique Users</option>
              </select>
            </div>
          )}

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search screen, route, or category…"
              className="w-full h-9 rounded-xl border border-border/60 bg-muted/20 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ——— Section 4: Main Content (Modules or Leaderboard) ——— */}
      {viewMode === "modules" ? (
        <div className="space-y-4">
          {domainsList
            .filter((grp) => selectedDomain === "all" || grp.domain.key === selectedDomain)
            .map((grp) => {
              const isExpanded = expandedModules.has(grp.domain.key);
              const Icon = grp.domain.icon;
              const q = searchQuery.trim().toLowerCase();
              const matchingScreens = q
                ? grp.screens.filter((s) => {
                    const clean = formatCleanScreenTitle(s.screen).toLowerCase();
                    return clean.includes(q) || s.screen.toLowerCase().includes(q);
                  })
                : grp.screens;

              if (matchingScreens.length === 0 && q) return null;

              return (
                <Card
                  key={grp.domain.key}
                  className="border-2 shadow-sm overflow-hidden transition-all duration-200"
                >
                  {/* Module Header Strip */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-muted/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-xl ${grp.domain.accent.bg} border ${grp.domain.accent.border} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-5 w-5 ${grp.domain.accent.text}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-foreground truncate">
                            {grp.domain.name}
                          </h3>
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-normal ${grp.domain.accent.badge}`}>
                            {grp.screens.length} {grp.screens.length === 1 ? "screen" : "screens"}
                          </Badge>
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {grp.sharePercent.toFixed(1)}% of app time
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {grp.domain.description}
                        </p>
                      </div>
                    </div>

                    {/* Aggregate module stats & toggle */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-right">
                        <p className="text-base font-black tabular-nums">
                          {formatDuration(grp.totalSeconds)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {grp.totalViews.toLocaleString()} views · {grp.uniqueUsers} users
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedTarget({
                            screen: grp.domain.key === "core" ? "" : grp.domain.key,
                            displayTitle: `${grp.domain.name} (Module Aggregate)`,
                            routeSlug: grp.domain.key,
                            totalSeconds: grp.totalSeconds,
                            viewsCount: grp.totalViews,
                            uniqueUsers: grp.uniqueUsers,
                            isPrefix: grp.domain.key !== "core",
                            domain: grp.domain.key,
                          })
                        }
                        className="h-8 text-xs font-semibold gap-1.5 bg-background hover:bg-muted"
                      >
                        <span>Inspect Module</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>

                      <button
                        type="button"
                        onClick={() => toggleModuleExpand(grp.domain.key)}
                        className="h-8 w-8 rounded-lg border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={isExpanded ? "Collapse screens" : "Expand screens"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Module Screens List */}
                  {isExpanded && (
                    <div className="divide-y divide-border/30 bg-background/50">
                      {matchingScreens.map((row) => {
                        const cleanTitle = formatCleanScreenTitle(row.screen);
                        const rowShare =
                          grp.totalSeconds > 0
                            ? (row.totalSecondsSpent / grp.totalSeconds) * 100
                            : 0;
                        const avgDwell =
                          row.viewsCount > 0
                            ? Math.round(row.totalSecondsSpent / row.viewsCount)
                            : 0;

                        return (
                          <div
                            key={row.screen}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setSelectedTarget({
                                screen: row.screen,
                                displayTitle: cleanTitle,
                                routeSlug: row.screen,
                                totalSeconds: row.totalSecondsSpent,
                                viewsCount: row.viewsCount,
                                uniqueUsers: row.uniqueUsers,
                                isPrefix: false,
                                domain: grp.domain.key,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                setSelectedTarget({
                                  screen: row.screen,
                                  displayTitle: cleanTitle,
                                  routeSlug: row.screen,
                                  totalSeconds: row.totalSecondsSpent,
                                  viewsCount: row.viewsCount,
                                  uniqueUsers: row.uniqueUsers,
                                  isPrefix: false,
                                  domain: grp.domain.key,
                                });
                              }
                            }}
                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="h-2 w-2 rounded-full bg-border group-hover:bg-primary transition-colors shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                                  {cleanTitle}
                                </p>
                                <p className="text-[11px] font-mono text-muted-foreground truncate">
                                  {row.screen || "/"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-center">
                              <div className="w-24 text-right">
                                <span className="font-bold text-sm tabular-nums">
                                  {formatDuration(row.totalSecondsSpent)}
                                </span>
                                <div className="flex items-center gap-1 justify-end mt-0.5">
                                  <Progress value={Math.min(rowShare, 100)} className="h-1 w-12" />
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {rowShare.toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              <div className="w-16 text-right tabular-nums text-muted-foreground">
                                <span className="font-medium text-foreground">{row.viewsCount}</span>
                                <span className="text-[10px] block text-muted-foreground">views</span>
                              </div>

                              <div className="w-16 text-right tabular-nums">
                                <span className="font-semibold text-foreground px-1.5 py-0.5 rounded bg-muted text-[11px]">
                                  {row.uniqueUsers} users
                                </span>
                              </div>

                              <div className="w-20 text-right tabular-nums text-muted-foreground hidden md:block">
                                <span className="text-[11px]">~{formatDuration(avgDwell)}</span>
                                <span className="text-[10px] block text-muted-foreground/70">avg dwell</span>
                              </div>

                              <span className="text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pl-2">
                                Inspect <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      ) : (
        /* ——— View Mode 2: Ranked Leaderboard View ——— */
        <Card className="border-2 shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/20 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">
                All Screens Ranked ({sortedLeaderboardRows.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                Click any row to open the full user analytics modal
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="text-[11px] uppercase tracking-wider font-semibold hover:bg-transparent">
                    <TableHead className="w-16 text-center">Rank</TableHead>
                    <TableHead className="min-w-[220px]">Screen & App Domain</TableHead>
                    <TableHead className="text-right w-28">Total Time</TableHead>
                    <TableHead className="text-right w-20">Views</TableHead>
                    <TableHead className="text-right w-20">Users</TableHead>
                    <TableHead className="text-right w-24 hidden md:table-cell">Avg Dwell</TableHead>
                    <TableHead className="w-32 hidden sm:table-cell">Share</TableHead>
                    <TableHead className="text-right w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/30">
                  {sortedLeaderboardRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                        No screens match your search query or domain filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedLeaderboardRows.map((row, idx) => {
                      const cleanTitle = formatCleanScreenTitle(row.screen);
                      const dKey = getScreenDomain(row.screen);
                      const domainCfg = APP_DOMAINS[dKey];
                      const sharePercent = totalTime > 0 ? (row.totalSecondsSpent / totalTime) * 100 : 0;
                      const avgDwell = row.viewsCount > 0 ? Math.round(row.totalSecondsSpent / row.viewsCount) : 0;
                      const rank = idx + 1;

                      return (
                        <TableRow
                          key={row.screen}
                          onClick={() =>
                            setSelectedTarget({
                              screen: row.screen,
                              displayTitle: cleanTitle,
                              routeSlug: row.screen,
                              totalSeconds: row.totalSecondsSpent,
                              viewsCount: row.viewsCount,
                              uniqueUsers: row.uniqueUsers,
                              isPrefix: false,
                              domain: dKey,
                            })
                          }
                          className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        >
                          {/* Rank */}
                          <TableCell className="text-center font-mono font-bold">
                            {rank === 1 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40 text-xs">
                                #1
                              </span>
                            ) : rank === 2 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 text-xs">
                                #2
                              </span>
                            ) : rank === 3 ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 text-xs">
                                #3
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">#{rank}</span>
                            )}
                          </TableCell>

                          {/* Screen Title & Domain */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${domainCfg.accent.badge}`}
                              >
                                {domainCfg.shortLabel}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                  {cleanTitle}
                                </p>
                                <p className="text-[11px] font-mono text-muted-foreground truncate">
                                  {row.screen || "/"}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Total Time */}
                          <TableCell className="text-right font-bold text-sm tabular-nums">
                            {formatDuration(row.totalSecondsSpent)}
                          </TableCell>

                          {/* Views */}
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                            {row.viewsCount.toLocaleString()}
                          </TableCell>

                          {/* Users */}
                          <TableCell className="text-right">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium">
                              {row.uniqueUsers}
                            </span>
                          </TableCell>

                          {/* Avg Dwell */}
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden md:table-cell">
                            ~{formatDuration(avgDwell)}
                          </TableCell>

                          {/* Share Progress */}
                          <TableCell className="hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(sharePercent, 100)} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground font-mono w-10 text-right tabular-nums">
                                {sharePercent.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>

                          {/* Action Button */}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2"
                            >
                              <span>Inspect</span>
                              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ——— Section 5: Centered Stats Popup Modal ——— */}
      {selectedTarget && (
        <ScreenUserModal
          target={selectedTarget}
          defaultRange={dateRange}
          onClose={() => setSelectedTarget(null)}
          onJumpToUserJourney={onJumpToUserJourney}
        />
      )}
    </div>
  );
}

/* ===================================================================== */
/* Centered Stats Popup Modal (`ScreenUserModal`)                        */
/* ===================================================================== */

function ScreenUserModal({
  target,
  defaultRange,
  onClose,
  onJumpToUserJourney,
}: {
  target: SelectedScreenTarget;
  defaultRange: DateRangeFilter;
  onClose: () => void;
  onJumpToUserJourney?: (user: {
    userId: string | null;
    anonId: string | null;
    displayName: string;
  }) => void;
}) {
  const [modalRange, setModalRange] = useState<DateRangeFilter>(defaultRange);
  const [users, setUsers] = useState<ScreenUserBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const domainCfg = APP_DOMAINS[target.domain];
  const Icon = domainCfg.icon;

  useEffect(() => {
    setModalRange(defaultRange);
    setUserSearch("");
  }, [target.screen, target.isPrefix, defaultRange]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const prefixParam = target.isPrefix ? "&prefix=true" : "";
        const res = await fetch(
          `/api/admin/mobile-events/screen-users?screen=${encodeURIComponent(
            target.screen,
          )}&range=${modalRange}${prefixParam}`,
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
  }, [target.screen, target.isPrefix, modalRange]);

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

  const avgDwell =
    target.viewsCount > 0
      ? Math.round(target.totalSeconds / target.viewsCount)
      : 0;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden border-2 shadow-2xl bg-background rounded-2xl flex flex-col"
        style={{
          top: "clamp(1.25rem, 4vh, 2.5rem)",
          transform: "translateX(-50%)",
          maxHeight: "calc(100vh - 4rem)",
          height: "min(80vh, 640px)",
        }}
      >
        {/* Modal Header (Fixed height, shrink-0) */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-gradient-to-r from-muted/40 via-background to-transparent pr-12 space-y-3 text-left shrink-0">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${domainCfg.accent.bg} border ${domainCfg.accent.border} flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${domainCfg.accent.text}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${domainCfg.accent.badge}`}>
                  {domainCfg.name}
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground truncate">
                  {target.routeSlug || "/"}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold truncate mt-0.5">
                {target.displayTitle}
              </DialogTitle>
            </div>
          </div>

          {/* 4 Quick KPI Summary Cards */}
          <div className="grid grid-cols-4 gap-2 pt-0.5">
            <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Time</p>
              <p className="text-sm font-black tabular-nums mt-0.5">{formatDuration(target.totalSeconds)}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Views</p>
              <p className="text-sm font-black tabular-nums mt-0.5">{target.viewsCount.toLocaleString()}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Unique</p>
              <p className="text-sm font-black tabular-nums mt-0.5">{target.uniqueUsers}</p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Dwell</p>
              <p className="text-sm font-black tabular-nums mt-0.5">~{formatDuration(avgDwell)}</p>
            </div>
          </div>

          {/* Date Range Selector Pills */}
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-muted/60 rounded-lg border border-border/50">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setModalRange(opt.value)}
                disabled={isLoading}
                className={`py-1 px-2 rounded-md text-xs font-semibold text-center transition-all ${
                  modalRange === opt.value
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                } ${isLoading ? "opacity-50" : ""}`}
              >
                {opt.value === "24h"
                  ? "24 Hours"
                  : opt.value === "7d"
                    ? "7 Days"
                    : opt.value === "30d"
                      ? "30 Days"
                      : "All Time"}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Viewer search bar (Pinned, shrink-0) */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search viewers by name, username, or ID…"
              className="w-full h-9 rounded-xl border border-border/60 bg-muted/20 pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {userSearch && (
              <button
                type="button"
                onClick={() => setUserSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Direct Scrollable Viewers List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
            {isLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground animate-pulse flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span>Loading viewers breakdown…</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {userSearch.trim()
                  ? "No viewers match your search query."
                  : "No screen view events recorded for this period."}
              </div>
            ) : (
              filteredUsers.map((u, idx) => {
                const isNamed = Boolean(
                  u.username ||
                    (u.userDisplay && !u.userDisplay.startsWith("Anonymous ")),
                );
                return (
                  <div
                    key={`${u.userId ?? u.anonId}-${idx}`}
                    onClick={() => {
                      onClose();
                      if (onJumpToUserJourney) {
                        onJumpToUserJourney({
                          userId: u.userId,
                          anonId: u.anonId,
                          displayName: u.userDisplay,
                        });
                      }
                    }}
                    className="group flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/40 hover:bg-primary/[0.04] transition-all cursor-pointer shadow-xs"
                    title="Click to view full user journey timeline"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <div
                        className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                          isNamed
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted text-muted-foreground border border-border/60"
                        }`}
                      >
                        {isNamed ? (
                          u.userDisplay.charAt(0).toUpperCase()
                        ) : (
                          <User className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                          {u.userDisplay}
                        </p>
                        {u.username ? (
                          <p className="text-xs text-muted-foreground truncate">
                            @{u.username}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                            {u.userId ? "Registered User" : "Anonymous Guest"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs shrink-0">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/40">
                        {u.visits} {u.visits === 1 ? "visit" : "visits"}
                      </span>
                      <span className="font-bold text-xs font-mono text-primary bg-primary/10 border border-primary/25 px-2.5 py-0.5 rounded-md">
                        {formatDuration(u.totalSeconds)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
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
  externalTarget,
}: {
  activeUsers: ActiveUser[];
  recentEvents: RecentMobileEvent[];
  dateRange: DateRangeFilter;
  externalTarget?: {
    id: string;
    type: "user" | "anon";
    displayName: string;
  } | null;
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

  // Jump to external user target if provided
  useEffect(() => {
    if (!externalTarget) return;
    const found = activeUsers.find(
      (u) =>
        (externalTarget.type === "user" && u.userId === externalTarget.id) ||
        (externalTarget.type === "anon" && u.anonId === externalTarget.id),
    );
    if (found) {
      void handleSelectUser(found);
    } else {
      const syntheticUser: ActiveUser = {
        userId: externalTarget.type === "user" ? externalTarget.id : null,
        anonId: externalTarget.type === "anon" ? externalTarget.id : null,
        fullName: externalTarget.displayName,
        username: null,
        eventsCount: 0,
        screensVisited: 0,
        totalSeconds: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        platforms: [],
        topScreen: null,
      };
      void handleSelectUser(syntheticUser);
    }
  }, [externalTarget, activeUsers, handleSelectUser]);

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
