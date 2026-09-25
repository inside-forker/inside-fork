import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { deleteFile, uploadFile } from "@/lib/storage/spaces";
import { uploadObjectFeedVariants } from "@/lib/storage/feed-image-variants";

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

// GET /api/admin/events/[id]/images - Get all images for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if user has admin or lister role
    if (!ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Get event images
    let images;
    try {
      const { rows } = await query(
        `SELECT ${EVENT_IMAGE_COLUMNS} FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
        [eventId]
      );
      images = rows.map(toNumericEventImage);
    } catch (error) {
      console.error("Error fetching event images:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch images" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: images || [],
    });
  } catch (error) {
    console.error("Error in admin event images GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/admin/events/[id]/images - Upload new image for an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check admin or lister role
    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 }
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    // Verify event exists
    const { rows: eventRows } = await query(
      `SELECT id FROM events WHERE id = $1`,
      [eventId]
    );
    if (!eventRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
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
      [eventId]
    );
    const imageCount = Number(countRows[0]?.count || 0);

    if (imageCount >= 10) {
      return NextResponse.json(
        { success: false, error: "Maximum 8 images allowed per event" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `event-images/event-${eventId}-${Date.now()}.${fileExt}`;

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
      [eventId]
    );
    const nextOrder = Number(maxOrderRows[0]?.max_order || 0) + 1;

    // Save to database
    let imageData;
    try {
      const { rows } = await query(
        `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${EVENT_IMAGE_COLUMNS}`,
        [eventId, publicUrl, file.name, nextOrder, nextOrder === 1]
      );
      imageData = toNumericEventImage(rows[0]);
    } catch (dbError) {
      console.error("Error saving image to database:", dbError);
      // Try to clean up uploaded file
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
    console.error("Error in admin event images POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
