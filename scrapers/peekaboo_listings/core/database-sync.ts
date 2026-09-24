// Syncs scraped listings (and their branches/images) to the database by peekaboo_id.

import { query } from "@/lib/db";
import { deleteFile, getKeyFromPublicUrl } from "@/lib/storage/spaces";
import type { Database } from "@/types/database";
import type {
  MappedListing,
  MappedBranch,
  MappedImage,
  SyncResult,
  SyncAction,
} from "@/types/peekaboo-scraper.types";
import type { ListingBranch } from "@/types/listing.types";
import {
  diffMappedListing,
  type ListingDiffRow,
} from "./listing-diff";

type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

// ============================================================================
// TYPES
// ============================================================================

export type SyncMode = "report" | "create_missing" | "full" | "deals_only";

export interface SyncOptions {
  /**
   * If true, automatically publish listings (status = 'published')
   * If false, keep as draft for manual review
   */
  autoPublish?: boolean;

  /**
   * If true, preserve manual edits (skip update if listing has been modified)
   * If false, always overwrite with Peekaboo data
   */
  preserveManualEdits?: boolean;

  /**
   * If true, create change requests for existing listings instead of direct updates
   */
  createChangeRequests?: boolean;

  /**
   * report: scrape + compare only (no writes)
   * create_missing: create drafts for unknown peekaboo_id only
   * deals_only: refresh deals only on existing listings
   * full: scrape-and-upsert listing metadata (with admin field protections)
   */
  syncMode?: SyncMode;
}

export interface ConflictInfo {
  field: string;
  currentValue: unknown;
  incomingValue: unknown;
}

export interface SyncDecisionResult {
  action: SyncAction;
  listingId?: number;
  conflicts: ConflictInfo[];
  hasManualEdits: boolean;
}

// ============================================================================
// SQL HELPERS
// ============================================================================

const LISTING_COLUMNS = [
  "name",
  "slug",
  "description",
  "address",
  "latitude",
  "longitude",
  "phone_number",
  "website",
  "peekaboo_id",
  "email",
  "category_id",
  "facebook_url",
  "instagram_url",
  "whatsapp_number",
  "youtube_url",
  "google_maps_url",
  "status",
  "is_featured",
  "show_member_badge",
  "display_order",
  "parking_information",
  "parking_amenities",
  "custom_attributes",
] as const;

/** Admin-controlled fields — never overwrite from Peekaboo scrape defaults on update. */
const PRESERVE_ON_UPDATE = [
  "is_featured",
  "show_member_badge",
  "display_order",
  "category_id",
] as const;

function listingValues(
  listingData: ListingInsert,
  columns: readonly string[] = LISTING_COLUMNS,
): unknown[] {
  return columns.map(
    (col) => (listingData as Record<string, unknown>)[col],
  );
}

// ============================================================================
// DATABASE SYNC CLASS
// ============================================================================

export class DatabaseSync {
  private static bankCache: Map<string, number> = new Map(); // Cache bank name -> ID lookups
  private options: Required<SyncOptions>;
  private uploadedImageUrls: string[] = []; // Track uploaded images for rollback

  constructor(options: SyncOptions = {}) {
    this.options = {
      autoPublish: options.autoPublish ?? false,
      preserveManualEdits: options.preserveManualEdits ?? true,
      createChangeRequests: options.createChangeRequests ?? false,
      syncMode: options.syncMode ?? "report",
    };
  }

  /**
   * Initialize the sync module (no-op — query() uses the shared Postgres pool).
   * Kept for backward compatibility with callers that call init() before use.
   */
  async init(): Promise<void> {
    // Nothing to initialize — lib/db's `query()` manages its own pooled connections.
  }

  /**
   * Sync a single listing with all its branches and images
   * OPTIMIZED: Images uploaded AFTER listing insert to prevent orphans
   */
  async syncListing(
    listing: MappedListing,
    branches: MappedBranch[],
    pendingImages: import("@/types/peekaboo-scraper.types").PendingImage[],
    deals?: MappedListing["deals"],
  ): Promise<SyncResult> {
    const peekabooId = listing.peekaboo_id;
    this.uploadedImageUrls = []; // Reset for this listing

    try {
      // Step 1: Check if listing already exists
      const decision = await this.decideSyncAction(listing);

      // report: scrape + compare only — never write
      if (this.options.syncMode === "report") {
        return this.buildReportResult(listing, decision, deals);
      }

      // create_missing: only insert unknown peekaboo_id as drafts; skip existing
      if (this.options.syncMode === "create_missing") {
        if (decision.action !== "create") {
          return {
            peekabooId,
            action: "skip",
            listingId: decision.listingId,
            success: true,
            details: {
              imagesProcessed: 0,
              branchesProcessed: 0,
              categoryMapped: false,
              dealsProcessed: 0,
            },
          };
        }

        const listingId = await this.upsertListing(listing, decision);
        const imagesProcessed = await this.uploadAndLinkImages(
          listingId,
          pendingImages,
          listing.peekaboo_id,
        );
        const branchIdMap = await this.syncBranches(listingId, branches);
        await this.syncOpeningHours(listingId, listing, branches, branchIdMap);
        let dealsProcessed = 0;
        if (deals && deals.length > 0) {
          dealsProcessed = await this.syncDeals(listingId, deals);
        }
        this.uploadedImageUrls = [];
        return {
          peekabooId,
          action: "create",
          listingId,
          success: true,
          details: {
            imagesProcessed,
            branchesProcessed: branchIdMap.size,
            dealsProcessed,
            categoryMapped: listing.category_id !== null,
          },
        };
      }

      // deals_only: never create listings; only refresh deals on existing rows.
      // Manual-edit conflicts are ignored here because listing metadata is not written.
      if (this.options.syncMode === "deals_only") {
        if (decision.action === "create" || !decision.listingId) {
          console.log(
            `[SYNC] deals_only: skipping create for peekaboo_id=${peekabooId}`,
          );
          return {
            peekabooId,
            action: "skip",
            success: true,
            details: {
              imagesProcessed: 0,
              branchesProcessed: 0,
              categoryMapped: false,
              dealsProcessed: 0,
            },
          };
        }

        const listingId = decision.listingId;
        let dealsProcessed = 0;
        if (deals && deals.length > 0) {
          dealsProcessed = await this.syncDeals(listingId, deals);
        }
        await this.bumpPeekabooLastSync(listingId);

        return {
          peekabooId,
          action: "update",
          listingId,
          success: true,
          details: {
            imagesProcessed: 0,
            branchesProcessed: 0,
            dealsProcessed,
            categoryMapped: false,
          },
        };
      }

      // skip = intentionally ignored; conflict = manual edits preserved (do not overwrite)
      if (decision.action === "skip" || decision.action === "conflict") {
        return {
          peekabooId,
          action: decision.action,
          listingId: decision.listingId,
          success: true,
          details: {
            imagesProcessed: 0,
            branchesProcessed: 0,
            categoryMapped: false,
          },
        };
      }

      // Step 2: Upsert listing FIRST (before any images)
      const listingId = await this.upsertListing(listing, decision);

      // Step 3: Upload images AFTER listing exists (prevents orphans)
      const imagesProcessed = await this.uploadAndLinkImages(
        listingId,
        pendingImages,
        listing.peekaboo_id,
      );

      // Step 4: Sync branches
      const branchIdMap = await this.syncBranches(listingId, branches);

      // Step 5: Sync opening hours
      await this.syncOpeningHours(listingId, listing, branches, branchIdMap);

      // Step 6: Sync deals
      let dealsProcessed = 0;
      if (deals && deals.length > 0) {
        dealsProcessed = await this.syncDeals(listingId, deals);
      }

      // Success - clear rollback tracking
      this.uploadedImageUrls = [];

      return {
        peekabooId,
        action: decision.action,
        listingId,
        success: true,
        details: {
          imagesProcessed,
          branchesProcessed: branchIdMap.size,
          dealsProcessed, // Add deals to result
          categoryMapped: listing.category_id !== null,
        },
      };
    } catch (error) {
      const syncError = error as Error;
      console.error(`[SYNC] Failed to sync listing ${peekabooId}:`, syncError);

      // ROLLBACK: Clean up any uploaded images
      await this.rollbackImages();

      return {
        peekabooId,
        action: "skip",
        success: false,
        error: syncError.message,
        details: {
          imagesProcessed: 0,
          branchesProcessed: 0,
          categoryMapped: false,
        },
      };
    }
  }

