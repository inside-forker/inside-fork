/**
 * Business Owner Portal Types
 * Comprehensive type definitions for vendor dashboard features
 */

import { Database } from "./supabase";

// ===================================================================
// DATABASE TYPES (from Supabase)
// ===================================================================

export type ListingChangeRequest =
  Database["public"]["Tables"]["listing_change_requests"]["Row"];
export type ListingChangeRequestInsert =
  Database["public"]["Tables"]["listing_change_requests"]["Insert"];
export type ListingChangeRequestUpdate =
  Database["public"]["Tables"]["listing_change_requests"]["Update"];

export type ListingStatus = Database["public"]["Enums"]["listing_status"];
export type ChangeRequestStatus = "pending" | "approved" | "rejected";
export type ChangeRequestPriority = "priority" | "normal" | "low";

// ===================================================================
// BUSINESS OWNER LISTINGS
// ===================================================================

export interface BusinessOwnerListing {
  id: number;
  name: string;
  slug: string;
  status: ListingStatus;
  category_id: number | null;
  created_at: string;
  total_views: number;
  avg_rating: number;
  total_reviews: number;
  branches_count: number;
  images_count: number;
  deletion_request?: {
    id: number;
    reason: string | null;
    created_at: string;
  } | null;
}

export interface ListingCreatePayload {
  name: string;
  description?: string | null;
  category_id?: number | null;
  address?: string | null;
  phone_number?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  parking_information?: string | null;
  parking_amenities?: string[];
}

export interface ListingUpdatePayload extends Partial<ListingCreatePayload> {
  reason?: string; // Required for major changes
  submit_for_approval?: boolean; // Flag to submit draft for approval
}

// ===================================================================
// CHANGE REQUESTS
// ===================================================================

export interface ListingChangeRequestWithStatus extends ListingChangeRequest {
  is_overdue: boolean;
  sla_status: "Overdue" | "Critical" | "Warning" | "On Track" | null;
  requester_name?: string;
  reviewer_name?: string;
}

export interface CreateChangeRequestPayload {
  listing_id: number;
  change_type:
    | "name_change"
    | "category_change"
    | "address_change"
    | "major_update"
    | "delete_request";
  proposed_data: Record<string, unknown>;
  reason?: string;
  priority?: ChangeRequestPriority;
}

// ===================================================================
// ANALYTICS
// ===================================================================

export interface BusinessOwnerAnalytics {
  timezone: string;
  granularity: "day" | "week" | "month";
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    avgRating: number;
    totalReviews: number;
    favorites: number;
    contactClicks: number;
    /** Phase 1 CORE — validated offer redemptions in range. */
    redemptionCount: number;
    billGmv: number;
    discountGmv: number;
  };
  timeseries: Array<{
    date: string;
    views: number;
    visitors: number;
    favorites: number;
    contactClicks: number;
  }>;
  branches: Array<{
    branchId: number;
    branchName: string;
    views: number;
    avgRating: number;
    reviews: number;
  }>;
  topListings: Array<{
    listingId: number;
    listingName: string;
    views: number;
    rating: number;
    reviews: number;
  }>;
}

export interface ListingAnalyticsSummary {
  listing_id: number;
  listing_name: string;
  date_range: {
    from: string;
    to: string;
  };
  traffic: {
    total_views: number;
    unique_visitors: number;
    views_change: number; // Percentage change from previous period
  };
  engagement: {
    favorites: number;
    contact_clicks: number;
    website_clicks: number;
    menu_views: number;
    directions_clicks: number;
  };
  reviews: {
    avg_rating: number;
    total_reviews: number;
    new_reviews: number;
    rating_trend: number; // +/- change
  };
}

export interface AnalyticsTimeSeriesData {
  date: string;
  views: number;
  unique_visitors: number;
  engagement_score: number;
}

export interface AnalyticsFilters {
  listing_id?: number | "all";
  date_from: string; // ISO date
  date_to: string; // ISO date
  timezone?: string; // Default: Asia/Karachi
  metrics?: ("views" | "engagement" | "reviews")[];
}

// ===================================================================
// REVIEWS MANAGEMENT
// ===================================================================

export interface ReviewWithBranch {
  id: number;
  listing_id: number;
  branch_id: number | null;
  branch_name: string | null;
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  helpful_count: number;
  has_owner_reply: boolean;
}

export interface ReviewReply {
  id: number;
  review_id: number;
  user_id: string;
  content: string;
  status: "pending" | "approved" | "rejected";
  edit_count: number;
  last_edited_at: string | null;
  created_at: string;
  max_edits_allowed: number; // From system_config
  can_edit: boolean; // Computed: edit_count < max AND within 24h
}

export interface ReplyCreatePayload {
  review_id: number;
  content: string;
}

export interface ReplyUpdatePayload {
  content: string;
}

// ===================================================================
// EXPORT/REPORTS
// ===================================================================

export interface ExportReportPayload {
  listing_id?: number | "all";
  report_type: "analytics" | "reviews" | "branches";
  format: "csv" | "pdf" | "excel";
  date_from: string;
  date_to: string;
  filters?: Record<string, unknown>;
}

export interface ExportReportResponse {
  report_id: string;
  download_url: string;
  expires_at: string;
  file_size: number;
  estimated_time?: number; // Seconds
}

// ===================================================================
// API RESPONSE WRAPPERS
// ===================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ===================================================================
// PAGINATION
// ===================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ===================================================================
// FORM VALIDATION
// ===================================================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormErrors {
  errors: ValidationError[];
  message: string;
}

// ===================================================================
// REAL-TIME UPDATES
// ===================================================================

export interface RealtimeChangeRequestUpdate {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: ListingChangeRequest;
  old_record?: ListingChangeRequest;
}

export interface RealtimeReviewUpdate {
  type: "INSERT" | "UPDATE" | "DELETE";
  record: ReviewWithBranch;
  old_record?: ReviewWithBranch;
}

// ===================================================================
// DASHBOARD STATS
// ===================================================================

export interface BusinessOwnerDashboardStats {
  total_listings: number;
  active_listings: number;
  draft_listings: number;
  pending_approvals: number;
  total_views_30d: number;
  total_reviews: number;
  avg_rating: number;
  pending_change_requests: number;
  overdue_change_requests: number;
}

// ===================================================================
// NOTIFICATION PREFERENCES
// ===================================================================

export interface BusinessOwnerNotificationPreferences {
  new_review: boolean;
  listing_approved: boolean;
  listing_rejected: boolean;
  change_request_approved: boolean;
  change_request_rejected: boolean;
  sla_warning: boolean; // 80% of SLA deadline
  sla_overdue: boolean; // SLA deadline passed
  weekly_summary: boolean;
}
