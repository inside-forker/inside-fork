"use client";

import { motion } from "framer-motion";
import { TrendingUp, Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BusinessOwnerAnalytics } from "@/types/business-owner.types";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BusinessAnalyticsChartsProps {
  analytics: BusinessOwnerAnalytics | null;
  loading: boolean;
  formatTimeseriesLabel: (
    date: string,
    granularity: "day" | "week" | "month"
  ) => string;
  chartColors: {
    views: string;
    visitors: string;
    favorites: string;
    contactClicks: string;
    billGmv?: string;
    redemptions?: string;
  };
}

export function BusinessAnalyticsCharts({
  analytics,
  loading,
  formatTimeseriesLabel,
  chartColors,
}: BusinessAnalyticsChartsProps) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Views Over Time
              </CardTitle>
              <CardDescription>Track daily visitor trends</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : analytics && analytics.timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) =>
                        formatTimeseriesLabel(date, analytics.granularity)
                      }
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke={chartColors.views}
                      strokeWidth={2}
                      dot={{ fill: chartColors.views }}
                      name="Views"
                    />
                    <Line
                      type="monotone"
                      dataKey="visitors"
                      stroke={chartColors.visitors}
                      strokeWidth={2}
                      dot={{ fill: chartColors.visitors }}
                      name="Unique Visitors"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Engagement Trends
              </CardTitle>
              <CardDescription>Favorites and contact interactions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : analytics && analytics.timeseries.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) =>
                        formatTimeseriesLabel(date, analytics.granularity)
                      }
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="favorites"
                      stroke={chartColors.favorites}
                      strokeWidth={2}
                      dot={{ fill: chartColors.favorites }}
                      name="Favorites"
                    />
                    <Line
                      type="monotone"
                      dataKey="contactClicks"
                      stroke={chartColors.contactClicks}
                      strokeWidth={2}
                      dot={{ fill: chartColors.contactClicks }}
                      name="Contact Clicks"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mb-8"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Redemption GMV Over Time
            </CardTitle>
            <CardDescription>
              Validated offer redemptions and bill value
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : analytics &&
              analytics.timeseries.some(
                (row) => (row.redemptions ?? 0) > 0 || (row.billGmv ?? 0) > 0,
              ) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) =>
                      formatTimeseriesLabel(date, analytics.granularity)
                    }
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="billGmv"
                    stroke={chartColors.billGmv ?? chartColors.views}
                    strokeWidth={2}
                    name="Bill GMV"
                  />
                  <Line
                    type="monotone"
                    dataKey="redemptions"
                    stroke={chartColors.redemptions ?? chartColors.visitors}
                    strokeWidth={2}
                    name="Redemptions"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No redemption GMV in this period
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {analytics && analytics.branches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Branch Performance</CardTitle>
              <CardDescription>
                Compare performance across your branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.branches}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="branchName" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="views"
                    fill={chartColors.views}
                    radius={[8, 8, 0, 0]}
                    name="Views"
                  />
                  <Bar
                    dataKey="reviews"
                    fill={chartColors.visitors}
                    radius={[8, 8, 0, 0]}
                    name="Reviews"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </>
  );
}