  /**
   * Report-mode result: no DB writes. Compare mapped Peekaboo data to Inside.
   */
  private async buildReportResult(
    listing: MappedListing,
    decision: SyncDecisionResult,
    deals?: MappedListing["deals"],
  ): Promise<SyncResult> {
    const peekabooId = listing.peekaboo_id;

    if (decision.action === "create" || !decision.listingId) {
      return {
        peekabooId,
        action: "would_create",
        success: true,
        details: {
          imagesProcessed: 0,
          branchesProcessed: 0,
          categoryMapped: listing.category_id !== null,
          dealsWouldCreate: deals?.length ?? 0,
          dealsWouldUpdate: 0,
        },
      };
    }

    if (decision.action === "conflict") {
      return {
        peekabooId,
        action: "conflict",
        listingId: decision.listingId,
        success: true,
        details: {
          imagesProcessed: 0,
          branchesProcessed: 0,
          categoryMapped: false,
        },
      };
    }

    const existing = await this.loadListingForDiff(decision.listingId);
    const changes = existing
      ? diffMappedListing(existing, listing)
      : {};

    const existingDeals = await this.loadExistingDealKeys(decision.listingId);
    let wouldCreate = 0;
    let wouldUpdate = 0;
    const existingKeySet = new Set(
      existingDeals.map(
        (d) =>
          `${(d.title || "").trim().toLowerCase()}::${d.bank_id ?? "null"}`,
      ),
    );
    for (const deal of deals ?? []) {
      const bankId = await this.getBankId(deal.bankName);
      const key = `${(deal.title || "").trim().toLowerCase()}::${bankId ?? "null"}`;
      if (existingKeySet.has(key)) wouldUpdate += 1;
      else wouldCreate += 1;
    }

    if (
      wouldCreate > 0 ||
      wouldUpdate > 0 ||
      (deals?.length ?? 0) !== existingDeals.length
    ) {
      changes.dealCount = {
        old: existingDeals.length,
        new: deals?.length ?? 0,
      };
    }

    const hasChanges = Object.keys(changes).length > 0;
    return {
      peekabooId,
      action: hasChanges ? "would_update" : "unchanged",
      listingId: decision.listingId,
      success: true,
      details: {
        imagesProcessed: 0,
        branchesProcessed: 0,
        categoryMapped: false,
        changes: hasChanges ? changes : undefined,
        dealsWouldCreate: wouldCreate,
        dealsWouldUpdate: wouldUpdate,
      },
    };
  }

  private async loadListingForDiff(
    listingId: number,
  ): Promise<ListingDiffRow | null> {
    try {
      const { rows } = await query(
        `SELECT name, description, address, phone_number, website, email,
                facebook_url, instagram_url, whatsapp_number, youtube_url
         FROM listings WHERE id = $1 LIMIT 1`,
        [listingId],
      );
      return (rows[0] as ListingDiffRow) || null;
    } catch (error) {
      console.warn(`[SYNC] Failed to load listing ${listingId} for diff:`, error);
      return null;
    }
  }

  private async loadExistingDealKeys(
    listingId: number,
  ): Promise<Array<{ title: string; bank_id: number | null }>> {
    try {
      const { rows } = await query(
        `SELECT title, bank_id FROM deals WHERE listing_id = $1`,
        [listingId],
      );
      return rows as Array<{ title: string; bank_id: number | null }>;
    } catch (error) {
      console.warn(`[SYNC] Failed to load deals for listing ${listingId}:`, error);
      return [];
    }
  }

