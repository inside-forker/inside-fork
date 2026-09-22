/**
 * PEEKABOO LISTING SCRAPER CONFIGURATION
 * Centralized configuration for the scraper
 */

import type { ScraperConfig } from "@/types/peekaboo-scraper.types";

export const SCRAPER_CONFIG: ScraperConfig = {
  baseUrl: "https://peekaboo.guru",
  city: "Karachi",
  country: "Pakistan",

  rateLimit: {
    requestsPerSecond: 10, // requests/sec cap
    maxConcurrent: 5, // Default (configurable via admin UI, max 10)
  },

  retry: {
    maxAttempts: 3,
    backoffMs: [1000, 3000, 10000], // Exponential backoff: 1s, 3s, 10s
  },

  storage: {
    bucket: "listing-images",
    publicUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  },
};

// API endpoints
export const API_ENDPOINTS = {
  entities: "/api/v8/entities",
  entityDetail: "/api/v8/entity/detail",
  branches: "/api/v6/entity/branch/_all",
  widget: "/api/v6/entity/widget",
  deals: "/api/v8/entity/deals",
} as const;

// Default coordinates for Karachi (used as fallback)
export const DEFAULT_COORDINATES = {
  lat: 24.8607,
  long: 67.0011,
};

// Image processing settings
export const IMAGE_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  timeout: 30000, // 30 seconds
  skipDuplicates: true,
};

// Batch processing settings
export const BATCH_CONFIG = {
  entitiesPerBatch: 50,
  imagesPerBatch: 10,
  branchesPerBatch: 20,
};

// Sync settings
export const SYNC_CONFIG = {
  defaultStatus: "draft" as const, // All new listings start as draft
  autoPublish: false, // Require manual review
  preserveManualEdits: true,
  createChangeRequests: true, // Create change requests for conflicts
  syncMode: "deals_only" as const,
};
