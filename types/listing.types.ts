import { Database } from "./supabase";

export type Listing = Database["public"]["Tables"]["listings"]["Row"] & {
  category_name?: string | null;
  match_stem?: string | null;
  duplicate_role?: "branch_copy" | "original_parent" | string | null;
  /** All category IDs for this listing (primary first). category_id remains primary. */
  category_ids?: number[];
  // Social Links
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  youtube_url?: string | null;
  google_maps_url?: string | null;
};
export interface ListingImage {
  id: number;
  listing_id: number;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface ListingModalProps {
  listing: Listing | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (listingData: Partial<Listing>) => Promise<Listing | null>;
  hideAdminFields?: boolean;
  currentUserId?: string | null;
  activeEditors?: {
    userId: string;
    fullName: string;
  }[];
}
// Listing-related types for Inside Karachi
// Organized for clarity and future extensibility

/**
 * Opening Hours Interface
 *
 * DATABASE CONVENTION: day_of_week uses 0=Sunday, 1=Monday, ..., 6=Saturday
 * EDITOR CONVENTION: Monday-first display for Pakistan market (0=Monday in UI)
 *
 * Use helper functions to transform between conventions:
 * - dbDayToEditorIndex(): Convert DB day_of_week to editor array index
 * - editorIndexToDbDay(): Convert editor array index to DB day_of_week
 */
export interface OpeningHour {
  id?: number; // Optional for new entries
  listing_id?: number;
  branch_id?: number | null; // FK to listing_branches (null for legacy single-location listings)
  dayOfWeek: number; // Database value: 0=Sunday, 1=Monday, ..., 6=Saturday
  openTime: string | null; // "HH:mm" format
  closeTime: string | null; // "HH:mm" format
  isClosed: boolean;
}

/**
 * Day mapping constants for clarity and consistency
 */
export const DAY_NAMES_DB_ORDER = [
  "Sunday", // 0
  "Monday", // 1
  "Tuesday", // 2
  "Wednesday", // 3
  "Thursday", // 4
  "Friday", // 5
  "Saturday", // 6
] as const;

export const DAY_NAMES_MONDAY_FIRST = [
  "Monday", // Editor index 0 -> DB day_of_week 1
  "Tuesday", // Editor index 1 -> DB day_of_week 2
  "Wednesday", // Editor index 2 -> DB day_of_week 3
  "Thursday", // Editor index 3 -> DB day_of_week 4
  "Friday", // Editor index 4 -> DB day_of_week 5
  "Saturday", // Editor index 5 -> DB day_of_week 6
  "Sunday", // Editor index 6 -> DB day_of_week 0
] as const;

/**
 * Convert database day_of_week (0=Sunday) to editor array index (0=Monday)
 * @param dbDay - Database day_of_week value (0-6, where 0=Sunday)
 * @returns Editor array index (0-6, where 0=Monday)
 *
 * Examples:
 * - dbDay 0 (Sunday) -> returns 6 (last in editor)
 * - dbDay 1 (Monday) -> returns 0 (first in editor)
 * - dbDay 6 (Saturday) -> returns 5
 */
export function dbDayToEditorIndex(dbDay: number): number {
  if (dbDay < 0 || dbDay > 6) {
    throw new Error(`Invalid database day: ${dbDay}. Must be 0-6.`);
  }
  // Sunday (0) becomes 6, Monday (1) becomes 0, etc.
  return dbDay === 0 ? 6 : dbDay - 1;
}

/**
 * Convert editor array index (0=Monday) to database day_of_week (0=Sunday)
 * @param editorIndex - Editor array index (0-6, where 0=Monday)
 * @returns Database day_of_week value (0-6, where 0=Sunday)
 *
 * Examples:
 * - editorIndex 0 (Monday in editor) -> returns 1 (Monday in DB)
 * - editorIndex 6 (Sunday in editor) -> returns 0 (Sunday in DB)
 * - editorIndex 5 (Saturday in editor) -> returns 6 (Saturday in DB)
 */
export function editorIndexToDbDay(editorIndex: number): number {
  if (editorIndex < 0 || editorIndex > 6) {
    throw new Error(`Invalid editor index: ${editorIndex}. Must be 0-6.`);
  }
  // Monday (0) becomes 1, Sunday (6) becomes 0, etc.
  return editorIndex === 6 ? 0 : editorIndex + 1;
}

// Custom Attributes Types
export interface CustomAmenity {
  id: string;
  name: string;
  category: "dining" | "services" | "facilities" | "accessibility" | "other";
  icon?: string;
  description?: string;
}

export interface CustomTag {
  id: string;
  name: string;
  color?: string;
  category?: string;
}

export interface CustomAttributes {
  amenities?: CustomAmenity[];
  tags?: CustomTag[];
  additional_info?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  custom_category?: string | null;
  metadata?: {
    last_updated?: string;
    updated_by?: string;
  };
}

export interface CustomAttributesEditorProps {
  customAttributes: CustomAttributes | null;
  onChange: (attributes: CustomAttributes) => void;
  isLoading?: boolean;
  listingId?: number;
}

// Social Links Types
export interface SocialLinks {
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  youtube_url?: string | null;
  google_maps_url?: string | null;
}

// Listing Form Data Types
export interface ListingFormData {
  name: string;
  description: string;
  address: string;
  phone_number: string;
  email: string;
  website: string;
  latitude: string;
  longitude: string;
  place_id?: string;
  /** Primary category (also first entry in category_ids). */
  category_id: string;
  /** All selected category IDs as strings (multi-subcategory). */
  category_ids: string[];
  custom_category: string;
  is_featured: boolean;
  status: Database["public"]["Enums"]["listing_status"];
  show_member_badge: boolean;
  display_order: string;
  custom_attributes: CustomAttributes | null;
  owner_id: string;
  menu_pdf_url: string | null;
  parking_information: string | null;
  parking_amenities: string[] | null;
  // Social Links
  facebook_url: string;
  instagram_url: string;
  whatsapp_number: string;
  youtube_url: string;
  google_maps_url: string;
}

// ============================================================================
// LISTING BRANCHES (Phase 3 - Multiple Business Locations)
// ============================================================================

/**
 * Listing Branch - Physical location of a business
 * NOT to be confused with venues (which are for events)
 */
export interface ListingBranch {
  id: number;
  listing_id: number;
  name: string; // e.g., "Do Darya Branch", "Gulberg Branch"
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  phone_number?: string | null;
  timings?: string | null; // Operating hours (e.g., "09:00-22:00")
  is_open_now: boolean;
  is_primary: boolean; // Only ONE primary branch per listing
  is_verified: boolean; // From Peekaboo API
  distance_from_center?: string | null; // e.g., "5.2 km from city center"
  peekaboo_branch_id?: number | null; // Source ID from Peekaboo (for sync & deduplication)
  custom_attributes: {
    peekaboo_city?: string;
    peekaboo_timings?: string;
    peekaboo_distance?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Listing with branches - Extended type for listing detail pages
 */
export interface ListingWithBranches extends Listing {
  branches?: ListingBranch[];
  primary_branch?: ListingBranch;
}

/**
 * Branch Form Data - for add/edit operations
 */
export interface BranchFormData {
  id?: number;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number | string;
  longitude: number | string;
  phone_number?: string;
  is_primary: boolean;
  is_verified: boolean;
  distance_from_center?: string;
  custom_attributes?: Record<string, unknown>;
}

/**
 * Branch with Opening Hours - Extended type for branch management
 */
export interface BranchWithHours extends ListingBranch {
  opening_hours?: OpeningHour[];
}

/**
 * Listing capacity / per-person pricing fields used by data-entry UI
 */
export interface ListingCapacityFields {
  min_price_per_person: number | null;
  max_price_per_person: number | null;
  min_guest_capacity: number | null;
  max_guest_capacity: number | null;
}

export interface ListingCapacityRow extends ListingCapacityFields {
  id: number;
  name: string;
  slug: string;
  status: Database["public"]["Enums"]["listing_status"];
  category_id: number | null;
  category_ids?: number[];
  category_name?: string | null;
  address?: string | null;
  description?: string | null;
  phone_number?: string | null;
  website?: string | null;
  image_url?: string | null;
  image_alt?: string | null;
}

export type ListingCapacityCompleteness = "all" | "incomplete" | "complete";