  /**
   * Rollback uploaded images on sync failure
   * Actually deletes from storage, not just logging
   */
  private async rollbackImages(): Promise<void> {
    if (this.uploadedImageUrls.length === 0) return;

    console.log(
      `[SYNC] Rolling back ${this.uploadedImageUrls.length} uploaded images...`,
    );

    // Actually delete from storage
    for (const url of this.uploadedImageUrls) {
      try {
        const key = getKeyFromPublicUrl(url);
        if (key) {
          await deleteFile(key);
          console.log(`[SYNC]   Deleted from storage: ${key}`);
        } else {
          console.warn(`[SYNC]   Cannot extract path from URL: ${url}`);
        }
      } catch (error) {
        console.error(`[SYNC]   Error deleting ${url}:`, error);
      }
    }

    this.uploadedImageUrls = [];
  }

  /**
   * Upload pending images and link to listing
   * CRITICAL: Called AFTER listing insert to prevent orphaned images
   */
  private async uploadAndLinkImages(
    listingId: number,
    pendingImages: import("@/types/peekaboo-scraper.types").PendingImage[],
    peekabooId: number,
  ): Promise<number> {
    if (pendingImages.length === 0) {
      console.log("[SYNC] No images to upload");
      return 0;
    }

    console.log(
      `[SYNC] Uploading ${pendingImages.length} images for listing ${listingId}...`,
    );

    try {
      const { imageProcessor } = await import("../core/image-processor");
      const { BATCH_CONFIG } = await import("../config");

      const uploadResults: import("@/types/peekaboo-scraper.types").ImageDownloadResult[] =
        [];

      for (
        let i = 0;
        i < pendingImages.length;
        i += BATCH_CONFIG.imagesPerBatch
      ) {
        const batch = pendingImages.slice(i, i + BATCH_CONFIG.imagesPerBatch);
        const urls = batch.map((img) => img.original_url);

        const results = await imageProcessor.processImages(
          urls,
          {
            listingId: peekabooId,
            subFolder: batch[0].subfolder || null,
          },
          BATCH_CONFIG.imagesPerBatch,
        );

        uploadResults.push(...results);
      }

      const successfulUploads = uploadResults.filter(
        (r) => r.success && r.supabaseUrl,
      );

      if (successfulUploads.length === 0) {
        throw new Error("All image uploads failed");
      }

      this.uploadedImageUrls = successfulUploads.map((r) => r.supabaseUrl!);

      const imagesToSync: import("@/types/peekaboo-scraper.types").MappedImage[] =
        successfulUploads.map((result, index) => {
          const pending = pendingImages.find(
            (img) => img.original_url === result.originalUrl,
          );

          return {
            image_url: result.supabaseUrl!,
            display_order: pending?.display_order || index,
            custom_attributes: {
              peekaboo_original_url: result.originalUrl,
              peekaboo_type: pending?.type || "gallery",
            },
          };
        });

      const inserted = await this.syncImages(listingId, imagesToSync);

      console.log(
        `[SYNC] Uploaded and linked ${successfulUploads.length} images`,
      );

      return inserted;
    } catch (error) {
      const uploadError = error as Error;
      console.error("[SYNC] Image upload failed:", uploadError);

      await this.rollbackImages();

      throw new Error(`Image upload failed: ${uploadError.message}`);
    }
  }

  /**
   * Decide what action to take for this listing
   */
  private async decideSyncAction(
    listing: MappedListing,
  ): Promise<SyncDecisionResult> {
    const peekabooId = listing.peekaboo_id;

    // Query existing listing by peekaboo_id column
    let existing:
      | {
          id: number;
          updated_at: string;
          custom_attributes: Record<string, unknown>;
          status: string;
          peekaboo_id: number;
        }
      | undefined;

    try {
      const { rows } = await query(
        `SELECT id, updated_at, custom_attributes, status, peekaboo_id
         FROM listings
         WHERE peekaboo_id = $1
         LIMIT 1`,
        [peekabooId],
      );
      existing = rows[0];
    } catch (error) {
      const dbError = error as Error;
      console.error("[SYNC] Error checking existing listing:", dbError);
      throw new Error(`Failed to check existing listing: ${dbError.message}`);
    }

    // No existing listing - CREATE
    if (!existing) {
      return {
        action: "create",
        conflicts: [],
        hasManualEdits: false,
      };
    }

    // Existing listing found - check for conflicts
    const conflicts: ConflictInfo[] = [];
    const customAttrs = existing.custom_attributes as Record<string, unknown>;
    const peekabooLastSync = customAttrs?.peekaboo_last_sync as
      | string
      | undefined;

    // Check if listing was manually edited after last sync
    const hasManualEdits =
      peekabooLastSync &&
      new Date(existing.updated_at) > new Date(peekabooLastSync);

    if (this.options.preserveManualEdits && hasManualEdits) {
      return {
        action: "conflict",
        listingId: existing.id,
        conflicts,
        hasManualEdits: true,
      };
    }

    // UPDATE existing listing
    return {
      action: "update",
      listingId: existing.id,
      conflicts,
      hasManualEdits: false,
    };
  }

