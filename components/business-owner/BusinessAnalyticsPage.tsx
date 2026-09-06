"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  Download,
  Eye,
  Users,
  Star,
  Heart,
  Phone,
  Ticket,
  Banknote,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusinessListings } from "@/hooks/useBusinessListings";
import { useBusinessAnalytics } from "@/hooks/useBusinessAnalytics";
import { PremiumStatCard } from "@/components/admin/PremiumStatCard";
import { subDays, format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
  BUSINESS_OWNER_FILTER_BAR,
} from "./BusinessOwnerPageHeader";

const BusinessAnalyticsCharts = dynamic(
  () =>
    import("@/components/business-owner/analytics/BusinessAnalyticsCharts").then(
      (mod) => mod.BusinessAnalyticsCharts
    ),
  {
    loading: () => <Skeleton className="h-[680px] w-full mb-8" />,
  }
);

interface BusinessAnalyticsPageProps {
  user: User;
}

type DatePreset = "7d" | "30d" | "90d" | "month";

const chartColors = {
  views: "hsl(var(--primary))",
  visitors: "hsl(var(--ring))",
  favorites: "hsl(var(--accent-foreground))",
  contactClicks: "hsl(var(--destructive))",
  billGmv: "hsl(142 76% 36%)",
  redemptions: "hsl(221 83% 53%)",
};

function formatTimeseriesLabel(date: string, granularity: "day" | "week" | "month") {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  if (granularity === "month") {
    return format(parsedDate, "MMM yyyy");
  }

  if (granularity === "week") {
    return `Week of ${format(parsedDate, "MMM d")}`;
  }

  return format(parsedDate, "MMM d");
}

