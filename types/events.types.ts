// Admin event type matching events_with_details view (snake_case)
export type AdminEvent = {
  event_id: number;
  event_name: string;
  event_slug: string;
  event_description: string | null;
  start_time: string;
  end_time: string;
  event_status: string;
  organizer_id: string;
  organizer_name: string | null;
  organizer_avatar: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category_id: number | null;
  max_capacity: number | null;
  is_featured: boolean;
  scanning_mode?: "single" | "multi_gate";
  total_gates?: number;
  created_at: string;
  updated_at: string;
  images?: EventImage[];
};
import { Database } from "./supabase";

// Event-specific types from the events_with_details view
export type EventWithDetails =
  Database["public"]["Views"]["events_with_details"]["Row"];

// Individual event type
export type Event = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  organizer_id: string;
  organizer_name: string | null;
  organizer_avatar: string | null;
  // Native event location
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  scanning_mode?: "single" | "multi_gate";
  total_gates?: number;
  // Editorial feature flags exposed from events_with_details
  is_featured?: boolean | null;
  featured_rank?: number | null;
  images?: EventImage[];
};

// Lightweight event shape used on home/preview lists.
export type EventPreview = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  start_time: string;
  end_time: string;
  // some sources return a listing object, others return listing_name/listing_address
  listing?: { name?: string; address?: string | null } | null;
  listing_name?: string | null;
  listing_address?: string | null;
  ticket_types?: { name: string; price: number }[];
  // Pre-formatted date strings for hydration safety
  formatted_date?: {
    date: string;
    time: string;
    full: string;
  };
};

export type EventImage = {
  id: number;
  event_id: number;
  url: string;
  alt_text: string | null;
  is_primary: boolean | null;
  display_order: number | null;
  created_at?: string | null;
};

// Actual ticket type from database (matching your current schema)
export type TicketType = {
  id: number;
  event_id: number;
  name: string;
  description?: string | null;
  price: number;
  quantity_available: number | null;
  sale_starts_at: string;
  sale_ends_at: string;
  max_per_person: number | null;
};

// Event page props
export interface EventPageProps {
  params: {
    slug: string;
  };
}

// Component props for event-specific components
export interface EventHeroProps {
  event: Event;
  images: string[];
  withTopMargin?: boolean;
}

export interface EventTicketSectionProps {
  event: Event;
  ticketTypes: TicketType[];
}

export interface EventOrganizerProps {
  event: Event;
}

export interface EventLocationProps {
  event: Event;
}

export interface SimilarEventsCarouselProps {
  similarEvents: Event[];
  currentEventId: number;
}

// Admin component interfaces
export interface EventsTableProps {
  events: AdminEvent[];
  isLoading: boolean;
  onEditEvent: (event: AdminEvent) => void;
  onViewEvent: (event: AdminEvent) => void;
  onDeleteEvent: (event: AdminEvent) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface TicketManagementProps {
  eventId: number;
}

export interface TicketFormData {
  name: string;
  description: string;
  price: string;
  quantity_available: string;
  sale_starts_at: string;
  sale_ends_at: string;
  max_per_person: string;
}
