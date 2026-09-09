"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  UsersRound,
  LineChart as LineChartIcon,
  Search,
  Ticket,
  Target,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Layers,
  ArrowRight,
  BarChartBig,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Line,
} from "recharts";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminAnalyticsOverview } from "@/types/analytics";

export type MetricType = "dau" | "revenue" | "searches" | "redemptions" | "conversion";

interface KeyMetricDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMetricId: MetricType | null;
  overview: AdminAnalyticsOverview;
  periodLabelSuffix: string;
  formatNumber: (value: number) => string;
  formatPercent: (value: number) => string;
  formatCurrency: (value: number) => string;
  searchTrendData: Array<{ label: string; total: number; zeroResults: number }>;
  trafficTrendData: Array<{ label: string; logins: number; signups: number }>;
  revenueTrendData: Array<{ label: string; revenue: number; bookings: number }>;
}

const METRIC_TABS: Array<{
  id: MetricType;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dau", label: "Daily active users", shortLabel: "DAU / Traffic", icon: UsersRound },
  { id: "revenue", label: "Gross revenue", shortLabel: "Revenue", icon: LineChartIcon },
  { id: "searches", label: "Searches", shortLabel: "Searches", icon: Search },
  { id: "redemptions", label: "Offer redemptions", shortLabel: "Redemptions", icon: Ticket },
  { id: "conversion", label: "Conversion rate", shortLabel: "Conversion", icon: Target },
];

