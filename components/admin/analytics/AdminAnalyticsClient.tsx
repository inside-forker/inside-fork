"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  BarChartBig,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  RefreshCcw,
  Search,
  Smartphone,
  Target,
  Ticket,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { DateRangeQuickSelect } from "@/components/admin/analytics/DateRangeQuickSelect";
import { exportAnalyticsToCSV } from "@/lib/utils/analytics-export";
import type {
  AdminAnalyticsOverview,
  DateRangePreset,
} from "@/types/analytics";

interface AdminAnalyticsClientProps {
  initialOverview: AdminAnalyticsOverview;
}

interface RefreshState {
  isRefreshing: boolean;
  error: string | null;
}

interface KeyMetric {
  label: string;
  value: number;
  formatter: (value: number) => string;
  caption?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}

const AdminAnalyticsCoreCharts = dynamic(
  () =>
    import("@/components/admin/analytics/AdminAnalyticsCoreCharts").then(
      (mod) => mod.AdminAnalyticsCoreCharts,
    ),
  {
    loading: () => (
      <div className="h-[980px] animate-pulse rounded-xl bg-muted/30" />
    ),
  },
);

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const DEFAULT_REFRESH_INTERVAL = 60;

const PIE_COLORS = [
  "#ff184d",
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
];

const CHANNEL_LABELS: Record<string, string> = {
  bell: "In-app",
  email: "Email",
  push: "Push",
};

const NOTIFICATION_STATUS_STYLES: Record<
  "sent" | "failed" | "pending",
  { label: string; color: string }
> = {
  sent: { label: "Sent", color: "#22c55e" },
  failed: { label: "Failed", color: "#ef4444" },
  pending: { label: "Pending", color: "#f59e0b" },
};

const PERFORMANCE_STATUS: Record<
  "success" | "warning" | "critical" | "info",
  string
> = {
  success: "bg-emerald-500/15 text-emerald-500",
  warning: "bg-amber-500/15 text-amber-500",
  critical: "bg-rose-500/15 text-rose-500",
  info: "bg-slate-500/15 text-slate-500",
};

const formatNumber = (value: number) => numberFormatter.format(value ?? 0);
const formatPercent = (value: number) =>
  percentageFormatter.format(clampRatio(value));
const formatCurrency = (value: number) => currencyFormatter.format(value ?? 0);

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1_000) {
    return 1;
  }
  return value;
}

const getPeriodLabel = (
  preset: DateRangePreset,
  dateRange?: { startDate?: string; endDate?: string },
): string => {
  switch (preset) {
    case "today":
      return "today";
    case "7d":
      return "7d";
    case "30d":
      return "30d";
    case "90d":
      return "90d";
    case "custom": {
      if (dateRange?.startDate && dateRange.endDate) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          const startLabel = start.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const endLabel = end.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return `${startLabel} – ${endLabel}`;
        }
      }
      return "custom";
    }
    default:
      return "period";
  }
};