  /**
   * Upsert listing (insert or update)
   */
  private async upsertListing(
    listing: MappedListing,
    decision: SyncDecisionResult,
  ): Promise<number> {
    const now = new Date().toISOString();

    // Prepare listing data - properly typed to match the listings table
    const shouldArchiveForMissingCategory =
      this.options.autoPublish && !listing.category_id;

    const listingData: ListingInsert = {
      name: listing.name,
      slug: listing.slug,
      description: listing.description || null,
      address: listing.address || null,
      latitude: listing.latitude || null,
      longitude: listing.longitude || null,
      phone_number: listing.phone_number || null,
      website: listing.website || null,
      peekaboo_id: listing.peekaboo_id,
      email: listing.email || null,
      category_id: listing.category_id || null,
      facebook_url: listing.facebook_url || null,
      instagram_url: listing.instagram_url || null,
      whatsapp_number: listing.whatsapp_number || null,
      youtube_url: listing.youtube_url || null,
      google_maps_url: listing.google_maps_url || null,
      status:
        this.options.syncMode === "create_missing"
          ? "draft"
          : shouldArchiveForMissingCategory
            ? "archived"
            : this.options.autoPublish
              ? "published"
              : listing.status,
      is_featured: listing.is_featured,
      show_member_badge: listing.show_member_badge,
      display_order: listing.display_order,
      parking_information: listing.parking_information || null,
      parking_amenities:
        (listing.parking_amenities as Database["public"]["Tables"]["listings"]["Insert"]["parking_amenities"]) ||
        null,
      // Default for create; update path merges with existing below
      custom_attributes: {
        ...listing.custom_attributes,
        peekaboo_last_sync: now,
      },
    };

    if (decision.action === "create") {
      try {
        const { rows } = await query(
          `INSERT INTO listings (${LISTING_COLUMNS.join(", ")})
           VALUES (${LISTING_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})
           RETURNING id`,
          listingValues(listingData),
        );
        const newId = rows[0].id as number;
        await this.syncListingCategoryJunction(
          newId,
          listing.category_id || null,
        );
        return newId;
      } catch (error) {
        const insertError = error as Error & { code?: string };

        if (insertError.code === "23505") {
          const { rows: existingRows } = await query(
            `SELECT id, custom_attributes FROM listings WHERE peekaboo_id = $1 LIMIT 1`,
            [listing.peekaboo_id],
          );
          const existing = existingRows[0] as
            | { id: number; custom_attributes: Record<string, unknown> | null }
            | undefined;

          if (existing?.id) {
            try {
              listingData.custom_attributes = {
                ...(existing.custom_attributes || {}),
                ...listing.custom_attributes,
                peekaboo_last_sync: now,
              };
              const updateColumns = this.getUpdateColumns();
              await query(
                `UPDATE listings SET ${updateColumns.map((col, i) => `${col} = $${i + 1}`).join(", ")}
                 WHERE id = $${updateColumns.length + 1}`,
                [...listingValues(listingData, updateColumns), existing.id],
              );
            } catch (updateError) {
              throw new Error(
                `Failed to update listing after concurrent insert: ${(updateError as Error).message}`,
              );
            }

            // Do not rewrite category junctions on update — preserve admin curation
            return existing.id;
          }
        }

        throw new Error(`Failed to insert listing: ${insertError.message}`);
      }
    } else {
      // UPDATE existing listing — never clobber admin-controlled fields with
      // Peekaboo defaults. When autoPublish is off, also preserve status so a
      // sync cannot demote published listings back to draft.
      // Merge custom_attributes so admin keys are not wiped.
      const { rows: existingRows } = await query(
        `SELECT custom_attributes FROM listings WHERE id = $1 LIMIT 1`,
        [decision.listingId!],
      );
      const existingAttrs =
        (existingRows[0]?.custom_attributes as Record<string, unknown> | null) ||
        {};
      listingData.custom_attributes = {
        ...existingAttrs,
        ...listing.custom_attributes,
        peekaboo_last_sync: now,
      };

      const updateColumns = this.getUpdateColumns();

      try {
        await query(
          `UPDATE listings SET ${updateColumns.map((col, i) => `${col} = $${i + 1}`).join(", ")}
           WHERE id = $${updateColumns.length + 1}`,
          [...listingValues(listingData, updateColumns), decision.listingId!],
        );
      } catch (error) {
        throw new Error(`Failed to update listing: ${(error as Error).message}`);
      }

      // Preserve existing listing_categories on update (admin may have multi-category)
      return decision.listingId!;
    }
  }

  /** Columns written on UPDATE — excludes admin-preserved fields. */
  private getUpdateColumns(): string[] {
    return LISTING_COLUMNS.filter((col) => {
      if ((PRESERVE_ON_UPDATE as readonly string[]).includes(col)) {
        return false;
      }
      if (col === "status" && !this.options.autoPublish) {
        return false;
      }
      return true;
    });
  }