export function BusinessAnalyticsPage(_props: BusinessAnalyticsPageProps) {
  const [selectedListing, setSelectedListing] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">(
    "day",
  );

  // Calculate date range based on preset
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (datePreset) {
      case "7d":
        start = subDays(now, 7);
        break;
      case "30d":
        start = subDays(now, 30);
        break;
      case "90d":
        start = subDays(now, 90);
        break;
      case "month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      default:
        start = subDays(now, 30);
    }

    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  }, [datePreset]);

  const { listings } = useBusinessListings({ limit: 100 });
  const {
    data: analytics,
    loading,
    error,
  } = useBusinessAnalytics({
    listingId: selectedListing === "all" ? null : selectedListing,
    startDate,
    endDate,
    granularity,
  });

  const handleExport = async () => {
    if (!analytics) {
      return;
    }

    const summaryRows = [
      ["Metric", "Value"],
      ["Total Views", analytics.summary.totalViews],
      ["Unique Visitors", analytics.summary.uniqueVisitors],
      ["Average Rating", analytics.summary.avgRating.toFixed(2)],
      ["Total Reviews", analytics.summary.totalReviews],
      ["Favorites", analytics.summary.favorites],
      ["Contact Clicks", analytics.summary.contactClicks],
      ["Redemptions", analytics.summary.redemptionCount],
      ["Bill GMV (PKR)", analytics.summary.billGmv],
      ["Discount GMV (PKR)", analytics.summary.discountGmv],
      ["Unique redeemers", analytics.summary.uniqueRedeemers ?? 0],
      [
        "Repeat redeemer rate",
        `${(((analytics.summary.repeatRedeemerRate ?? 0) * 100).toFixed(1))}%`,
      ],
    ];

    const timeseriesRows = [
      [],
      ["Date", "Views", "Visitors", "Favorites", "Contact Clicks"],
      ...analytics.timeseries.map((row) => [
        row.date,
        row.views,
        row.visitors,
        row.favorites,
        row.contactClicks,
      ]),
    ];

    const csvContent = [...summaryRows, ...timeseriesRows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `business-analytics-${startDate}-to-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <BusinessOwnerPageHeader
        icon={BarChart3}
        title="Analytics"
        description="Track listing performance and customer engagement"
      />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "flex flex-col sm:flex-row sm:flex-wrap gap-4 mb-8",
          BUSINESS_OWNER_FILTER_BAR,
        )}
      >
        <Select value={selectedListing} onValueChange={setSelectedListing}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="All Listings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings</SelectItem>
            {listings.map((listing) => (
              <SelectItem key={listing.id} value={listing.id.toString()}>
                {listing.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={datePreset}
          onValueChange={(v) => setDatePreset(v as DatePreset)}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={granularity}
          onValueChange={(v) => setGranularity(v as typeof granularity)}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          onClick={handleExport}
          className="gap-2"
          disabled={loading || !analytics}
        >
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </motion.div>

      {/* Error State */}
      {error && (
        <Card className="rounded-2xl border border-destructive/30 bg-destructive/5 backdrop-blur-sm mb-8 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 mb-8"
      >
        {loading ? (
          <>
            {[...Array(9)].map((_, i) => (
              <Card key={i} className={cn("p-6", BUSINESS_OWNER_CARD_SURFACE)}>
                <Skeleton className="h-20 w-full" />
              </Card>
            ))}
          </>
        ) : analytics ? (
          <>
            <PremiumStatCard
              title="Total Views"
              value={analytics.summary.totalViews.toLocaleString()}
              icon={Eye}
              color="blue"
              delay={0.1}
            />
            <PremiumStatCard
              title="Unique Visitors"
              value={analytics.summary.uniqueVisitors.toLocaleString()}
              icon={Users}
              color="green"
              delay={0.2}
            />
            <PremiumStatCard
              title="Avg Rating"
              value={analytics.summary.avgRating.toFixed(1)}
              icon={Star}
              color="orange"
              delay={0.3}
            />
            <PremiumStatCard
              title="Total Reviews"
              value={analytics.summary.totalReviews}
              icon={Star}
              color="purple"
              delay={0.4}
            />
            <PremiumStatCard
              title="Favorites"
              value={analytics.summary.favorites}
              icon={Heart}
              color="pink"
              delay={0.5}
            />
            <PremiumStatCard
              title="Contact Clicks"
              value={analytics.summary.contactClicks}
              icon={Phone}
              color="emerald"
              delay={0.6}
            />
            <PremiumStatCard
              title="Redemptions"
              value={analytics.summary.redemptionCount.toLocaleString()}
              icon={Ticket}
              color="blue"
              delay={0.7}
            />
            <PremiumStatCard
              title="Bill GMV"
              value={`Rs ${Math.round(analytics.summary.billGmv).toLocaleString()}`}
              icon={Banknote}
              color="green"
              delay={0.8}
            />
            <PremiumStatCard
              title="Discount given"
              value={`Rs ${Math.round(analytics.summary.discountGmv).toLocaleString()}`}
              icon={Banknote}
              color="orange"
              delay={0.9}
            />
            <PremiumStatCard
              title="Repeat redeemer %"
              value={`${Math.round((analytics.summary.repeatRedeemerRate ?? 0) * 100)}%`}
              icon={Users}
              color="purple"
              delay={1.0}
            />
          </>
        ) : null}
      </motion.div>

      {analytics?.categoryBenchmark?.privacyFloorMet ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className={cn(BUSINESS_OWNER_CARD_SURFACE)}>
            <CardHeader>
              <CardTitle>Vs category peers</CardTitle>
              <CardDescription>
                Median among {analytics.categoryBenchmark.peerListingCount}{" "}
                peer listings in your categories (min 25 with redemptions).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Your bill GMV</p>
                <p className="text-2xl font-bold">
                  Rs{" "}
                  {Math.round(
                    analytics.categoryBenchmark.yourBillGmv,
                  ).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Category median: Rs{" "}
                  {Math.round(
                    analytics.categoryBenchmark.medianBillGmv ?? 0,
                  ).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your redemptions</p>
                <p className="text-2xl font-bold">
                  {analytics.categoryBenchmark.yourRedemptionCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Category median:{" "}
                  {Math.round(
                    analytics.categoryBenchmark.medianRedemptionCount ?? 0,
                  ).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      <BusinessAnalyticsCharts
        analytics={analytics}
        loading={loading}
        formatTimeseriesLabel={formatTimeseriesLabel}
        chartColors={chartColors}
      />

      {/* Top Listings */}
      {analytics && analytics.topListings.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8"
        >
          <Card className="rounded-2xl border border-border/50 bg-background/70 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle>Top Performing Listings</CardTitle>
              <CardDescription>
                Your best listings in this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topListings.map((listing, index) => (
                  <div
                    key={listing.listingId}
                    className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/40 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{listing.listingName}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {listing.views.toLocaleString()} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            {listing.rating.toFixed(1)} ({listing.reviews})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
