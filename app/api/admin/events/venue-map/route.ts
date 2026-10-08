import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { uploadFile } from "@/lib/storage/spaces";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];
const MAX_BYTES = 10 * 1024 * 1024;

// POST /api/admin/events/venue-map - Upload an event's venue map image.
// Returns the public URL; the event form saves it as events.layout_image_url.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
      session.userId,
    ]);
    if (!rows[0] || !ADMIN_ROLES.includes(rows[0].role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing file" },
        { status: 400 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, error: "Venue map must be an image" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: "Venue map must be under 10MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "jpg";
    const path = `event-images/venue-maps/${uuidv4()}.${ext}`;
    const uploadResult = await uploadFile(
      path,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, isPublic: true }
    );

    return NextResponse.json({
      success: true,
      data: { url: uploadResult.publicUrl },
    });
  } catch (error) {
    console.error("Event venue map upload failed:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