function formatChartDate(dateString: string): string {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return dateString;
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function hasMeaningfulData<T extends Record<string, unknown>>(
  data: Array<T>,
  keys: Array<keyof T>,
): boolean {
  return data.some((entry) =>
    keys.some((key) =>
      typeof entry[key] === "number" ? Number(entry[key]) > 0 : false,
    ),
  );
}

function getPerformanceStatus(
  average: number | null,
  target: number | undefined,
): "success" | "warning" | "critical" | "info" {
  if (average == null || !Number.isFinite(average) || target == null) {
    return "info";
  }

  if (target <= 0) {
    return "info";
  }

  const ratio = average / target;
  if (ratio <= 1) {
    return "success";
  }
  if (ratio <= 1.3) {
    return "warning";
  }
  return "critical";
}

export function AdminAnalyticsClient({
  initialOverview,
}: AdminAnalyticsClientProps) {
  const [overview, setOverview] =
    useState<AdminAnalyticsOverview>(initialOverview);
  const [refreshState, setRefreshState] = useState<RefreshState>({
    isRefreshing: false,
    error: null,
  });
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>(
    initialOverview.dateRange?.preset ?? "7d",
  );

  const refreshInterval = useMemo(
    () =>
      Math.max(overview.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL, 15),
    [overview.refreshIntervalSeconds],
  );

  const [countdown, setCountdown] = useState<number>(refreshInterval);

  useEffect(() => {
    setOverview(initialOverview);
  }, [initialOverview]);

  useEffect(() => {
    setCountdown(refreshInterval);
  }, [refreshInterval, overview.generatedAt]);

  const handleRefresh = useCallback(
    async (isAuto = false) => {
      let shouldExecute = true;
      setRefreshState((prev) => {
        if (prev.isRefreshing) {
          shouldExecute = false;
          return prev;
        }
        return { isRefreshing: true, error: null };
      });

      if (!shouldExecute) {
        return;
      }

      try {
        // Build URL with date range parameters
        const params = new URLSearchParams({
          range: dateRangePreset,
        });

        const response = await fetch(`/api/admin/analytics?${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            (payload as { error?: string }).error ??
              "Failed to refresh analytics",
          );
        }

        const json = (await response.json()) as {
          data: AdminAnalyticsOverview;
        };
        setOverview(json.data);
        setRefreshState({ isRefreshing: false, error: null });
        setCountdown(refreshInterval);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to refresh analytics";
        setRefreshState({ isRefreshing: false, error: message });
        if (!isAuto) {
          setCountdown(refreshInterval);
        }
      }
    },
    [refreshInterval, dateRangePreset],
  );

  // Handle date range preset change
  const handleDateRangeChange = useCallback(
    async (newPreset: DateRangePreset) => {
      // Update state
      setDateRangePreset(newPreset);
      setCountdown(refreshInterval);

      // Manually trigger refresh with new preset (avoid stale closure)
      setRefreshState({ isRefreshing: true, error: null });

      try {
        // Build URL with NEW date range
        const params = new URLSearchParams({
          range: newPreset,
        });

        const response = await fetch(`/api/admin/analytics?${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            (payload as { error?: string }).error ??
              "Failed to refresh analytics",
          );
        }

        const json = (await response.json()) as {
          data: AdminAnalyticsOverview;
        };
        setOverview(json.data);
        setRefreshState({ isRefreshing: false, error: null });
        setCountdown(refreshInterval);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to refresh analytics";
        setRefreshState({ isRefreshing: false, error: message });
        setCountdown(refreshInterval);
      }
    },
    [refreshInterval],
  );

  // Handle CSV export
  const handleExportCSV = useCallback(() => {
    exportAnalyticsToCSV(overview);
  }, [overview]);

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          void handleRefresh(true);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshInterval, handleRefresh]);

  const isSuperAdmin = overview.viewerRole === "super_admin";

  const searchTrendData = useMemo(
    () =>
      overview.search.trend.map((entry) => ({
        label: formatChartDate(entry.date),
        total: entry.total,
        zeroResults: entry.zeroResults,
      })),
    [overview.search.trend],
  );

  const trafficTrendData = useMemo(
    () =>
      overview.traffic.trend.map((entry) => ({
        label: formatChartDate(entry.date),
        logins: entry.logins,
        signups: entry.signups,
      })),
    [overview.traffic.trend],
  );

  const revenueTrendData = useMemo(
    () =>
      overview.revenue.revenueTrend.map((entry) => ({
        label: formatChartDate(entry.date),
        revenue: entry.revenue,
        bookings: entry.bookings,
      })),
    [overview.revenue.revenueTrend],
  );

  const periodLabel = useMemo(
    () => getPeriodLabel(dateRangePreset, overview.dateRange),
    [dateRangePreset, overview.dateRange],
  );

  const periodLabelSuffix = useMemo(
    () => (periodLabel ? ` (${periodLabel})` : ""),
    [periodLabel],
  );

  const listingsDistribution = useMemo(() => {
    const segments = [
      { name: "Published", value: overview.listings.published },
      { name: "Pending", value: overview.listings.pendingApproval },
      { name: "Draft", value: overview.listings.drafts },
      { name: "Rejected", value: overview.listings.rejected },
      { name: "Archived", value: overview.listings.archived },
    ];
    const total = segments.reduce((sum, item) => sum + item.value, 0);
    return segments.map((segment) => ({
      ...segment,
      percentage: total > 0 ? (segment.value / total) * 100 : 0,
    }));
  }, [overview.listings]);

  const notificationChannelData = useMemo(
    () =>
      overview.notifications.channelBreakdown.map((entry) => ({
        channel: CHANNEL_LABELS[entry.channel] ?? entry.channel,
        sent: entry.sent,
        failed: entry.failed,
        pending: entry.pending,
      })),
    [overview.notifications.channelBreakdown],
  );

  const performanceMetrics = overview.performance?.metrics ?? [];

  const keyMetrics: KeyMetric[] = useMemo(() => {
    const redemptions = overview.offerRedemptions ?? {
      redemptionCountInPeriod: 0,
      billGmvInPeriod: 0,
      discountGmvInPeriod: 0,
      pendingCount: 0,
      voidedCountInPeriod: 0,
    };

    return [
      {
        label: "Daily active users",
        value: overview.traffic.dailyActiveUsers,
        formatter: formatNumber,
        caption: `${formatNumber(
          overview.traffic.weeklyActiveUsers,
        )} weekly actives`,
        icon: UsersRound,
      },
      {
        label: `Gross revenue${periodLabelSuffix}`,
        value: overview.revenue.grossRevenueInPeriod,
        formatter: formatCurrency,
        caption: `${formatNumber(
          overview.revenue.bookingsPaidInPeriod,
        )} paid bookings`,
        icon: LineChartIcon,
      },
      {
        label: `Searches${periodLabelSuffix}`,
        value: overview.search.totalInPeriod,
        formatter: formatNumber,
        caption: `${formatPercent(
          overview.search.zeroResultRateInPeriod,
        )} zero-result rate`,
        icon: Search,
      },
      {
        label: `Offer redemptions${periodLabelSuffix}`,
        value: redemptions.redemptionCountInPeriod,
        formatter: formatNumber,
        caption: `${formatCurrency(
          redemptions.billGmvInPeriod,
        )} bill GMV · ${formatNumber(redemptions.pendingCount)} pending`,
        icon: Ticket,
        href: "/admin/redemptions",
      },
      {
        label: "Conversion rate",
        value: overview.funnels.bookingConversionRate,
        formatter: formatPercent,
        caption: `${formatNumber(
          overview.funnels.bookingsCompletedInPeriod,
        )} bookings completed`,
        icon: Target,
      },
    ];
  }, [overview, periodLabelSuffix]);

  const lastUpdatedAbsolute = useMemo(
    () =>
      new Date(overview.generatedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [overview.generatedAt],
  );

  const hasSearchData = hasMeaningfulData(searchTrendData, [
    "total",
    "zeroResults",
  ]);
  const hasTrafficData = hasMeaningfulData(trafficTrendData, [
    "logins",
    "signups",
  ]);
  const hasRevenueData = hasMeaningfulData(revenueTrendData, [
    "revenue",
    "bookings",
  ]);
  const hasNotificationData = hasMeaningfulData(notificationChannelData, [
    "sent",
    "failed",
    "pending",
  ]);

  const heroSubtitle = isSuperAdmin
    ? "Full telemetry with platform performance and delivery health."
    : "Core marketplace analytics for growth, engagement, and reliability.";

  return (
    <div className="space-y-8 pb-12">
      {/* Standard Admin Header - Consistent with other admin pages */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <BarChartBig className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Analytics Dashboard
                </h1>
              </div>
              <p className="text-muted-foreground text-lg mb-4">
                {heroSubtitle}
              </p>

              {/* Live Status Indicators */}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1.5">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-medium">Live</span>
                  <span className="text-muted-foreground">·</span>
                  <RelativeTime
                    date={overview.generatedAt}
                    className="text-muted-foreground"
                  />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1.5">
                  <Gauge className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    Next refresh in{" "}
                    <span className="font-semibold text-foreground">
                      {Math.max(countdown, 0)}s
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Last Sync Info */}
            <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
              <span>Last synced: {lastUpdatedAbsolute}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {refreshState.error ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive font-medium shadow-lg"
        >
          {refreshState.error}
        </motion.div>
      ) : null}

      {/* Filters and Actions - Consistent with other admin pages */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <DateRangeQuickSelect
              value={dateRangePreset}
              onChange={handleDateRangeChange}
              disabled={refreshState.isRefreshing}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              size="default"
              variant="outline"
              onClick={handleExportCSV}
              disabled={refreshState.isRefreshing}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              size="default"
              variant="default"
              onClick={() => void handleRefresh(false)}
              disabled={refreshState.isRefreshing}
              className="gap-2"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  refreshState.isRefreshing ? "animate-spin" : ""
                }`}
              />
              {refreshState.isRefreshing ? "Refreshing..." : "Refresh Now"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Phase 1 CORE deep-dives */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Link
          href="/admin/mobile-events"
          className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/70 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Smartphone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Mobile events</p>
              <p className="text-xs text-muted-foreground">
                Screen views, search activity, zero-result queries
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Link>
        <Link
          href="/admin/redemptions"
          className="group flex items-center justify-between rounded-xl border border-border/50 bg-background/70 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Offer redemptions</p>
              <p className="text-xs text-muted-foreground">
                Platform bill GMV, recent codes, staff validate
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Link>
      </motion.div>

      {/* Key Metrics Section */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            Key Performance{" "}
            <span className="gradient-text-primary">Indicators</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {keyMetrics.map((metric, index) => {
              const card = (
                <Card className="group relative overflow-hidden border-2 bg-gradient-to-br from-background via-background to-primary/5 shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground">
                      {metric.label}
                    </CardTitle>
                    <div className="rounded-xl bg-primary/10 p-2.5 group-hover:bg-primary/20 transition-colors duration-300">
                      <metric.icon className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="relative space-y-1">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {metric.formatter(metric.value)}
                    </p>
                    {metric.caption ? (
                      <p className="text-xs font-medium text-muted-foreground">
                        {metric.caption}
                      </p>
                    ) : null}
                    {metric.href ? (
                      <p className="pt-1 text-xs font-semibold text-primary inline-flex items-center gap-1">
                        Open details <ArrowRight className="h-3 w-3" />
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );

              return (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  {metric.href ? (
                    <Link href={metric.href} className="block h-full">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </section>

      <AdminAnalyticsCoreCharts
        hasSearchData={hasSearchData}
        hasTrafficData={hasTrafficData}
        hasRevenueData={hasRevenueData}
        searchTrendData={searchTrendData}
        trafficTrendData={trafficTrendData}
        revenueTrendData={revenueTrendData}
        topQueries={overview.search.topQueries}
        topRevenueEvents={overview.revenue.topEvents}
        periodLabelSuffix={periodLabelSuffix}
        revenueSummary={{
          grossRevenueInPeriod: overview.revenue.grossRevenueInPeriod,
          bookingsPaidInPeriod: overview.revenue.bookingsPaidInPeriod,
          refundsInPeriod: overview.revenue.refundsInPeriod,
          pendingPayments: overview.revenue.pendingPayments,
        }}
        formatNumber={formatNumber}
        formatPercent={formatPercent}
        formatCurrency={formatCurrency}
      />

      {/* Listings, Notifications & Funnel Section */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-xl md:text-2xl font-bold mb-6">
            Content & <span className="gradient-text-primary">Operations</span>
          </h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-1 border-2 shadow-premium bg-gradient-to-br from-background via-background to-purple-500/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-purple-500/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Listings distribution
              </CardTitle>
              <CardDescription className="text-sm">
                Snapshot of the content lifecycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {hasMeaningfulData(listingsDistribution, ["value"]) ? (
                <>
                  {/* Donut Chart - Full Width */}
                  <div className="flex justify-center">
                    <div className="h-[240px] w-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={listingsDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={110}
                            paddingAngle={3}
                            strokeWidth={0}
                            isAnimationActive={true}
                            activeIndex={undefined}
                            activeShape={undefined}
                            style={{ cursor: "default", outline: "none" }}
                          >
                            {listingsDistribution.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                style={{ cursor: "default" }}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Legend - Full Width Below Chart */}
                  <div className="grid gap-2.5">
                    {listingsDistribution.map((segment, index) => (
                      <div
                        key={segment.name}
                        className="flex items-center justify-between rounded-xl border-2 bg-gradient-to-br from-background to-purple-500/5 px-4 py-3 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="h-3.5 w-3.5 rounded-full shadow-sm"
                            style={{
                              backgroundColor:
                                PIE_COLORS[index % PIE_COLORS.length],
                            }}
                          />
                          <span className="font-semibold text-sm">
                            {segment.name}
                          </span>
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground">
                            {formatNumber(segment.value)}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            {segment.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <ChartEmptyState message="Add listings to populate lifecycle analytics." />
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-1 border-2 shadow-premium bg-gradient-to-br from-background via-background to-blue-500/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-blue-500/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Notifications delivery
              </CardTitle>
              <CardDescription className="text-sm">
                Channel throughput and backlog health.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="h-[240px] w-full">
                {hasNotificationData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={notificationChannelData}
                      margin={{ left: -10, right: 10, top: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="4 8"
                        stroke="rgba(148,163,184,0.25)"
                      />
                      <XAxis
                        dataKey="channel"
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="rgba(148,163,184,0.6)"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <RechartsTooltip
                        formatter={(value, name) =>
                          typeof value === "number"
                            ? `${formatNumber(value)} ${
                                NOTIFICATION_STATUS_STYLES[
                                  name as keyof typeof NOTIFICATION_STATUS_STYLES
                                ]?.label ?? name
                              }`
                            : value
                        }
                        cursor={{ fill: "rgba(148,163,184,0.12)" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.5rem",
                          boxShadow:
                            "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                          backdropFilter: "blur(4px)",
                        }}
                        labelStyle={{
                          color: "hsl(var(--card-foreground))",
                          fontWeight: 600,
                          marginBottom: "0.375rem",
                        }}
                        itemStyle={{
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={32}
                        iconType="circle"
                      />
                      <Bar
                        dataKey="sent"
                        name="Sent"
                        stackId="delivery"
                        fill={NOTIFICATION_STATUS_STYLES.sent.color}
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="failed"
                        name="Failed"
                        stackId="delivery"
                        fill={NOTIFICATION_STATUS_STYLES.failed.color}
                      />
                      <Bar
                        dataKey="pending"
                        name="Pending"
                        stackId="delivery"
                        fill={NOTIFICATION_STATUS_STYLES.pending.color}
                        radius={[0, 0, 6, 6]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmptyState
                    message={`No notification events during the selected period${periodLabelSuffix}.`}
                  />
                )}
              </div>
              <dl className="grid gap-3 text-sm">
                <DetailRow
                  label={`Sent${periodLabelSuffix}`}
                  value={overview.notifications.sentInPeriod}
                />
                <DetailRow
                  label={`Failed${periodLabelSuffix}`}
                  value={overview.notifications.failedInPeriod}
                  tone={
                    overview.notifications.failedInPeriod > 0
                      ? "warning"
                      : "neutral"
                  }
                />
                <DetailRow
                  label="Success rate"
                  valueLabel={formatPercent(
                    overview.notifications.deliverySuccessRate,
                  )}
                  description="Across all channels"
                />
                <DetailRow
                  label="Pending dispatch"
                  value={overview.notifications.pendingNow}
                  tone={
                    overview.notifications.pendingNow > 0
                      ? "warning"
                      : "neutral"
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="xl:col-span-1 border-2 shadow-premium bg-gradient-to-br from-background via-background to-cyan-500/5">
            <CardHeader className="space-y-2 border-b bg-gradient-to-r from-cyan-500/5 via-background to-background">
              <CardTitle className="text-lg font-bold">
                Conversion funnel
              </CardTitle>
              <CardDescription className="text-sm">
                From lead capture to paid booking{periodLabelSuffix}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-3">
                <FunnelStep
                  label={`Get listed${periodLabelSuffix}`}
                  value={overview.funnels.getListedSubmissionsInPeriod}
                  description="Business submissions"
                />
                <FunnelStep
                  label={`Membership${periodLabelSuffix}`}
                  value={overview.funnels.membershipSubmissionsInPeriod}
                  description="Premium leads"
                />
                <FunnelStep
                  label={`Bookings started${periodLabelSuffix}`}
                  value={overview.funnels.bookingsStartedInPeriod}
                  description="Checkout initiations"
                />
                <FunnelStep
                  label={`Bookings completed${periodLabelSuffix}`}
                  value={overview.funnels.bookingsCompletedInPeriod}
                  description="Paid reservations"
                  highlight
                />
              </div>
              <div className="rounded-2xl border-2 bg-gradient-to-br from-primary/10 to-primary/5 px-5 py-4 shadow-lg">
                <p className="text-xs uppercase tracking-wider font-bold text-primary mb-2">
                  Booking conversion
                </p>
                <p className="text-3xl font-black gradient-text-primary">
                  {formatPercent(overview.funnels.bookingConversionRate)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {isSuperAdmin ? (
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-xl md:text-2xl font-bold mb-6">
              Platform{" "}
              <span className="gradient-text-primary">Performance</span>
            </h2>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-2 shadow-premium bg-gradient-to-br from-background via-background to-indigo-500/5">
              <CardHeader className="space-y-2 border-b bg-gradient-to-r from-indigo-500/5 via-background to-background">
                <CardTitle className="text-lg font-bold">
                  Platform performance
                </CardTitle>
                <CardDescription className="text-sm">
                  Aggregated web vitals and API telemetry, last{" "}
                  {overview.performance?.sampleCount ?? 0} samples.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {performanceMetrics.length === 0 ? (
                  <ChartEmptyState message="No performance metrics recorded yet." />
                ) : (
                  performanceMetrics.map((metric) => {
                    const average = metric.average ?? null;
                    const target = metric.target;
                    const status = getPerformanceStatus(average, target);
                    const badgeClass = PERFORMANCE_STATUS[status];
                    const valueLabel =
                      average == null
                        ? "—"
                        : metric.unit === "ratio"
                          ? formatPercent(average)
                          : `${Math.round(average)} ms`;
                    const targetLabel =
                      target == null
                        ? "—"
                        : metric.unit === "ratio"
                          ? formatPercent(target)
                          : `${Math.round(target)} ms`;

                    let progressValue = 100;
                    if (target != null && average != null && target > 0) {
                      progressValue = Math.min(
                        (target / Math.max(average, 1)) * 100,
                        100,
                      );
                    }

                    return (
                      <div
                        key={metric.metric}
                        className="rounded-xl border-2 bg-gradient-to-br from-background to-indigo-500/5 px-5 py-4 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-foreground">
                            {metric.label}
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass}`}
                          >
                            {status === "success"
                              ? "On track"
                              : status === "warning"
                                ? "Monitor"
                                : status === "critical"
                                  ? "Needs attention"
                                  : "Baseline"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-3">
                          <span className="text-2xl font-black text-foreground">
                            {valueLabel}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">
                            Target {targetLabel}
                          </span>
                        </div>
                        <Progress
                          value={progressValue}
                          className="mt-4 h-2.5"
                        />
                      </div>
                    );
                  })
                )}
              </CardContent>
              {overview.performance?.capturedUntil ? (
                <CardFooter className="border-t bg-muted/20 text-xs font-medium text-muted-foreground">
                  Metrics through{" "}
                  {new Date(
                    overview.performance.capturedUntil,
                  ).toLocaleString()}
                </CardFooter>
              ) : null}
            </Card>

            <Card className="border-2 shadow-premium bg-gradient-to-br from-background via-background to-rose-500/5">
              <CardHeader className="space-y-2 border-b bg-gradient-to-r from-rose-500/5 via-background to-background">
                <CardTitle className="text-lg font-bold">
                  Delivery guardrails
                </CardTitle>
                <CardDescription className="text-sm">
                  Successful delivery across all notification channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="rounded-2xl border-2 bg-gradient-to-br from-background to-emerald-500/5 px-5 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    Success rate
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-black text-foreground">
                      {formatPercent(
                        overview.notifications.deliverySuccessRate,
                      )}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatNumber(overview.notifications.sentInPeriod)} sent ·{" "}
                      {formatNumber(overview.notifications.failedInPeriod)}{" "}
                      failed
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border-2 bg-gradient-to-br from-background to-amber-500/5 px-5 py-4 shadow-sm">
                  <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
                    Queue backlog
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-black text-foreground">
                      {formatNumber(overview.notifications.pendingNow)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Pending messages awaiting dispatch
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted bg-muted/10 text-center text-sm text-muted-foreground">
      <BarChartBig className="h-8 w-8 text-muted-foreground/60" />
      <span>{message}</span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueLabel,
  description,
  tone = "neutral",
}: {
  label: string;
  value?: number;
  valueLabel?: string;
  description?: string;
  tone?: "neutral" | "warning" | "primary";
}) {
  const displayValue =
    valueLabel ?? (typeof value === "number" ? formatNumber(value) : "—");

  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-500"
        : "text-foreground";

  return (
    <div className="flex items-center justify-between rounded-xl border-2 bg-gradient-to-br from-background to-primary/5 px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {description ? (
          <p className="text-xs font-medium text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <span className={`text-sm font-bold ${toneClass}`}>{displayValue}</span>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string;
  value: number;
  description?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 px-5 py-4 shadow-sm ${
        highlight
          ? "border-primary bg-gradient-to-br from-primary/15 to-primary/5 shadow-lg"
          : "bg-gradient-to-br from-background to-cyan-500/5"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p
          className={`text-sm font-bold ${
            highlight ? "text-primary" : "text-foreground"
          }`}
        >
          {label}
        </p>
        <span
          className={`text-base font-black ${
            highlight ? "text-primary" : "text-foreground"
          }`}
        >
          {formatNumber(value)}
        </span>
      </div>
      {description ? (
        <p className="text-xs font-medium text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
