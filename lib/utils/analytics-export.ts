import type { AdminAnalyticsOverview } from "@/types/analytics";

/**
 * Export analytics overview to CSV format
 * Creates a downloadable CSV file with all metrics organized by category
 */
export function exportAnalyticsToCSV(overview: AdminAnalyticsOverview) {
  const rows: string[][] = [];

  // Add header
  rows.push(["Category", "Metric", "Value", "Period"]);

  // Determine period description
  const period = overview.dateRange
    ? overview.dateRange.preset === "today"
      ? "Today"
      : overview.dateRange.preset === "custom"
      ? overview.dateRange.startDate && overview.dateRange.endDate
        ? `${new Date(
            overview.dateRange.startDate
          ).toLocaleDateString()} - ${new Date(
            overview.dateRange.endDate
          ).toLocaleDateString()}`
        : "Custom Range"
      : overview.dateRange.preset.toUpperCase()
    : "Selected Period";

  // Search Analytics
  rows.push([
    "Search",
    "Total (24h)",
    overview.search.totalLast24Hours.toString(),
    "24 hours",
  ]);
  rows.push([
    "Search",
    "Total",
    overview.search.totalInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Search",
    "Zero Results",
    overview.search.zeroResultCountInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Search",
    "Zero Result Rate",
    `${(overview.search.zeroResultRateInPeriod * 100).toFixed(1)}%`,
    period,
  ]);

  // Offer redemptions (Phase 1 CORE)
  rows.push([
    "Offer Redemptions",
    "Validated count",
    (overview.offerRedemptions?.redemptionCountInPeriod ?? 0).toString(),
    period,
  ]);
  rows.push([
    "Offer Redemptions",
    "Bill GMV (PKR)",
    (overview.offerRedemptions?.billGmvInPeriod ?? 0).toString(),
    period,
  ]);
  rows.push([
    "Offer Redemptions",
    "Discount GMV (PKR)",
    (overview.offerRedemptions?.discountGmvInPeriod ?? 0).toString(),
    period,
  ]);
  rows.push([
    "Offer Redemptions",
    "Pending now",
    (overview.offerRedemptions?.pendingCount ?? 0).toString(),
    "Now",
  ]);
  rows.push([
    "Offer Redemptions",
    "Voided",
    (overview.offerRedemptions?.voidedCountInPeriod ?? 0).toString(),
    period,
  ]);

  // Top Search Queries
  overview.search.topQueries.forEach((query) => {
    rows.push([
      "Search",
      `Query: "${query.query}"`,
      `${query.count} searches`,
      period,
    ]);
  });

  // Listings Analytics
  rows.push([
    "Listings",
    "Published",
    overview.listings.published.toString(),
    "Total",
  ]);
  rows.push([
    "Listings",
    "Pending Approval",
    overview.listings.pendingApproval.toString(),
    "Total",
  ]);
  rows.push([
    "Listings",
    "Drafts",
    overview.listings.drafts.toString(),
    "Total",
  ]);
  rows.push([
    "Listings",
    "Rejected",
    overview.listings.rejected.toString(),
    "Total",
  ]);
  rows.push([
    "Listings",
    "Archived",
    overview.listings.archived.toString(),
    "Total",
  ]);
  rows.push([
    "Listings",
    "Published Recently",
    overview.listings.publishedInPeriod.toString(),
    period,
  ]);

  // Traffic Analytics
  rows.push([
    "Traffic",
    "Daily Active Users",
    overview.traffic.dailyActiveUsers.toString(),
    "Today",
  ]);
  rows.push([
    "Traffic",
    "Weekly Active Users",
    overview.traffic.weeklyActiveUsers.toString(),
    "Last 7 days",
  ]);
  rows.push([
    "Traffic",
    "New Users",
    overview.traffic.newUsersInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Traffic",
    "Failed Login Attempts",
    overview.traffic.failedLoginAttemptsInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Traffic",
    "Retention Rate",
    `${(overview.traffic.retentionRate * 100).toFixed(1)}%`,
    period,
  ]);

  // Revenue Analytics
  rows.push([
    "Revenue",
    "Gross Revenue",
    `PKR ${overview.revenue.grossRevenueInPeriod.toLocaleString()}`,
    period,
  ]);
  rows.push([
    "Revenue",
    "Paid Bookings",
    overview.revenue.bookingsPaidInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Revenue",
    "Average Order Value",
    `PKR ${overview.revenue.averageOrderValueInPeriod.toLocaleString()}`,
    period,
  ]);
  rows.push([
    "Revenue",
    "Refunds",
    `PKR ${overview.revenue.refundsInPeriod.toLocaleString()}`,
    period,
  ]);
  rows.push([
    "Revenue",
    "Pending Payments",
    `PKR ${overview.revenue.pendingPayments.toLocaleString()}`,
    "Current",
  ]);

  // Top Revenue Events
  overview.revenue.topEvents.forEach((event) => {
    rows.push([
      "Revenue",
      `Event: "${event.eventName}"`,
      `PKR ${event.revenue.toLocaleString()} (${event.bookings} bookings)`,
      period,
    ]);
  });

  // Conversion Funnel
  rows.push([
    "Funnel",
    "Get Listed Submissions",
    overview.funnels.getListedSubmissionsInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Funnel",
    "Membership Submissions",
    overview.funnels.membershipSubmissionsInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Funnel",
    "Bookings Started",
    overview.funnels.bookingsStartedInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Funnel",
    "Bookings Completed",
    overview.funnels.bookingsCompletedInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Funnel",
    "Booking Conversion Rate",
    `${(overview.funnels.bookingConversionRate * 100).toFixed(1)}%`,
    period,
  ]);

  // Notifications Analytics
  rows.push([
    "Notifications",
    "Sent",
    overview.notifications.sentInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Notifications",
    "Failed",
    overview.notifications.failedInPeriod.toString(),
    period,
  ]);
  rows.push([
    "Notifications",
    "Pending",
    overview.notifications.pendingNow.toString(),
    "Current",
  ]);
  rows.push([
    "Notifications",
    "Delivery Success Rate",
    `${(overview.notifications.deliverySuccessRate * 100).toFixed(1)}%`,
    period,
  ]);

  // Notification Channels
  overview.notifications.channelBreakdown.forEach((channel) => {
    rows.push([
      "Notifications",
      `Channel: ${channel.channel}`,
      `Sent: ${channel.sent}, Failed: ${channel.failed}, Pending: ${channel.pending}`,
      period,
    ]);
  });

  // Performance Metrics (super_admin only)
  if (overview.performance) {
    overview.performance.metrics.forEach((metric) => {
      rows.push([
        "Performance",
        metric.label,
        metric.average !== null
          ? `${metric.average.toFixed(1)} ${metric.unit}`
          : "No data",
        "Last 24h",
      ]);
    });
    rows.push([
      "Performance",
      "Sample Count",
      overview.performance.sampleCount.toString(),
      "Last 24h",
    ]);
  }

  // Convert to CSV string
  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // Generate filename with date range
  const timestamp = new Date().toISOString().split("T")[0];
  const rangeLabel = overview.dateRange?.preset ?? "7d";
  link.href = url;
  link.download = `analytics-${rangeLabel}-${timestamp}.csv`;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
