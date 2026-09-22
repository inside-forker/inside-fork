/**
 * PEEKABOO LISTING SCRAPER TYPES
 * Type definitions for Peekaboo API responses and internal structures
 */

// ============================================================================
// PEEKABOO API RESPONSE TYPES
// ============================================================================

export interface PeekabooRichContent {
  cover?: {
    content: string | string[];
    date?: string;
  };
  logo?: {
    content: string;
    date?: string;
  };
  gallery?: {
    content: string[];
    date?: string;
  };
  menu?: {
    content: string[];
    date?: string;
  };
}

export interface PeekabooSocial {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  whatsapp?: string;
  tiktok?: string;
  website?: string;
  email?: string;
}

export interface PeekabooMeta {
  website?: string;
  email?: string;
  parking?: string;
  [key: string]: unknown;
}

export interface PeekabooEntity {
  id: number;
  name: string;
  slug: string;
  description?: string;
  keywords?: string;
  rating?: number;
  contactNumber?: string[];
  richContent?: PeekabooRichContent;
  social?: PeekabooSocial;
  meta?: PeekabooMeta;
  tags?: Array<{ tag: string; tagId?: number; image?: string }>; // Tags are objects with tag property
  package?: string;
  openNow?: boolean;
  stats?: {
    reviewsCount?: number;
    dealsCount?: number;
    [key: string]: unknown;
  };
}

