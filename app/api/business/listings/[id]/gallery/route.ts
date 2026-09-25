import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { deleteFile } from "@/lib/storage/spaces";
import { uploadListingImageWithFeedVariants } from "@/lib/storage/feed-image-variants";
import {
  verifyBusinessOwner,
  verifyListingOwnership,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import sharp from "sharp";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_PER_LISTING = 20;
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 4096;
const MAX_ASPECT_RATIO = 3; // 3:1 max
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * POST /api/business/listings/[id]/gallery
 * Upload images to listing gallery with comprehensive Sharp validation
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return apiError("No images provided", 400);
    }

    if (files.length > 10) {
      return apiError("Maximum 10 images per upload", 400);
    }

    // Check current image count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM listing_images WHERE listing_id = $1`,
      [listingId],
    );
    const currentImageCount = parseInt(countRows[0].count, 10);

    if (currentImageCount && currentImageCount >= MAX_IMAGES_PER_LISTING) {
      return apiError(
        `Maximum ${MAX_IMAGES_PER_LISTING} images per listing`,
        400,
      );
    }

    const remainingSlots = MAX_IMAGES_PER_LISTING - (currentImageCount || 0);
    if (files.length > remainingSlots) {
      return apiError(
        `Can only upload ${remainingSlots} more image(s). Maximum ${MAX_IMAGES_PER_LISTING} total.`,
        400,
      );
    }

    const uploadedImages: Array<{
      id: number;
      url: string;
      width: number;
      height: number;
      size: number;
    }> = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          errors.push(
            `File ${i + 1}: Invalid type ${file.type}. Only JPG, PNG, WebP allowed.`,
          );
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          errors.push(
            `File ${i + 1}: Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum 5MB.`,
          );
          continue;
        }

        // Read file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use Sharp to validate and process image
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Validate dimensions
        if (
          !metadata.width ||
          !metadata.height ||
          metadata.width < MIN_DIMENSION ||
          metadata.height < MIN_DIMENSION
        ) {
          errors.push(
            `File ${i + 1}: Too small (${metadata.width}x${metadata.height}). Minimum ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
          );
          continue;
        }

        if (
          metadata.width > MAX_DIMENSION ||
          metadata.height > MAX_DIMENSION
        ) {
          errors.push(
            `File ${i + 1}: Too large (${metadata.width}x${metadata.height}). Maximum ${MAX_DIMENSION}x${MAX_DIMENSION}px.`,
          );
          continue;
        }

        // Validate aspect ratio
        const aspectRatio = Math.max(
          metadata.width / metadata.height,
          metadata.height / metadata.width,
        );
        if (aspectRatio > MAX_ASPECT_RATIO) {
          errors.push(
            `File ${i + 1}: Invalid aspect ratio (${aspectRatio.toFixed(1)}:1). Maximum ${MAX_ASPECT_RATIO}:1.`,
          );
          continue;
        }

        // Process image: strip EXIF, auto-rotate, compress
        const processedBuffer = await image
          .rotate() // Auto-rotate based on EXIF orientation
          .jpeg({ quality: 90, mozjpeg: true }) // Re-compress with quality
          .withMetadata({ orientation: 1 }) // Remove EXIF but set orientation
          .toBuffer();

        // Generate safe filename
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const sanitizedName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 50);
        const filename = `listings/${listingId}/${timestamp}-${randomSuffix}-${sanitizedName}`;

        // Upload to DigitalOcean Spaces (default bucket, listing-images/ prefix)
        // + feed _w400/_w800 siblings for mobile CDN hits.
        let uploadData;
        try {
          uploadData = await uploadListingImageWithFeedVariants(
            filename,
            processedBuffer,
            {
              contentType: "image/jpeg",
            },
          );
        } catch (uploadError) {
          errors.push(
            `File ${i + 1}: Upload failed - ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`,
          );
          continue;
        }

        const publicUrl = uploadData.publicUrl;

        // Create database record
        let imageRecord;
        try {
          const { rows } = await query(
            `INSERT INTO listing_images (listing_id, url, is_primary, display_order, availability, last_checked_at)
             VALUES ($1, $2, false, $3, 'ok', NOW())
             RETURNING *`,
            [listingId, publicUrl, currentImageCount + uploadedImages.length],
          );
          imageRecord = rows[0];
        } catch (dbError) {
          // Clean up uploaded file if database insert fails
          await deleteFile(uploadData.path);
          errors.push(
            `File ${i + 1}: Database error - ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
          );
          continue;
        }

        uploadedImages.push({
          id: imageRecord.id,
          url: publicUrl,
          width: metadata.width,
          height: metadata.height,
          size: processedBuffer.length,
        });
      } catch (error) {
        errors.push(
          `File ${i + 1}: Processing error - ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // Return response
    if (uploadedImages.length === 0 && errors.length > 0) {
      return apiError("All uploads failed", 400, "UPLOAD_FAILED", { errors });
    }

    return apiSuccess(
      {
        uploaded: uploadedImages,
        errors: errors.length > 0 ? errors : undefined,
        total: files.length,
        successful: uploadedImages.length,
        failed: errors.length,
      },
      uploadedImages.length === files.length
        ? "All images uploaded successfully"
        : `${uploadedImages.length}/${files.length} images uploaded successfully`,
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/business/listings/[id]/gallery
 * Get all images for a listing
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const listingId = parseInt(id, 10);

    if (isNaN(listingId)) {
      return apiError("Invalid listing ID", 400);
    }

    const userId = await verifyBusinessOwner();
    await verifyListingOwnership(userId, listingId);

    let images;
    try {
      const result = await query(
        `SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC`,
        [listingId],
      );
      images = result.rows;
    } catch (error) {
      throw new Error(
        `Failed to fetch images: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return apiSuccess({ images: images || [] });
  } catch (error) {
    return handleApiError(error);
  }
}