export function KeyMetricDetailModal({
  isOpen,
  onClose,
  initialMetricId,
  overview,
  periodLabelSuffix,
  formatNumber,
  formatPercent,
  formatCurrency,
  searchTrendData,
  trafficTrendData,
  revenueTrendData,
}: KeyMetricDetailModalProps) {
  const [activeTab, setActiveTab] = useState<MetricType>(initialMetricId ?? "dau");

  // Keep active tab in sync when initialMetricId changes upon open
  React.useEffect(() => {
    if (initialMetricId) {
      setActiveTab(initialMetricId);
    }
  }, [initialMetricId]);

  const redemptions = useMemo(
    () =>
      overview.offerRedemptions ?? {
        redemptionCountInPeriod: 0,
        billGmvInPeriod: 0,
        discountGmvInPeriod: 0,
        pendingCount: 0,
        voidedCountInPeriod: 0,
      },
    [overview.offerRedemptions],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden border-2 border-border/80 shadow-2xl bg-background">
        {/* Header with Navigation Pills */}
        <div className="p-5 pb-3 border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <DialogHeader className="mb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-semibold">
                  KPI Deep-Dive
                </Badge>
                {periodLabelSuffix ? (
                  <span className="text-xs text-muted-foreground font-medium">
                    {periodLabelSuffix.replace(/[()]/g, "")}
                  </span>
                ) : null}
              </div>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-left">
              Key Performance Indicator Details
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground">
              Inspect comprehensive analytics telemetry, breakdowns, historical trends, and quick actions.
            </DialogDescription>
          </DialogHeader>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {METRIC_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {activeTab === "dau" && (
            <DauDetailView
              traffic={overview.traffic}
              marketplaceHealth={overview.marketplaceHealth}
              trendData={trafficTrendData}
              formatNumber={formatNumber}
              formatPercent={formatPercent}
              periodLabelSuffix={periodLabelSuffix}
            />
          )}

          {activeTab === "revenue" && (
            <RevenueDetailView
              revenue={overview.revenue}
              trendData={revenueTrendData}
              formatNumber={formatNumber}
              formatPercent={formatPercent}
              formatCurrency={formatCurrency}
              periodLabelSuffix={periodLabelSuffix}
            />
          )}

          {activeTab === "searches" && (
            <SearchesDetailView
              search={overview.search}
              trendData={searchTrendData}
              formatNumber={formatNumber}
              formatPercent={formatPercent}
              periodLabelSuffix={periodLabelSuffix}
            />
          )}

          {activeTab === "redemptions" && (
            <RedemptionsDetailView
              redemptions={redemptions}
              marketplaceHealth={overview.marketplaceHealth}
              formatNumber={formatNumber}
              formatCurrency={formatCurrency}
              formatPercent={formatPercent}
              periodLabelSuffix={periodLabelSuffix}
            />
          )}

          {activeTab === "conversion" && (
            <ConversionDetailView
              funnels={overview.funnels}
              formatNumber={formatNumber}
              formatPercent={formatPercent}
              periodLabelSuffix={periodLabelSuffix}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            Telemetry auto-refreshes with the analytics dashboard.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ========================================================================= */
/* 1. Daily Active Users Detail View                                         */
/* ========================================================================= */

function DauDetailView({
  traffic,
  marketplaceHealth,
  trendData,
  formatNumber,
  formatPercent,
  periodLabelSuffix,
}: {
  traffic: AdminAnalyticsOverview["traffic"];
  marketplaceHealth: AdminAnalyticsOverview["marketplaceHealth"];
  trendData: Array<{ label: string; logins: number; signups: number }>;
  formatNumber: (v: number) => string;
  formatPercent: (v: number) => string;
  periodLabelSuffix: string;
}) {
  const stickinessRatio =
    traffic.weeklyActiveUsers > 0
      ? (traffic.dailyActiveUsers / traffic.weeklyActiveUsers) * 100
      : 0;

  const hasTrafficChartData = trendData.some((d) => d.logins > 0 || d.signups > 0);

  return (
    <div className="space-y-6">
      {/* Highlight Banner */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/20 p-3 text-primary">
              <UsersRound className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Daily Active Users (DAU)
              </p>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {formatNumber(traffic.dailyActiveUsers)}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/80 px-3 py-1 font-semibold text-xs">
              {formatNumber(traffic.weeklyActiveUsers)} Weekly Actives
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
              Stickiness: {stickinessRatio.toFixed(1)}% (DAU/WAU)
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Weekly Active Users"
          value={formatNumber(traffic.weeklyActiveUsers)}
          subtext="7-day rolling active audience"
        />
        <StatTile
          label={`New Signups${periodLabelSuffix}`}
          value={formatNumber(traffic.newUsersInPeriod)}
          subtext="Newly registered accounts"
          tone={traffic.newUsersInPeriod > 0 ? "success" : "neutral"}
        />
        <StatTile
          label="30-Day Retention"
          value={formatPercent(traffic.retentionRate)}
          subtext="Active returning users"
          tone="primary"
        />
        <StatTile
          label={`Failed Logins${periodLabelSuffix}`}
          value={formatNumber(traffic.failedLoginAttemptsInPeriod)}
          subtext="Potential auth issues"
          tone={traffic.failedLoginAttemptsInPeriod > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Marketplace Health snapshot if present */}
      {marketplaceHealth ? (
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Nightly Marketplace Snapshot ({marketplaceHealth.day})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">DAU:</span>{" "}
              <span className="font-bold">{formatNumber(marketplaceHealth.dau)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">WAU:</span>{" "}
              <span className="font-bold">{formatNumber(marketplaceHealth.wau)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Snapshot Computed:</span>{" "}
              <span className="font-semibold text-xs">
                {new Date(marketplaceHealth.computedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Activity Timeline Chart */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">Traffic & Authentication Trend</h4>
            <p className="text-xs text-muted-foreground">Daily logins vs new user registrations</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Logins
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Signups
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full">
          {hasTrafficChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="dauLoginsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff184d" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ff184d" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="dauSignupsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="logins" name="Logins" stroke="#ff184d" strokeWidth={2} fill="url(#dauLoginsGrad)" />
                <Area type="monotone" dataKey="signups" name="Signups" stroke="#6366f1" strokeWidth={2} fill="url(#dauSignupsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No login or signup activity recorded in this time range." />
          )}
        </div>
      </div>

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/users">
            <UsersRound className="h-3.5 w-3.5" /> Manage Users
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/mobile-events">
            <Smartphone className="h-3.5 w-3.5" /> Mobile App Events
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/segments">
            <Layers className="h-3.5 w-3.5" /> Audience Segments
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 2. Gross Revenue Detail View                                              */
/* ========================================================================= */

function RevenueDetailView({
  revenue,
  trendData,
  formatNumber,
  formatPercent,
  formatCurrency,
  periodLabelSuffix,
}: {
  revenue: AdminAnalyticsOverview["revenue"];
  trendData: Array<{ label: string; revenue: number; bookings: number }>;
  formatNumber: (v: number) => string;
  formatPercent: (v: number) => string;
  formatCurrency: (v: number) => string;
  periodLabelSuffix: string;
}) {
  const hasRevenueChartData = trendData.some((d) => d.revenue > 0 || d.bookings > 0);
  const netEstimatedRevenue = Math.max(revenue.grossRevenueInPeriod - revenue.refundsInPeriod, 0);

  return (
    <div className="space-y-6">
      {/* Highlight Banner */}
      <div className="rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-emerald-500/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-500">
              <LineChartIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Gross Revenue{periodLabelSuffix}
              </p>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {formatCurrency(revenue.grossRevenueInPeriod)}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/80 px-3 py-1 font-semibold text-xs">
              {formatNumber(revenue.bookingsPaidInPeriod)} Paid Bookings
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
              AOV: {formatCurrency(revenue.averageOrderValueInPeriod)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Average Order Value"
          value={formatCurrency(revenue.averageOrderValueInPeriod)}
          subtext="Average spend per paid booking"
        />
        <StatTile
          label="Estimated Net Revenue"
          value={formatCurrency(netEstimatedRevenue)}
          subtext="Gross minus processed refunds"
          tone="success"
        />
        <StatTile
          label="Pending Payments"
          value={formatNumber(revenue.pendingPayments)}
          subtext="Bookings awaiting confirmation"
          tone={revenue.pendingPayments > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Refunds Processed"
          value={formatCurrency(revenue.refundsInPeriod)}
          subtext="Returned to customers"
          tone={revenue.refundsInPeriod > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">Revenue & Bookings Velocity</h4>
            <p className="text-xs text-muted-foreground">Daily revenue generation and booking transactions</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Revenue (PKR)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Bookings
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full">
          {hasRevenueChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
                <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#ff184d" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No revenue or booking events recorded in this period." />
          )}
        </div>
      </div>

      {/* Top Revenue Events */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Top Revenue Drivers</h4>
        {revenue.topEvents && revenue.topEvents.length > 0 ? (
          <div className="grid gap-2">
            {revenue.topEvents.map((event) => (
              <div
                key={event.eventId}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{event.eventName}</p>
                  <p className="text-xs text-muted-foreground">{formatNumber(event.bookings)} bookings</p>
                </div>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(event.revenue)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            No top revenue events recorded for this period yet.
          </p>
        )}
      </div>

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/bookings">
            <LineChartIcon className="h-3.5 w-3.5" /> View Bookings Console
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/redemptions">
            <Ticket className="h-3.5 w-3.5" /> Redemptions & GMV
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 3. Searches Detail View                                                   */
/* ========================================================================= */

function SearchesDetailView({
  search,
  trendData,
  formatNumber,
  formatPercent,
  periodLabelSuffix,
}: {
  search: AdminAnalyticsOverview["search"];
  trendData: Array<{ label: string; total: number; zeroResults: number }>;
  formatNumber: (v: number) => string;
  formatPercent: (v: number) => string;
  periodLabelSuffix: string;
}) {
  const hasSearchChartData = trendData.some((d) => d.total > 0 || d.zeroResults > 0);
  const successRate = Math.max(1 - search.zeroResultRateInPeriod, 0);

  return (
    <div className="space-y-6">
      {/* Highlight Banner */}
      <div className="rounded-2xl border-2 border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-background to-cyan-500/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/20 p-3 text-cyan-500">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Total Searches{periodLabelSuffix}
              </p>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {formatNumber(search.totalInPeriod)}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={search.zeroResultRateInPeriod > 0.2 ? "destructive" : "outline"}
              className="px-3 py-1 font-semibold text-xs"
            >
              {formatPercent(search.zeroResultRateInPeriod)} Zero-Result Rate
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
              {formatPercent(successRate)} Discovery Success
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Last 24h Searches"
          value={formatNumber(search.totalLast24Hours)}
          subtext="Recent search throughput"
        />
        <StatTile
          label="Zero-Result Count"
          value={formatNumber(search.zeroResultCountInPeriod)}
          subtext="Searches returning no listings"
          tone={search.zeroResultCountInPeriod > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Zero-Result Rate"
          value={formatPercent(search.zeroResultRateInPeriod)}
          subtext="Unmet demand percentage"
          tone={search.zeroResultRateInPeriod > 0.2 ? "danger" : "neutral"}
        />
        <StatTile
          label="Top Queries Logged"
          value={formatNumber(search.topQueries.length)}
          subtext="Distinct popular search terms"
        />
      </div>

      {/* Search Trend Chart */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground">Search Volume & Zero-Results</h4>
            <p className="text-xs text-muted-foreground">Search frequency vs zero-result query volume</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Total Searches
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Zero-Result Queries
            </span>
          </div>
        </div>

        <div className="h-[220px] w-full">
          {hasSearchChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="searchTotalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 8" stroke="rgba(148,163,184,0.2)" />
                <XAxis dataKey="label" stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(148,163,184,0.6)" tickLine={false} axisLine={false} allowDecimals={false} />
                <RechartsTooltip />
                <Area type="monotone" dataKey="total" name="Searches" stroke="#06b6d4" strokeWidth={2} fill="url(#searchTotalGrad)" />
                <Line type="monotone" dataKey="zeroResults" name="Zero-Result" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChartMessage message="No search activity captured for the selected date range." />
          )}
        </div>
      </div>

      {/* Top Search Queries Table */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">Top Searched Queries</h4>
        {search.topQueries && search.topQueries.length > 0 ? (
          <div className="divide-y text-xs">
            <div className="grid grid-cols-4 pb-2 font-bold text-muted-foreground">
              <span className="col-span-2">Query Keyword</span>
              <span className="text-right">Searches</span>
              <span className="text-right">Zero-Result Rate</span>
            </div>
            {search.topQueries.map((queryItem, idx) => (
              <div key={idx} className="grid grid-cols-4 py-2.5 items-center">
                <span className="col-span-2 font-medium truncate">{queryItem.query}</span>
                <span className="text-right font-semibold">{formatNumber(queryItem.count)}</span>
                <span className="text-right">
                  <Badge
                    variant={queryItem.zeroResultRate > 0.3 ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {formatPercent(queryItem.zeroResultRate)}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            No queries logged yet in this time window.
          </p>
        )}
      </div>

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/demand-gap">
            <Search className="h-3.5 w-3.5" /> Demand Gap Analysis
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/mobile-events">
            <Smartphone className="h-3.5 w-3.5" /> Mobile Search Telemetry
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 4. Offer Redemptions Detail View                                          */
/* ========================================================================= */

function RedemptionsDetailView({
  redemptions,
  marketplaceHealth,
  formatNumber,
  formatCurrency,
  formatPercent,
  periodLabelSuffix,
}: {
  redemptions: AdminAnalyticsOverview["offerRedemptions"];
  marketplaceHealth: AdminAnalyticsOverview["marketplaceHealth"];
  formatNumber: (v: number) => string;
  formatCurrency: (v: number) => string;
  formatPercent: (v: number) => string;
  periodLabelSuffix: string;
}) {
  const avgBasketSize =
    redemptions.redemptionCountInPeriod > 0
      ? redemptions.billGmvInPeriod / redemptions.redemptionCountInPeriod
      : 0;

  const totalVouchersAttempted =
    redemptions.redemptionCountInPeriod + redemptions.pendingCount + redemptions.voidedCountInPeriod;

  return (
    <div className="space-y-6">
      {/* Highlight Banner */}
      <div className="rounded-2xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-3 text-amber-500">
              <Ticket className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Offer Redemptions{periodLabelSuffix}
              </p>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {formatNumber(redemptions.redemptionCountInPeriod)}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/80 px-3 py-1 font-semibold text-xs">
              {formatCurrency(redemptions.billGmvInPeriod)} Bill GMV
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
              {formatNumber(redemptions.pendingCount)} Pending Verification
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Total Bill GMV"
          value={formatCurrency(redemptions.billGmvInPeriod)}
          subtext="Merchant spend stimulated"
          tone="primary"
        />
        <StatTile
          label="Discounts Provided"
          value={formatCurrency(redemptions.discountGmvInPeriod)}
          subtext="Total user savings"
        />
        <StatTile
          label="Pending Validation"
          value={formatNumber(redemptions.pendingCount)}
          subtext="Awaiting merchant confirmation"
          tone={redemptions.pendingCount > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Voided / Expired"
          value={formatNumber(redemptions.voidedCountInPeriod)}
          subtext="Unredeemed or cancelled"
          tone={redemptions.voidedCountInPeriod > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Average Ticket / Bill Size"
          value={formatCurrency(avgBasketSize)}
          subtext="Average bill per redeemed offer"
        />
        <StatTile
          label="Total Redemption Attempts"
          value={formatNumber(totalVouchersAttempted)}
          subtext="Completed + Pending + Voided"
        />
      </div>

      {/* Marketplace Health snapshot if present */}
      {marketplaceHealth ? (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-primary" />
            7-Day Marketplace Redemption Health
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Validated (7d):</span>{" "}
              <span className="font-bold">{formatNumber(marketplaceHealth.validatedRedemptions7d)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Bill GMV (7d):</span>{" "}
              <span className="font-bold">{formatCurrency(marketplaceHealth.billGmv7d)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Listing Coverage (30d):</span>{" "}
              <span className="font-bold">{formatPercent(marketplaceHealth.redemptionListingRate30d)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="default" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/redemptions">
            <Ticket className="h-3.5 w-3.5" /> Open Redemptions Console & Validator
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/segments">
            <Layers className="h-3.5 w-3.5" /> Merchant Segments
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 5. Conversion Rate Detail View                                            */
/* ========================================================================= */

function ConversionDetailView({
  funnels,
  formatNumber,
  formatPercent,
  periodLabelSuffix,
}: {
  funnels: AdminAnalyticsOverview["funnels"];
  formatNumber: (v: number) => string;
  formatPercent: (v: number) => string;
  periodLabelSuffix: string;
}) {
  const checkoutCompletionRate =
    funnels.bookingsStartedInPeriod > 0
      ? funnels.bookingsCompletedInPeriod / funnels.bookingsStartedInPeriod
      : 0;

  return (
    <div className="space-y-6">
      {/* Highlight Banner */}
      <div className="rounded-2xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-background to-purple-500/5 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/20 p-3 text-purple-500">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Booking Conversion Rate
              </p>
              <h3 className="text-3xl font-black tracking-tight text-foreground">
                {formatPercent(funnels.bookingConversionRate)}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="bg-background/80 px-3 py-1 font-semibold text-xs">
              {formatNumber(funnels.bookingsCompletedInPeriod)} Completed Bookings
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 font-semibold text-xs">
              Checkout Rate: {formatPercent(checkoutCompletionRate)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile
          label="Bookings Completed"
          value={formatNumber(funnels.bookingsCompletedInPeriod)}
          subtext="Successful confirmed bookings"
          tone="success"
        />
        <StatTile
          label="Bookings Started"
          value={formatNumber(funnels.bookingsStartedInPeriod)}
          subtext="Checkouts initiated"
        />
        <StatTile
          label="Get Listed Leads"
          value={formatNumber(funnels.getListedSubmissionsInPeriod)}
          subtext="Business onboarding requests"
        />
        <StatTile
          label="Membership Leads"
          value={formatNumber(funnels.membershipSubmissionsInPeriod)}
          subtext="Premium partner inquiries"
        />
      </div>

      {/* Visual Funnel Progression */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h4 className="text-sm font-bold text-foreground">Conversion Funnel Progression</h4>
        <div className="space-y-3">
          <FunnelBarItem
            label="1. Top of Funnel: Partner & Lead Inquiries"
            value={funnels.getListedSubmissionsInPeriod + funnels.membershipSubmissionsInPeriod}
            subtitle={`${formatNumber(funnels.getListedSubmissionsInPeriod)} Get Listed · ${formatNumber(
              funnels.membershipSubmissionsInPeriod
            )} Membership`}
            pct={100}
            colorClass="bg-purple-500"
          />

          <FunnelBarItem
            label="2. Middle of Funnel: Bookings Started"
            value={funnels.bookingsStartedInPeriod}
            subtitle="Users initiating checkout for an event or listing"
            pct={
              funnels.getListedSubmissionsInPeriod + funnels.membershipSubmissionsInPeriod > 0
                ? Math.min(
                    (funnels.bookingsStartedInPeriod /
                      (funnels.getListedSubmissionsInPeriod + funnels.membershipSubmissionsInPeriod)) *
                      100,
                    100
                  )
                : 50
            }
            colorClass="bg-indigo-500"
          />

          <FunnelBarItem
            label="3. Bottom of Funnel: Bookings Completed"
            value={funnels.bookingsCompletedInPeriod}
            subtitle={`Checkout completion rate: ${formatPercent(checkoutCompletionRate)}`}
            pct={
              funnels.bookingsStartedInPeriod > 0
                ? Math.min(
                    (funnels.bookingsCompletedInPeriod / funnels.bookingsStartedInPeriod) * 100,
                    100
                  )
                : 0
            }
            colorClass="bg-emerald-500"
          />
        </div>
      </div>

      {/* Quick Navigation Links */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/bookings">
            <Target className="h-3.5 w-3.5" /> Bookings Console
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/admin/forms">
            <Layers className="h-3.5 w-3.5" /> Partner Forms & Submissions
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* Reusable Micro-Components                                                 */
/* ========================================================================= */

function StatTile({
  label,
  value,
  subtext,
  tone = "neutral",
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
}) {
  const toneColor = {
    neutral: "text-foreground",
    primary: "text-primary",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-rose-500",
  }[tone];

  return (
    <div className="rounded-xl border bg-card/60 p-3 shadow-sm">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold tracking-tight ${toneColor}`}>{value}</p>
      {subtext ? <p className="text-[10px] text-muted-foreground truncate mt-0.5">{subtext}</p> : null}
    </div>
  );
}

function FunnelBarItem({
  label,
  value,
  subtitle,
  pct,
  colorClass,
}: {
  label: string;
  value: number;
  subtitle: string;
  pct: number;
  colorClass: string;
}) {
  return (
    <div className="p-3 rounded-lg border bg-muted/10 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="font-bold text-foreground">{value}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function EmptyChartMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-xs text-muted-foreground">
      <BarChartBig className="h-6 w-6 text-muted-foreground/50" />
      <span>{message}</span>
    </div>
  );
}
