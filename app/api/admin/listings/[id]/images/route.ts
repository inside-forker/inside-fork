import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";
import { uploadListingImage, deleteFile } from "@/lib/storage/spaces";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Fetch images for this listing
    let images;
    try {
      const result = await query(
        `SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC`,
        [listingId],
      );
      images = result.rows;
    } catch (fetchError) {
      console.error("Error fetching images:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch images" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: images || [] });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPEG, PNG, and WebP are allowed" },
        { status: 400 },
      );
    }
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum 5MB allowed" },
        { status: 400 },
      );
    }
    // Check current image count
    let imageCount;
    try {
      const { rows } = await query(
        `SELECT COUNT(*) FROM listing_images WHERE listing_id = $1`,
        [listingId],
      );
      imageCount = parseInt(rows[0].count, 10);
    } catch {
      return NextResponse.json(
        { error: "Failed to check image count" },
        { status: 500 },
      );
    }
    if (imageCount >= 20) {
      return NextResponse.json(
        { error: "Maximum 20 images allowed per listing" },
        { status: 400 },
      );
    }
    // Generate unique filename with folder structure
    const fileExt = file.name.split(".").pop();
    const fileName = `${listingId}/${listingId}-${Date.now()}.${fileExt}`;
    // Upload to DigitalOcean Spaces (default bucket, listing-images/ prefix)
    let publicUrl: string;
    let uploadedPath: string;
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadResult = await uploadListingImage(fileName, buffer, {
        contentType: file.type,
      });
      publicUrl = uploadResult.publicUrl;
      uploadedPath = uploadResult.path;
    } catch {
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 },
      );
    }

    // Get next display order
    const { rows: maxOrderRows } = await query(
      `SELECT display_order FROM listing_images WHERE listing_id = $1
       ORDER BY display_order DESC LIMIT 1`,
      [listingId],
    );
    const nextOrder = (maxOrderRows[0]?.display_order || 0) + 1;

    // Check if this listing has any primary image already
    const { rows: primaryImageRows } = await query(
      `SELECT id FROM listing_images WHERE listing_id = $1 AND is_primary = true LIMIT 1`,
      [listingId],
    );
    const primaryImage = primaryImageRows[0];

    // Save to database
    let imageData;
    try {
      const { rows } = await query(
        `INSERT INTO listing_images (listing_id, url, alt_text, display_order, is_primary, availability, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, 'ok', NOW())
         RETURNING *`,
        [listingId, publicUrl, file.name, nextOrder, !primaryImage],
      );
      imageData = rows[0];
    } catch (dbError) {
      console.error("Database insert error details:", dbError);
      await deleteFile(uploadedPath);
      return NextResponse.json(
        {
          error: "Failed to save image data",
          details: dbError instanceof Error ? dbError.message : "Database error occurred",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, data: imageData });
  } catch (error) {
    if (error instanceof Error && error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(error);
    }
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