  /**
   * Shallow-merge peekaboo_last_sync into custom_attributes without replacing other keys.
   */
  private async bumpPeekabooLastSync(listingId: number): Promise<void> {
    const now = new Date().toISOString();
    try {
      await query(
        `UPDATE listings
         SET custom_attributes =
           COALESCE(custom_attributes, '{}'::jsonb) || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify({ peekaboo_last_sync: now }), listingId],
      );
    } catch (error) {
      console.warn(
        `[SYNC] Failed to bump peekaboo_last_sync for listing ${listingId}:`,
        error,
      );
    }
  }

  private async syncListingCategoryJunction(
    listingId: number,
    categoryId: number | null,
  ): Promise<void> {
    try {
      const { syncListingCategories } = await import(
        "@/lib/listings/sync-listing-categories"
      );
      await syncListingCategories(
        listingId,
        categoryId != null ? [categoryId] : [],
        categoryId,
      );
    } catch (error) {
      console.error(
        `[SYNC] Failed to sync listing_categories for listing ${listingId}:`,
        error,
      );
    }
  }

  /**
   * Sync branches to listing_branches table
   * Strategy: Delete all existing branches and insert new ones
   * Returns: Map of branch names to their IDs for opening hours sync
   */
  private async syncBranches(
    listingId: number,
    branches: MappedBranch[],
  ): Promise<Map<string | number, number>> {
    const branchIdMap = new Map<string | number, number>();

    if (branches.length === 0) {
      return branchIdMap;
    }

    // Step 1: Delete existing branches for this listing
    try {
      await query(`DELETE FROM listing_branches WHERE listing_id = $1`, [
        listingId,
      ]);
    } catch (error) {
      // CRITICAL: If we cannot delete old branches, we MUST NOT insert new ones to avoid duplicates
      throw new Error(
        `Failed to delete existing branches: ${(error as Error).message}`,
      );
    }

    // Step 2: Ensure only ONE primary branch
    let hasPrimary = false;
    const processedBranches = branches.map((branch) => {
      const isPrimary = !hasPrimary && branch.is_primary;
      if (isPrimary) hasPrimary = true;

      return {
        listing_id: listingId,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        country: branch.country,
        latitude: branch.latitude,
        longitude: branch.longitude,
        phone_number: branch.phone_number || null,
        timings: branch.timings || null,
        is_open_now: branch.is_open_now,
        is_primary: isPrimary,
        is_verified: branch.is_verified,
        distance_from_center: branch.distance_from_center || null,
        peekaboo_branch_id: branch.peekaboo_branch_id, // CRITICAL: Include for lookups
        custom_attributes: branch.custom_attributes,
      };
    });

    // If no branch was marked primary, make the first one primary
    if (!hasPrimary && processedBranches.length > 0) {
      processedBranches[0].is_primary = true;
    }

    // Step 3: Insert new branches and get their IDs
    const branchColumns = [
      "listing_id",
      "name",
      "address",
      "city",
      "country",
      "latitude",
      "longitude",
      "phone_number",
      "timings",
      "is_open_now",
      "is_primary",
      "is_verified",
      "distance_from_center",
      "peekaboo_branch_id",
      "custom_attributes",
    ] as const;

    const values: unknown[] = [];
    const valuePlaceholders = processedBranches
      .map((branch) => {
        const row = branchColumns.map(
          (col) => (branch as Record<string, unknown>)[col],
        );
        const placeholders = row.map(
          (_, j) => `$${values.length + j + 1}`,
        );
        values.push(...row);
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    let insertedBranches: Array<{
      id: number;
      name: string;
      peekaboo_branch_id: number | null;
    }>;

    try {
      const { rows } = await query(
        `INSERT INTO listing_branches (${branchColumns.join(", ")})
         VALUES ${valuePlaceholders}
         RETURNING id, name, peekaboo_branch_id`,
        values,
      );
      insertedBranches = rows;
    } catch (error) {
      throw new Error(`Failed to insert branches: ${(error as Error).message}`);
    }

    // Step 4: Build map of peekaboo_branch_id -> database branch ID
    // This map is used by syncOpeningHours to link hours to the correct branch

    if (insertedBranches) {
      insertedBranches.forEach((branch) => {
        // Map by peekaboo_branch_id (primary key for lookups)
        if (branch.peekaboo_branch_id) {
          branchIdMap.set(Number(branch.peekaboo_branch_id), branch.id);
        } else {
          // Fallback: Map by name (for branches without peekaboo_branch_id)
          branchIdMap.set(branch.name, branch.id);
        }
      });

      console.log(`[SYNC] Synced ${insertedBranches.length} branches`);
      console.log(
        `[SYNC] Branch ID map created with ${branchIdMap.size} entries`,
      );
    }

    return branchIdMap;
  }

  /**
   * Sync images to listing_images table
   * Strategy: Smart sync - only add/remove changed images
   * Prevents duplicate uploads and unnecessary storage consumption
   */
  private async syncImages(
    listingId: number,
    images: MappedImage[],
  ): Promise<number> {
    // Step 1: Get existing images from database
    let existingImages:
      | Array<{
          id: number;
          url: string;
          display_order: number;
          is_primary: boolean;
        }>
      | undefined;

    try {
      const { rows } = await query(
        `SELECT id, url, display_order, is_primary
         FROM listing_images
         WHERE listing_id = $1`,
        [listingId],
      );
      existingImages = rows;
    } catch (error) {
      console.warn(
        `[SYNC] Warning: Failed to fetch existing images:`,
        error,
      );
    }

    const existingImageUrls = new Set(
      existingImages?.map((img) => img.url) || [],
    );

    // Step 2: Identify new images (not in database)
    const newImages = images.filter(
      (img) => !existingImageUrls.has(img.image_url),
    );

    // Step 3: Identify removed images (in database but not in new set)
    const newImageUrls = new Set(images.map((img) => img.image_url));
    const imagesToDelete = existingImages?.filter(
      (img) => !newImageUrls.has(img.url),
    );

    let changesCount = 0;

    // Step 4: Delete removed images
    if (imagesToDelete && imagesToDelete.length > 0) {
      const idsToDelete = imagesToDelete.map((img) => img.id);
      try {
        await query(`DELETE FROM listing_images WHERE id = ANY($1::bigint[])`, [
          idsToDelete,
        ]);
        changesCount += imagesToDelete.length;
        console.log(`[SYNC] Deleted ${imagesToDelete.length} removed images`);
      } catch (error) {
        console.warn(
          `[SYNC] Warning: Failed to delete removed images:`,
          error,
        );
      }
    }

    // Step 5: Insert new images only
    if (newImages.length > 0) {
      // Track new image URLs for rollback
      const newImageUrlsToTrack = newImages.map((img) => img.image_url);
      this.uploadedImageUrls.push(...newImageUrlsToTrack);

      // Ensure only ONE primary image across ALL images
      let hasPrimary = existingImages?.some((img) => img.is_primary) || false;

      const imagesToInsert = newImages.map((image, index) => {
        const isPrimary = !hasPrimary && index === 0;
        if (isPrimary) hasPrimary = true;

        return {
          listing_id: listingId,
          url: image.image_url,
          display_order: image.display_order,
          is_primary: isPrimary,
          alt_text: null as string | null,
        };
      });

      const imageColumns = [
        "listing_id",
        "url",
        "display_order",
        "is_primary",
        "alt_text",
        "availability",
        "last_checked_at",
      ] as const;

      const values: unknown[] = [];
      const valuePlaceholders = imagesToInsert
        .map((image) => {
          const row = [
            image.listing_id,
            image.url,
            image.display_order,
            image.is_primary,
            image.alt_text,
            "unknown",
            null,
          ];
          const placeholders = row.map(
            (_, j) => `$${values.length + j + 1}`,
          );
          values.push(...row);
          return `(${placeholders.join(", ")})`;
        })
        .join(", ");

      try {
        await query(
          `INSERT INTO listing_images (${imageColumns.join(", ")}) VALUES ${valuePlaceholders}`,
          values,
        );
        changesCount += imagesToInsert.length;
        console.log(`[SYNC] Added ${imagesToInsert.length} new images`);
      } catch (error) {
        throw new Error(
          `Failed to insert new images: ${(error as Error).message}`,
        );
      }
    }

    // Step 6: Update display order and primary flag if images exist but changed
    if (newImages.length === 0 && imagesToDelete?.length === 0) {
      // No structural changes, but verify primary image and display order
      const imageUpdates = images.map((img, index) => ({
        url: img.image_url,
        display_order: img.display_order,
        is_primary: index === 0, // First image is always primary
      }));

      for (const update of imageUpdates) {
        const existing = existingImages?.find((e) => e.url === update.url);
        if (
          existing &&
          (existing.display_order !== update.display_order ||
            existing.is_primary !== update.is_primary)
        ) {
          try {
            await query(
              `UPDATE listing_images SET display_order = $1, is_primary = $2 WHERE id = $3`,
              [update.display_order, update.is_primary, existing.id],
            );
          } catch (error) {
            console.warn(
              `[SYNC] Warning: Failed to update image metadata:`,
              error,
            );
          }
        }
      }
    }

    if (changesCount === 0) {
      console.log(`[SYNC] Images unchanged (${images.length} existing)`);
    }

    return changesCount;
  }

  /**
   * Sync opening hours from parsed timings
   * Supports both listing-level and branch-specific hours
   *
   * @param listingId - The listing ID
   * @param listing - The mapped listing with timings data
   * @param branches - Array of branches with timings
   * @param branchIdMap - Map of branch names to their database IDs
   */
  private async syncOpeningHours(
    listingId: number,
    listing: MappedListing,
    branches: MappedBranch[],
    branchIdMap?: Map<string | number, number>,
  ): Promise<void> {
    // Delete ALL existing opening hours for this listing (including branch-specific)
    try {
      await query(`DELETE FROM opening_hours WHERE listing_id = $1`, [
        listingId,
      ]);
    } catch (error) {
      // CRITICAL: If we cannot delete old hours, we MUST NOT insert new ones to avoid duplicates
      throw new Error(
        `Failed to clear existing opening hours: ${(error as Error).message}`,
      );
    }

    const { openingHoursParser } =
      await import("../transformers/opening-hours-parser");

    let totalHoursInserted = 0;

    // Strategy 1: Use pre-parsed opening_hours from branches if available
    if (branchIdMap && branchIdMap.size > 0 && branches.length > 0) {
      console.log(`[SYNC] === OPENING HOURS SYNC START ===`);
      console.log(`[SYNC] Listing ID: ${listingId}`);
      console.log(`[SYNC] Total branches to process: ${branches.length}`);
      console.log(`[SYNC] Branch ID map size: ${branchIdMap.size}`);
      console.log(`[SYNC] Branch ID map keys:`, Array.from(branchIdMap.keys()));
      console.log(
        `[SYNC] Branch ID map entries:`,
        Array.from(branchIdMap.entries()),
      );

      for (const branch of branches) {
        console.log(`\n[SYNC] --- Processing branch ---`);
        console.log(`[SYNC]   Name: ${branch.name}`);
        console.log(
          `[SYNC]   peekaboo_branch_id: ${branch.peekaboo_branch_id}`,
        );
        console.log(`[SYNC]   Timings: ${branch.timings}`);
        console.log(`[SYNC]   Has opening_hours: ${!!branch.opening_hours}`);
        console.log(
          `[SYNC]   opening_hours length: ${branch.opening_hours?.length || 0}`,
        );

        // Lookup database branch ID using peekaboo_branch_id
        const branchId = branchIdMap.get(Number(branch.peekaboo_branch_id));

        console.log(
          `[SYNC]   Lookup by peekaboo_branch_id ${branch.peekaboo_branch_id}: ${branchId ? `FOUND (db_id=${branchId})` : "NOT FOUND"}`,
        );

        if (!branchId) {
          console.error(
            `[SYNC] CRITICAL: Could not find branch ID for: ${branch.name}`,
          );
          console.error(
            `[SYNC]   peekaboo_branch_id: ${branch.peekaboo_branch_id}`,
          );
          console.error(`[SYNC]   Map size: ${branchIdMap.size}`);
          console.error(
            `[SYNC]   Available map keys:`,
            Array.from(branchIdMap.keys()).slice(0, 10),
          );
          console.error(
            `[SYNC]   SKIPPING THIS BRANCH - NO HOURS WILL BE INSERTED!`,
          );
          continue;
        }

        // Use pre-parsed opening_hours if available, otherwise parse from timings
        const parsedHours: Array<{
          day_of_week: number;
          open_time: string;
          close_time: string;
          is_closed: boolean;
        }> = [];

        console.log(
          `[SYNC] Processing branch: ${branch.name} (peekaboo_branch_id: ${branch.peekaboo_branch_id})`,
        );
        console.log(
          `[SYNC]   - Has opening_hours prop: ${!!branch.opening_hours}`,
        );
        console.log(
          `[SYNC]   - opening_hours length: ${branch.opening_hours?.length || 0}`,
        );

        if (branch.opening_hours && branch.opening_hours.length > 0) {
          // Convert branch opening_hours to the expected format (filter out nulls)
          console.log(
            `[SYNC]   - Using pre-parsed opening_hours (${branch.opening_hours.length} days)`,
          );
          branch.opening_hours.forEach((h) => {
            if (h.open_time && h.close_time) {
              parsedHours.push({
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed,
              });
            }
          });
          console.log(
            `[SYNC]   - Filtered to ${parsedHours.length} valid hours`,
          );
        }

        // Fallback: Parse from timings if opening_hours is empty
        if (parsedHours.length === 0) {
          console.log(
            `[SYNC]   - No pre-parsed hours, parsing from timings field`,
          );
          const branchTimings =
            branch.timings || branch.custom_attributes?.peekaboo_timings;
          if (!branchTimings) {
            console.log(
              `[SYNC]   No timings available for branch: ${branch.name}`,
            );
            continue;
          }

          console.log(`[SYNC]   - Parsing timings: "${branchTimings}"`);
          const freshlyParsed = openingHoursParser.parse(
            branchTimings as string,
          );
          console.log(
            `[SYNC]   - Parsed ${freshlyParsed.length} hours from timings`,
          );
          if (freshlyParsed.length === 0) {
            console.log(
              `[SYNC] Could not parse timings for branch ${branch.name}: "${branchTimings}"`,
            );
            continue;
          }

          // Validate and add freshly parsed hours
          const validation = openingHoursParser.validate(freshlyParsed);
          if (!validation.valid) {
            console.warn(
              `[SYNC] Invalid opening hours for branch ${branch.name}:`,
              validation.errors,
            );
            continue;
          }

          parsedHours.push(...freshlyParsed);
        }

        if (parsedHours.length === 0) {
          console.log(`[SYNC]   No valid hours for branch: ${branch.name}`);
          continue;
        }

        console.log(
          `[SYNC]   Ready to insert ${parsedHours.length} hours for branch: ${branch.name}`,
        );
        console.log(`[SYNC]   Sample hours:`, parsedHours.slice(0, 2));

        // Insert branch-specific opening hours WITH branch_id
        const hoursToInsert = parsedHours.map((hour) => ({
          listing_id: listingId,
          branch_id: branchId, // CRITICAL: set branch_id here
          day_of_week: hour.day_of_week,
          open_time: hour.open_time,
          close_time: hour.close_time,
          is_closed: hour.is_closed,
        }));

        try {
          await this.insertOpeningHours(hoursToInsert);
          totalHoursInserted += parsedHours.length;
          console.log(
            `[SYNC] Synced ${parsedHours.length} hours for branch: ${branch.name} (branch_id: ${branchId})`,
          );
        } catch (error) {
          console.warn(
            `[SYNC] Warning: Failed to insert branch hours for ${branch.name}:`,
            error,
          );
        }
      }
    }

    // Strategy 2: Fallback to listing-level hours (no branch_id)
    // This applies when there are no branches OR branches don't have timings
    if (totalHoursInserted === 0) {
      const listingTimings = listing.custom_attributes?.peekaboo_timings as
        | string
        | undefined;

      if (!listingTimings) {
        console.log(`[SYNC] No timings data available for opening hours`);
        return;
      }

      const parsedHours = openingHoursParser.parse(listingTimings);
      if (parsedHours.length === 0) {
        console.log(
          `[SYNC] Could not parse listing timings: "${listingTimings}"`,
        );
        return;
      }

      const validation = openingHoursParser.validate(parsedHours);
      if (!validation.valid) {
        console.warn(
          `[SYNC] Invalid listing opening hours:`,
          validation.errors,
        );
        return;
      }

      // Insert listing-level opening hours (branch_id = NULL)
      const hoursToInsert = parsedHours.map((hour) => ({
        listing_id: listingId,
        branch_id: null as number | null,
        day_of_week: hour.day_of_week,
        open_time: hour.open_time,
        close_time: hour.close_time,
        is_closed: hour.is_closed,
      }));

      try {
        await this.insertOpeningHours(hoursToInsert);
        totalHoursInserted = parsedHours.length;
        console.log(
          `[SYNC] Synced ${parsedHours.length} listing-level opening hours`,
        );
      } catch (error) {
        console.warn(
          `[SYNC] Warning: Failed to insert listing hours:`,
          error,
        );
      }
    }

    if (totalHoursInserted === 0) {
      console.log(`[SYNC] No opening hours synced for listing ${listingId}`);
    }
  }

  /**
   * Bulk-insert rows into opening_hours
   */
  private async insertOpeningHours(
    hours: Array<{
      listing_id: number;
      branch_id: number | null;
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_closed: boolean;
    }>,
  ): Promise<void> {
    if (hours.length === 0) return;

    const columns = [
      "listing_id",
      "branch_id",
      "day_of_week",
      "open_time",
      "close_time",
      "is_closed",
    ] as const;

    const values: unknown[] = [];
    const valuePlaceholders = hours
      .map((hour) => {
        const row = columns.map((col) => (hour as Record<string, unknown>)[col]);
        const placeholders = row.map((_, j) => `$${values.length + j + 1}`);
        values.push(...row);
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    await query(
      `INSERT INTO opening_hours (${columns.join(", ")}) VALUES ${valuePlaceholders}`,
      values,
    );
  }

  /**
   * Get existing listing by Peekaboo ID
   */
  async getExistingListing(peekabooId: number): Promise<{
    id: number;
    name: string;
    status: string;
    updated_at: string;
    custom_attributes: Record<string, unknown>;
  } | null> {
    try {
      const { rows } = await query(
        `SELECT id, name, status, updated_at, custom_attributes, peekaboo_id
         FROM listings
         WHERE peekaboo_id = $1
         LIMIT 1`,
        [peekabooId],
      );

      const data = rows[0];
      if (!data) {
        return null;
      }

      // Type cast to satisfy return type
      return {
        ...data,
        custom_attributes: data.custom_attributes as Record<string, unknown>,
      };
    } catch (error) {
      console.error("[SYNC] Error fetching existing listing:", error);
      return null;
    }
  }

  /**
   * Get branches for a listing
   */
  async getBranches(listingId: number): Promise<ListingBranch[]> {
    try {
      const { rows: data } = await query(
        `SELECT * FROM listing_branches
         WHERE listing_id = $1
         ORDER BY is_primary DESC, created_at ASC`,
        [listingId],
      );

      // Type cast to satisfy return type (handle nullable fields)
      return (
        data?.map((branch: Record<string, unknown>) => ({
          ...branch,
          is_open_now: (branch.is_open_now as boolean) ?? false,
          is_primary: (branch.is_primary as boolean) ?? false,
          is_verified: (branch.is_verified as boolean) ?? false,
          custom_attributes: (branch.custom_attributes ||
            {}) as ListingBranch["custom_attributes"],
        } as ListingBranch)) || []
      );
    } catch (error) {
      console.error("[SYNC] Error fetching branches:", error);
      return [];
    }
  }

  /**
   * Normalize bank name for fuzzy matching
   * Removes common variations like "The", "Limited", "Ltd", "Bank", etc.
   */
  private normalizeBankName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(the|limited|ltd|bank|pvt|private)\b/g, "") // Remove common words
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Get bank ID by name (with caching and fuzzy matching)
   * @param bankName - Name of the bank (e.g., "Meezan Bank", "Bank of Punjab")
   * @returns Bank ID or null if not found
   */
  private async getBankId(bankName: string): Promise<number | null> {
    // Check cache first (exact match)
    if (DatabaseSync.bankCache.has(bankName)) {
      return DatabaseSync.bankCache.get(bankName)!;
    }

    // Step 1: Try exact case-insensitive match
    let exactMatch: { id: number; name: string } | undefined;
    try {
      const { rows } = await query(
        `SELECT id, name FROM banks WHERE name ILIKE $1 LIMIT 1`,
        [bankName],
      );
      exactMatch = rows[0];
    } catch (error) {
      console.error(`[SYNC] Error fetching bank "${bankName}":`, error);
      return null;
    }

    if (exactMatch) {
      // Cache the result
      DatabaseSync.bankCache.set(bankName, exactMatch.id);
      return exactMatch.id;
    }

    // Step 2: Try fuzzy matching with normalization
    // Get all banks and find the best match
    let allBanks: Array<{ id: number; name: string }> | undefined;
    try {
      const { rows } = await query(
        `SELECT id, name FROM banks WHERE is_active = true`,
      );
      allBanks = rows;
    } catch (error) {
      console.error(`[SYNC] Error fetching banks list:`, error);
      return null;
    }

    if (!allBanks || allBanks.length === 0) {
      console.warn(`[SYNC] No active banks found in database`);
      return null;
    }

    // Normalize the search term
    const normalizedSearch = this.normalizeBankName(bankName);

    // Find matching bank
    for (const bank of allBanks) {
      const normalizedBank = this.normalizeBankName(bank.name);

      // Check if normalized names match or contain each other
      if (
        normalizedBank === normalizedSearch ||
        normalizedBank.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedBank)
      ) {
        console.log(
          `[SYNC] Fuzzy matched "${bankName}" -> "${bank.name}" (ID: ${bank.id})`,
        );

        // Cache both the original name and the matched name
        DatabaseSync.bankCache.set(bankName, bank.id);
        DatabaseSync.bankCache.set(bank.name, bank.id);

        return bank.id;
      }
    }

    // No match found
    console.warn(`[SYNC] Bank not found in database: "${bankName}"`);
    console.warn(`[SYNC]    Searched for normalized: "${normalizedSearch}"`);
    console.warn(
      `[SYNC]    Consider adding bank manually or via admin interface`,
    );
    return null;
  }

  /**
   * Sync deals (bank/card discounts) to database
   * @param listingId - The listing ID to associate deals with
   * @param deals - Array of Peekaboo deals
   * @returns Number of deals synced
   */
  async syncDeals(
    listingId: number,
    deals: MappedListing["deals"],
  ): Promise<number> {
    if (!deals || deals.length === 0) {
      return 0;
    }

    console.log(
      `[SYNC] Syncing ${deals.length} deals for listing ${listingId}...`,
    );

    let syncedCount = 0;

    for (const deal of deals) {
      try {
        // Get bank ID from cache or database
        const bankId = await this.getBankId(deal.bankName);

        if (!bankId) {
          console.warn(
            `[SYNC] Skipping deal "${deal.title}" - bank "${deal.bankName}" not found`,
          );
          continue;
        }

        // Prepare deal data
        const isActive = this.isDealActive(deal.startDate, deal.endDate);
        const metadata = {
          peekaboo_deal_id: deal.peekabooId,
          source_entity_id: deal.sourceEntityId,
          percentage_value: deal.percentageValue,
          order_type: deal.orderType,
          online_available: deal.onlineAvailable,
          card_associations: deal.cardAssociations, // Full card details with images
        };

        // Upsert deal (update if exists, insert if new)
        // Use listing_id + title + bank_id as the unique identifier
        const { rows: existingRows } = await query(
          `SELECT id FROM deals
           WHERE listing_id = $1 AND title = $2 AND bank_id = $3
           LIMIT 1`,
          [listingId, deal.title, bankId],
        );
        const existingDeal = existingRows[0];

        if (existingDeal) {
          // Update existing deal
          try {
            await query(
              `UPDATE deals SET
                 title = $1,
                 description = $2,
                 deal_type = $3,
                 bank_id = $4,
                 discount_value = $5,
                 start_date = $6,
                 end_date = $7,
                 is_active = $8,
                 valid_card_variants = $9,
                 metadata = $10
               WHERE id = $11`,
              [
                deal.title,
                deal.description || null,
                "bank_discount",
                bankId,
                deal.discountValue,
                deal.startDate,
                deal.endDate,
                isActive,
                deal.validCards,
                metadata,
                existingDeal.id,
              ],
            );
          } catch (error) {
            console.error(`[SYNC] Error updating deal "${deal.title}":`, error);
            continue;
          }

          console.log(
            `[SYNC]    Updated deal: ${deal.title} (${deal.discountValue})`,
          );
        } else {
          // Insert new deal
          try {
            await query(
              `INSERT INTO deals (
                 listing_id, title, description, deal_type, bank_id,
                 discount_value, start_date, end_date, is_active,
                 valid_card_variants, metadata
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                listingId,
                deal.title,
                deal.description || null,
                "bank_discount",
                bankId,
                deal.discountValue,
                deal.startDate,
                deal.endDate,
                isActive,
                deal.validCards,
                metadata,
              ],
            );
          } catch (error) {
            console.error(
              `[SYNC] Error inserting deal "${deal.title}":`,
              error,
            );
            continue;
          }

          console.log(
            `[SYNC]    Created deal: ${deal.title} (${deal.discountValue})`,
          );
        }

        syncedCount++;
      } catch (error) {
        console.error(`[SYNC] Unexpected error syncing deal:`, error);
        continue;
      }
    }

    console.log(`[SYNC] Synced ${syncedCount}/${deals.length} deals`);
    return syncedCount;
  }

  /**
   * Check if a deal is currently active based on dates
   */
  private isDealActive(startDate: string, endDate: string): boolean {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return now >= start && now <= end;
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Nothing to cleanup currently
    // Future: close connections, release resources
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create and initialize a DatabaseSync instance
 */
export async function createDatabaseSync(
  options?: SyncOptions,
): Promise<DatabaseSync> {
  const sync = new DatabaseSync(options);
  await sync.init();
  return sync;
}