export interface PeekabooEntityListResponse {
  entities: Array<{
    id: number;
    name: string;
    slug: string;
    type: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface PeekabooEntityDetailResponse {
  entity: PeekabooEntity;
  stats?: {
    dealsCount?: number;
    reviewsCount?: number;
    branchesCount?: number;
  };
}

// ============================================================================
// DEALS TYPES
// ============================================================================

export interface PeekabooCardAssociation {
  typeId: number;
  name: string;
  image: string;
  order: number;
  sourceEntityAssociationId: number;
}

export interface PeekabooDeal {
  // Basic deal info
  dealId: number;
  title: string;
  description?: string;
  percentageValue?: number; // Discount percentage
  keywords?: string[];
  poweredBy?: string;

  // Entity info
  targetEntityId: number; // Merchant ID
  targetEntityName: string;
  targetEntityLogo?: string;
  sourceEntityId: number; // Bank ID
  sourceOriginalId: number; // Bank's original ID
  sourceEntityName: string; // Bank name
  sourceEntityDescription?: string;
  sourceEntityContactNumber?: string;
  sourceEntityLogo?: string;

  // Date/time info
  startDate: string; // ISO format
  endDate: string; // ISO format
  expiresIn?: number; // Seconds until expiry

  // Card associations
  associations: PeekabooCardAssociation[]; // Valid cards for this deal

  // Branch/availability
  targetBranches?: Record<string, unknown>;
  onlineAvailable?: boolean;
  orderType?: string; // "OUTLET", "ONLINE", etc.

  // Redemption
  redeemableCount?: number;
  redeemedCount?: number;
  isRedeemable?: boolean;
  redemptionDetails?: {
    isRedeemable: boolean;
    redeemableCount: number;
    redeemedCount: number;
  };

  // User interaction
  likedByMe?: string; // stored as string
  dislikedByMe?: string; // stored as string
  buy?: boolean;
  apply?: boolean;
}

export interface PeekabooDealsResponse {
  deals?: PeekabooDeal[];
}

export interface PeekabooBranch {
  id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  contactNumber?: string;
  timings?: string;
  distance?: string;
  branchOpenNow?: string;
  isVerified?: number;
  locationId?: number;
  everyDayTimngs?: Record<string, string>;
}

export interface PeekabooBranchesResponse {
  branches: PeekabooBranch[];
  totalBranches: number;
  id?: number;
  name?: string;
  description?: string;
  cover?: string;
  logo?: string;
  gallery?: string;
  menu?: string;
}

export interface PeekabooBranchesResponse {
  branches: PeekabooBranch[];
  total: number;
}

export interface PeekabooImage {
  url: string;
  type?: "logo" | "cover" | "gallery";
  order?: number;
}

// ============================================================================
// SCRAPER CONFIGURATION TYPES
// ============================================================================

export interface ScraperConfig {
  baseUrl: string;
  city: string;
  country: string;
  rateLimit: {
    requestsPerSecond: number;
    maxConcurrent: number;
  };
  retry: {
    maxAttempts: number;
    backoffMs: number[];
  };
  storage: {
    bucket: string;
    publicUrl: string;
  };
}

export interface ScraperContext {
  token: string;
  config: ScraperConfig;
  stats: ScraperStats;
}

export interface ScraperStats {
  entitiesProcessed: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
  imagesSynced: number;
  branchesSynced: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  /** Report-mode: entities considered in this run */
  entitiesSeen?: number;
  /** Report-mode: Peekaboo entities with no Inside listing */
  missingInInside?: number;
  /** Report-mode: existing listings with no tracked field/deal diffs */
  existingUnchanged?: number;
  /** Report-mode: existing listings that would change under full sync */
  existingWouldUpdate?: number;
  /** Report-mode: deal rows that would be inserted */
  dealsWouldCreate?: number;
  /** Report-mode: deal rows that would be updated */
  dealsWouldUpdate?: number;
  /** Report-mode: skipped due to manual-edit conflict */
  skippedConflicts?: number;
}

// ============================================================================
// FIELD MAPPING TYPES
// ============================================================================

export interface MappedListing {
  // Required fields
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";

  // Optional fields
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone_number?: string | null;
  website?: string | null;
  email?: string | null;
  category_id?: number | null;

  // Peekaboo ID (dedicated column)
  peekaboo_id: number;

  // Social links
  facebook_url?: string | null;
  instagram_url?: string | null;
  whatsapp_number?: string | null;
  youtube_url?: string | null;
  google_maps_url?: string | null;

  // Metadata (in JSONB - without peekaboo_id)
  custom_attributes: {
    peekaboo_slug: string;
    peekaboo_tags?: Array<{ tag: string; tagId?: number; image?: string }>;
    peekaboo_last_sync: string;
    peekaboo_rating?: number;
    peekaboo_review_count?: number;
    peekaboo_package?: string;
    peekaboo_timings?: string | null; // Store for opening hours parsing
    peekaboo_logo_url?: string | null; // Logo URL (uploaded but NOT in gallery)
  };

  // Admin fields (set by system)
  owner_id?: string | null;
  created_by?: string | null;
  is_featured: boolean;
  show_member_badge: boolean;
  display_order: number;
  parking_information?: string | null;
  parking_amenities?: unknown[];

  // Related data (synced separately but returned together)
  deals?: MappedDeal[]; // Bank/card discounts
}

/**
 * Mapped Deal - Transformed for deals table
 */
export interface MappedDeal {
  // Peekaboo data
  peekabooId: number; // dealId from API
  title: string;
  description?: string | null;

  // Bank info
  bankName: string; // Bank name - looked up in banks table
  sourceEntityId: number; // Bank's Peekaboo ID

  // Discount info
  discountValue: string; // "10%", "15%" etc.
  percentageValue?: number; // Numeric value (10, 15, 20)

  // Date range
  startDate: string; // ISO format
  endDate: string; // ISO format

  // Card details (valid_card_variants expects number[] of typeId values)
  validCards: number[]; // Array of card variant IDs (typeId from associations)
  cardAssociations: Array<{
    typeId: number;
    name: string;
    image: string;
    order: number;
  }>;

  // Availability
  orderType?: string; // "OUTLET", "ONLINE"
  onlineAvailable?: boolean;
}

/**
 * Mapped Branch - Transformed for listing_branches table
 * (Renamed from MappedVenue to reflect new architecture)
 */
export interface MappedBranch {
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  phone_number?: string | null;
  timings?: string | null;
  is_open_now: boolean;
  is_primary: boolean;
  is_verified: boolean;
  distance_from_center?: string | null;
  peekaboo_branch_id: number; // Promoted to top-level for database column
  custom_attributes: {
    peekaboo_city?: string;
    peekaboo_timings?: string;
    peekaboo_distance?: string;
  };
  opening_hours?: Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>;
}

/**
 * @deprecated Use MappedBranch instead
 * Kept for backward compatibility during migration
 */
export type MappedVenue = MappedBranch;

export interface MappedImage {
  image_url: string;
  display_order: number;
  custom_attributes: {
    peekaboo_original_url: string;
    peekaboo_type?: string;
  };
}

/**
 * Pending image (before upload to storage)
 * Used to defer image uploads until after listing insert succeeds
 */
export interface PendingImage {
  original_url: string;
  type: "cover" | "gallery" | "menu" | "logo";
  display_order: number;
  subfolder?: "menu" | "logo" | null;
}

// ============================================================================
// SYNC ENGINE TYPES
// ============================================================================

export type SyncAction =
  | "create"
  | "update"
  | "skip"
  | "conflict"
  | "would_create"
  | "would_update"
  | "unchanged";

export interface SyncDecision {
  action: SyncAction;
  reason: string;
  hasManualEdits: boolean;
  existingListingId?: number;
}

export interface SyncResult {
  peekabooId: number;
  action: SyncAction;
  listingId?: number;
  success: boolean;
  error?: string;
  details: {
    imagesProcessed?: number;
    branchesProcessed?: number;
    dealsProcessed?: number; // Add deals count
    categoryMapped?: boolean;
    /** Field-level diffs for report mode (and conflict tracking) */
    changes?: Record<string, { old: unknown; new: unknown }>;
    dealsWouldCreate?: number;
    dealsWouldUpdate?: number;
  };
}

export interface SyncReport {
  summary: ScraperStats;
  results: SyncResult[];
  conflicts: Array<{
    peekabooId: number;
    listingId: number;
    changes: Record<string, { old: unknown; new: unknown }>;
  }>;
  errors: Array<{
    peekabooId: number;
    error: string;
    stack?: string;
  }>;
}

// ============================================================================
// CATEGORY MAPPING TYPES
// ============================================================================

export interface CategoryMapping {
  peekabooTag: string;
  insideKarachiCategoryId: number;
  confidence: "high" | "medium" | "low";
}

export interface CategoryMapperResult {
  categoryId: number | null;
  mappedTags: string[];
  unmappedTags: string[];
  confidence: "high" | "medium" | "low" | "none";
}

// ============================================================================
// IMAGE PROCESSING TYPES
// ============================================================================

export interface ImageDownloadResult {
  success: boolean;
  supabaseUrl?: string;
  originalUrl: string;
  error?: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface ImageProcessingOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  timeout?: number;
  skipDuplicates?: boolean;
  listingId?: number; // For organizing images by listing folder
  subFolder?: "menu" | "logo" | null; // Optional subfolder (e.g. "menu", "logo")
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

export class AuthenticationError extends ScraperError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTH_ERROR", details);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends ScraperError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "RATE_LIMIT", details);
    this.name = "RateLimitError";
  }
}

export class MappingError extends ScraperError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "MAPPING_ERROR", details);
    this.name = "MappingError";
  }
}
