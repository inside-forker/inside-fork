// Event Change Request Types
// ===========================
// Types for the organizer event management approval workflow

// Action types for event changes
export type EventChangeAction = "create" | "update" | "delete";

// Status of change requests
export type EventChangeRequestStatus = "pending" | "approved" | "rejected";

// Base event change request from database
export interface EventChangeRequest {
  id: number;
  event_id: number | null;
  organizer_id: string;
  action_type: EventChangeAction;
  proposed_data: EventProposedData | null;
  original_data: EventOriginalData | null;
  status: EventChangeRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Event change request with additional details from the view
export interface EventChangeRequestWithDetails extends EventChangeRequest {
  // Organizer info
  organizer_name: string | null;
  organizer_username: string | null;
  organizer_avatar: string | null;
  // Current event info (for update/delete)
  current_event_name: string | null;
  current_event_slug: string | null;
  current_event_status: string | null;
  // Proposed name
  proposed_event_name: string | null;
  // Reviewer info
  reviewer_name: string | null;
}

// Proposed ticket type (before event is created/approved)
export interface ProposedTicketType {
  id?: number; // Existing ID for updates
  temp_id?: string; // Client-side ID for tracking
  name: string;
  description?: string | null; // Optional ticket description (max 500 chars)
  price: number;
  quantity_available: number | null;
  sale_starts_at: string;
  sale_ends_at: string;
  max_per_person?: number;
}

// Proposed event data structure
export interface EventProposedData {
  name: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category_id?: number | null;
  max_capacity?: number | null;
  is_featured?: boolean;
  is_commission_based?: boolean;
  commission_rate?: number | null;
  status?: "draft" | "published" | "archived";
  require_guest_details?: boolean;
  // Temp images uploaded before approval (stored in temp folder)
  temp_images?: Array<{
    url: string;
    alt_text?: string;
    is_primary?: boolean;
    display_order?: number;
  }>;
  temp_session_id?: string;
  // Proposed ticket types (for new events before approval)
  temp_tickets?: ProposedTicketType[];
}

// Original event data (snapshot before change)
export interface EventOriginalData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category_id: number | null;
  organizer_id: string;
  max_capacity: number | null;
  is_featured: boolean;
  is_commission_based: boolean;
  commission_rate: number | null;
  status: string;
  require_guest_details: boolean | null;
  created_at: string;
  updated_at: string;
}

// Organizer's managed event with pending status
export interface OrganizerManagedEvent {
  event_id: number;
  event_name: string;
  event_slug: string;
  event_description: string | null;
  start_time: string;
  end_time: string;
  event_status: string;
  is_featured: boolean;
  max_capacity: number | null;
  location_name: string | null;
  address: string | null;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  pending_request_id: number | null;
  pending_action_type: EventChangeAction | null;
  has_pending_changes: boolean;
}

// API Response types
export interface SubmitEventChangeResponse {
  success: boolean;
  request_id?: number;
  event_id?: number;
  message?: string;
  requires_approval?: boolean;
  error?: string;
}

export interface ProcessEventChangeResponse {
  success: boolean;
  request_id?: number;
  event_id?: number;
  message?: string;
  error?: string;
}

// Form data for creating/editing events
export interface EventFormData {
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  location_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category_id?: number | null;
  max_capacity?: number | null;
  is_featured?: boolean;
  is_commission_based?: boolean;
  commission_rate?: number | null;
  status?: "draft" | "published" | "archived";
  require_guest_details?: boolean;
  // Temp images for new events (before approval)
  temp_images?: Array<{
    url: string;
    alt_text?: string;
    is_primary?: boolean;
    display_order?: number;
  }>;
  temp_session_id?: string;
  // Proposed ticket types for new events
  temp_tickets?: ProposedTicketType[];
}

// Props for event change request components
export interface EventChangeRequestCardProps {
  request: EventChangeRequestWithDetails;
  onApprove: (requestId: number, notes?: string) => Promise<void>;
  onReject: (requestId: number, notes: string) => Promise<void>;
  isProcessing?: boolean;
}

export interface EventChangeRequestListProps {
  requests: EventChangeRequestWithDetails[];
  onApprove: (requestId: number, notes?: string) => Promise<void>;
  onReject: (requestId: number, notes: string) => Promise<void>;
  isLoading?: boolean;
}

// Filter options for change requests
export interface EventChangeRequestFilters {
  status?: EventChangeRequestStatus | "all";
  action_type?: EventChangeAction | "all";
  organizer_id?: string;
  date_from?: string;
  date_to?: string;
}

// Diff representation for showing changes
export interface EventChangeDiff {
  field: string;
  label: string;
  old_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
  changed: boolean;
}

// Utility type for comparing events
export type ComparableEventFields = keyof Pick<
  EventOriginalData,
  | "name"
  | "description"
  | "start_time"
  | "end_time"
  | "location_name"
  | "address"
  | "category_id"
  | "max_capacity"
  | "is_featured"
  | "status"
  | "require_guest_details"
>;

// Helper to get human-readable action labels
export const EventChangeActionLabels: Record<EventChangeAction, string> = {
  create: "Create Event",
  update: "Update Event",
  delete: "Delete Event",
};

// Helper to get status badge colors
export const EventChangeStatusColors: Record<
  EventChangeRequestStatus,
  { bg: string; text: string; border: string }
> = {
  pending: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/30",
  },
  approved: {
    bg: "bg-green-500/10",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-500/30",
  },
  rejected: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-500/30",
  },
};
