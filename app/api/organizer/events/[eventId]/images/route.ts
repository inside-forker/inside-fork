import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile, getKeyFromPublicUrl, uploadFile } from "@/lib/storage/spaces";
import { uploadObjectFeedVariants } from "@/lib/storage/feed-image-variants";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

const EVENT_IMAGE_COLUMNS =
  "id, event_id, url, alt_text, is_primary, display_order, " +
  "to_json(created_at) #>> '{}' AS created_at";

function toNumericEventImage(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    event_id: Number(row.event_id),
  };
}

// GET /api/organizer/events/[eventId]/images - Get images for an event owned by the organizer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user owns this event or is admin/lister
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    // Check event ownership
    const eventIdNum = parseInt(eventId, 10);
    const { rows: eventRows } = await query(
      `SELECT id, organizer_id FROM events WHERE id = $1`,
      [eventIdNum]
    );
    const event = eventRows[0];

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Only allow organizer who owns the event or admin/lister
    const isOwner = event.organizer_id === session.userId;
    const isAdmin = ADMIN_ROLES.includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch images
    let images;
    try {
      const { rows } = await query(
        `SELECT ${EVENT_IMAGE_COLUMNS} FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
        [eventIdNum]
      );
      images = rows.map(toNumericEventImage);
    } catch (imagesError) {
      console.error("Error fetching event images:", imagesError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      images: images || [],
    });
  } catch (error) {
    console.error("Error in organizer event images API:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizer/events/[eventId]/images - Upload new image for an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get user profile with role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId);
    if (isNaN(eventIdNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists and user owns it (or is admin/lister)
    const { rows: eventRows } = await query(
      `SELECT id, organizer_id FROM events WHERE id = $1`,
      [eventIdNum]
    );
    const event = eventRows[0];

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Check access: owner, organizer role, or admin/lister
    const isOwner = event.organizer_id === session.userId;
    const isAdmin = ADMIN_ROLES.includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to upload images to this event",
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only JPEG, PNG, and WebP are allowed",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File size too large. Maximum 5MB allowed" },
        { status: 400 }
      );
    }

    // Check current image count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS count FROM event_images WHERE event_id = $1`,
      [eventIdNum]
    );
    const imageCount = Number(countRows[0]?.count || 0);

    if (imageCount >= 8) {
      return NextResponse.json(
        { success: false, error: "Maximum 8 images allowed per event" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `event-images/event-${eventIdNum}-${Date.now()}.${fileExt}`;

    // Upload to DigitalOcean Spaces + feed _w400/_w800 siblings
    let publicUrl: string;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploaded = await uploadFile(fileName, buffer, {
        contentType: file.type,
      });
      publicUrl = uploaded.publicUrl;
      await uploadObjectFeedVariants(fileName, buffer);
    } catch (uploadError) {
      console.error("Error uploading to storage:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get next display order
    const { rows: maxOrderRows } = await query(
      `SELECT MAX(display_order) AS max_order FROM event_images WHERE event_id = $1`,
      [eventIdNum]
    );
    const nextOrder = Number(maxOrderRows[0]?.max_order || 0) + 1;

    // Save to database
    let imageData;
    try {
      const { rows } = await query(
        `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${EVENT_IMAGE_COLUMNS}`,
        [eventIdNum, publicUrl, file.name, nextOrder, nextOrder === 1]
      );
      imageData = toNumericEventImage(rows[0]);
    } catch (dbError) {
      console.error("Error saving image to database:", dbError);
      // Clean up uploaded file
      try {
        await deleteFile(fileName);
      } catch {
        // best-effort cleanup
      }
      return NextResponse.json(
        { success: false, error: "Failed to save image data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: imageData,
    });
  } catch (error) {
    console.error("Error in organizer event images POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizer/events/[eventId]/images - Set primary image
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    const body = await request.json();

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "Image ID is required" },
        { status: 400 }
      );
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId);
    const imageIdNum = parseInt(imageId);

    const { rows: eventRows } = await query(
      `SELECT id, organizer_id FROM events WHERE id = $1`,
      [eventIdNum]
    );
    const event = eventRows[0];

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === session.userId;
    const isAdmin = ADMIN_ROLES.includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // If setting as primary, first reset all other images
    if (body.is_primary === true) {
      await query(
        `UPDATE event_images SET is_primary = false WHERE event_id = $1`,
        [eventIdNum]
      );
    }

    // Update the target image
    let updatedImage;
    try {
      const { rows } = await query(
        `UPDATE event_images SET is_primary = COALESCE($1, is_primary) WHERE id = $2 AND event_id = $3
         RETURNING ${EVENT_IMAGE_COLUMNS}`,
        [body.is_primary, imageIdNum, eventIdNum]
      );
      if (!rows[0]) {
        return NextResponse.json(
          { success: false, error: "Failed to update image" },
          { status: 500 }
        );
      }
      updatedImage = toNumericEventImage(rows[0]);
    } catch (updateError) {
      console.error("Error updating image:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedImage,
    });
  } catch (error) {
    console.error("Error in organizer event images PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizer/events/[eventId]/images - Delete an image
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: "Image ID is required" },
        { status: 400 }
      );
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    const eventIdNum = parseInt(eventId);
    const imageIdNum = parseInt(imageId);

    const { rows: eventRows } = await query(
      `SELECT id, organizer_id FROM events WHERE id = $1`,
      [eventIdNum]
    );
    const event = eventRows[0];

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const isOwner = event.organizer_id === session.userId;
    const isAdmin = ADMIN_ROLES.includes(profile.role);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Get image URL for storage cleanup
    const { rows: imageRows } = await query(
      `SELECT url FROM event_images WHERE id = $1 AND event_id = $2`,
      [imageIdNum, eventIdNum]
    );
    const image = imageRows[0];

    if (!image) {
      return NextResponse.json(
        { success: false, error: "Image not found" },
        { status: 404 }
      );
    }

    // Every event must keep at least one photo — reject the delete if this
    // is the last one instead of leaving the listing with no image.
    const { rows: countRows } = await query(
      `SELECT COUNT(*) AS count FROM event_images WHERE event_id = $1`,
      [eventIdNum]
    );
    const remainingImageCount = Number(countRows[0]?.count || 0);
    if (remainingImageCount <= 1) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This is the last photo for this event. Upload a replacement before removing it.",
        },
        { status: 400 }
      );
    }

    // Delete from database
    try {
      await query(`DELETE FROM event_images WHERE id = $1`, [imageIdNum]);
    } catch (deleteError) {
      console.error("Error deleting image:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to delete image" },
        { status: 500 }
      );
    }

    // Try to delete from storage
    try {
      const key = getKeyFromPublicUrl(image.url);
      if (key) {
        await deleteFile(key);
      }
    } catch (storageError) {
      console.error("Error deleting from storage:", storageError);
    }

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error in organizer event images DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
