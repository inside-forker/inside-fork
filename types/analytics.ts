import { z, type ZodType } from "zod";
import type { Database, Json } from "@/types/database";

export type AnalyticsEventType =
  Database["public"]["Enums"]["analytics_event_type_enum"];
export type AnalyticsEventSource =
  Database["public"]["Enums"]["analytics_event_source_enum"];
export type AnalyticsUserRole = Database["public"]["Enums"]["user_role"];
export type AdminViewerRole = Extract<
  AnalyticsUserRole,
  "admin" | "super_admin"
>;

export type AnalyticsEventContext = Json;

const analyticsEventTypeValues = [
  "page_view",
  "search_performed",
  "listing_view",
  "listing_published",
  "review_moderated",
  "booking_started",
  "booking_completed",
  "form_submitted",
  "notification_sent",
  "admin_action",
] as const satisfies readonly AnalyticsEventType[];

const analyticsEventSourceValues = [
  "web",
  "dashboard",
  "api",
  "edge",
  "import_job",
] as const satisfies readonly AnalyticsEventSource[];

const userRoleValues = [
  "public_user",
  "business_owner",
  "writer",
  "lister",
  "data_entry",
  "organizer",
  "eo_gate_pass",
  "admin",
  "super_admin",
] as const satisfies readonly AnalyticsUserRole[];

const eventTypeEnum = z.enum(
  analyticsEventTypeValues as unknown as [
    AnalyticsEventType,
    ...AnalyticsEventType[]
  ]
);
const eventSourceEnum = z.enum(
  analyticsEventSourceValues as unknown as [
    AnalyticsEventSource,
    ...AnalyticsEventSource[]
  ]
);
const userRoleEnum = z.enum(
  userRoleValues as unknown as [AnalyticsUserRole, ...AnalyticsUserRole[]]
);

export const analyticsEventTypeEnum = eventTypeEnum;
export const analyticsEventSourceEnum = eventSourceEnum;
export const analyticsUserRoleEnum = userRoleEnum;

const jsonSchema: ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ])
);

export const analyticsEventSchema = z
  .object({
    eventType: eventTypeEnum,
    source: eventSourceEnum.default("web"),
    occurredAt: z.coerce.date().optional(),
    entityType: z.string().max(128).optional(),
    entityId: z.string().max(256).optional(),
    sessionId: z.string().max(256).optional(),
    /** Phase 1 CORE envelope — how the user reached this surface. */
    sourceContext: z.string().max(128).optional(),
    deviceId: z.string().max(256).optional(),
    screen: z.string().max(256).optional(),
    actorId: z.string().uuid().optional(),
    actorRole: userRoleEnum.optional(),
    context: jsonSchema.default({}),
  })
  .strict();

export const analyticsEventBatchSchema = z
  .object({
    events: z.array(analyticsEventSchema).min(1).max(50),
  })
  .strict();

export const analyticsEventRequestSchema = z.union([
  analyticsEventSchema,
  analyticsEventBatchSchema,
]);

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventBatchInput = z.infer<
  typeof analyticsEventBatchSchema
>;
export type AnalyticsEventRequestInput = z.infer<
  typeof analyticsEventRequestSchema
>;

export interface SearchTrendPoint {
  date: string;
  total: number;
  zeroResults: number;
}

export interface SearchTopQuery {
  query: string;
  count: number;
  zeroResultCount: number;
  zeroResultRate: number;
}

export interface SearchAnalyticsSummary {
  totalLast24Hours: number;
  totalInPeriod: number;
  zeroResultCountInPeriod: number;
  zeroResultRateInPeriod: number;
  trend: SearchTrendPoint[];
  topQueries: SearchTopQuery[];
}

export interface ListingsAnalyticsSummary {
  published: number;
  pendingApproval: number;
  drafts: number;
  rejected: number;
  archived: number;
  publishedInPeriod: number;
}

export interface ConversionFunnelSummary {
  getListedSubmissionsInPeriod: number;
  membershipSubmissionsInPeriod: number;
  bookingsStartedInPeriod: number;
  bookingsCompletedInPeriod: number;
  bookingConversionRate: number;
}

export interface TrafficTrendPoint {
  date: string;
  logins: number;
  signups: number;
}

export interface TrafficAnalyticsSummary {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  newUsersInPeriod: number;
  failedLoginAttemptsInPeriod: number;
  retentionRate: number;
  trend: TrafficTrendPoint[];
  lastLoginAt: string | null;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  bookings: number;
}

export interface RevenueTopEvent {
  eventId: number;
  eventName: string;
  revenue: number;
  bookings: number;
}

export interface RevenueAnalyticsSummary {
  grossRevenueInPeriod: number;
  bookingsPaidInPeriod: number;
  averageOrderValueInPeriod: number;
  refundsInPeriod: number;
  pendingPayments: number;
  revenueTrend: RevenueTrendPoint[];
  topEvents: RevenueTopEvent[];
}

/** Phase 1 CORE — platform offer-redemption money loop. */
export interface OfferRedemptionsAnalyticsSummary {
  redemptionCountInPeriod: number;
  billGmvInPeriod: number;
  discountGmvInPeriod: number;
  pendingCount: number;
  voidedCountInPeriod: number;
}

/** Latest row from marketplace_health_daily (Phase 2). Null when never refreshed. */
export interface MarketplaceHealthSummary {
  day: string;
  dau: number;
  wau: number;
  searchZeroResultRate7d: number;
  validatedRedemptions7d: number;
  billGmv7d: number;
  redemptionListingRate30d: number;
  computedAt: string;
}

export interface NotificationChannelBreakdown {
  channel: string;
  sent: number;
  failed: number;
  pending: number;
}

export interface NotificationsAnalyticsSummary {
  sentInPeriod: number;
  failedInPeriod: number;
  pendingNow: number;
  deliverySuccessRate: number;
  averageAttemptCount: number;
  lastDispatchAt: string | null;
  channelBreakdown: NotificationChannelBreakdown[];
}

export type PerformanceMetricType =
  | "lcp"
  | "ttfb"
  | "api_latency"
  | "api_error_rate";

export interface PerformanceMetricSummary {
  metric: PerformanceMetricType;
  label: string;
  average: number | null;
  unit: "ms" | "ratio";
  target?: number;
}

export interface PerformanceAnalyticsSummary {
  metrics: PerformanceMetricSummary[];
  sampleCount: number;
  capturedUntil: string | null;
}

// Date range options for analytics filtering
export type DateRangePreset = "today" | "7d" | "30d" | "90d" | "custom";

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate?: string; // ISO date string for custom range
  endDate?: string; // ISO date string for custom range
}

export interface AdminAnalyticsOverview {
  viewerRole: AdminViewerRole;
  refreshIntervalSeconds: number;
  dateRange?: DateRangeFilter; // Optional date range applied
  search: SearchAnalyticsSummary;
  listings: ListingsAnalyticsSummary;
  funnels: ConversionFunnelSummary;
  traffic: TrafficAnalyticsSummary;
  revenue: RevenueAnalyticsSummary;
  offerRedemptions: OfferRedemptionsAnalyticsSummary;
  marketplaceHealth: MarketplaceHealthSummary | null;
  notifications: NotificationsAnalyticsSummary;
  performance: PerformanceAnalyticsSummary | null;
  generatedAt: string;
}
