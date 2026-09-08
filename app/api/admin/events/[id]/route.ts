import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { listFiles, deleteFile } from "@/lib/storage/spaces";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

const EVENT_DETAIL_COLUMNS =
  "event_id, event_name, event_slug, event_description, " +
  "to_json(start_time) #>> '{}' AS start_time, to_json(end_time) #>> '{}' AS end_time, " +
  "event_status, to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at, " +
  "category_id, max_capacity, is_featured, " +
  "featured_rank, is_commission_based, commission_rate, require_guest_details, " +
  "organizer_id, organizer_name, organizer_avatar, location_name, address, " +
  "latitude, longitude";

function toNumericEvent(row: Record<string, unknown>) {
  return {
    ...row,
    event_id: Number(row.event_id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    // latitude/longitude/commission_rate are numeric columns; node-pg
    // returns them as strings by default (no custom type parser
    // configured), unlike the old PostgREST path which serialized them
    // as JSON numbers.
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    commission_rate:
      row.commission_rate !== null ? Number(row.commission_rate) : null,
  };
}

// Full `events` row shape (for audit-log before/after snapshots), with the
// same bigint/timestamp coercion used elsewhere so both snapshots are
// internally consistent.
const EVENTS_ROW_COLUMNS =
  "id, organizer_id, name, slug, description, " +
  "to_json(start_time) #>> '{}' AS start_time, to_json(end_time) #>> '{}' AS end_time, " +
  "is_commission_based, commission_rate, status, " +
  "to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at, " +
  "category_id, max_capacity, is_featured, featured_rank, require_guest_details, " +
  "location_name, address, latitude, longitude";

function toNumericEventsRow(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
    commission_rate:
      row.commission_rate !== null ? Number(row.commission_rate) : null,
  };
}

async function requireAdminRole(userId: string) {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    return { error: "Profile not found", status: 404 } as const;
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    return { error: "Access denied", status: 403 } as const;
  }
  return { ok: true, role: profile.role } as const;
}

// GET /api/admin/events/[id] - Get single event details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // Get event with details
    const { rows: eventRows } = await query(
      `SELECT ${EVENT_DETAIL_COLUMNS} FROM events_with_details WHERE event_id = $1`,
      [eventId]
    );
    const event = eventRows[0];
    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    // Get event images
    let images;
    try {
      const { rows } = await query(
        `SELECT id, event_id, url, alt_text, is_primary, display_order,
           to_json(created_at) #>> '{}' AS created_at
         FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
        [eventId]
      );
      images = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: Number(row.event_id),
      }));
    } catch (error) {
      console.error("Error fetching event images:", error);
      images = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        ...toNumericEvent(event),
        images,
      },
    });
  } catch (error) {
    console.error("Error in admin event GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/events/[id] - Update event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // Get existing event data before update for logging
    const { rows: existingRows } = await query(
      `SELECT ${EVENTS_ROW_COLUMNS} FROM events WHERE id = $1`,
      [eventId]
    );
    if (!existingRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }
    const existingEvent = toNumericEventsRow(existingRows[0]);

    const body = await request.json();
    const {
      name,
      description,
      start_time,
      end_time,
      location_name,
      address,
      latitude,
      longitude,
      category_id,
      venue_id,
      max_capacity,
      is_featured,
      featured_rank,
      commission_rate,
      is_commission_based,
      status,
      organizer_id,
      require_guest_details,
    } = body;

    // Build update
    const setClauses: string[] = ["updated_at = NOW()"];
    const updateParams: unknown[] = [];

    const pushField = (column: string, value: unknown) => {
      updateParams.push(value);
      setClauses.push(`${column} = $${updateParams.length}`);
    };

    if (name !== undefined) {
      pushField("name", name);
      // Regenerate slug if name changed
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      pushField("slug", slug);
    }
    if (description !== undefined) pushField("description", description);
    if (start_time !== undefined) pushField("start_time", start_time);
    if (end_time !== undefined) pushField("end_time", end_time);
    if (location_name !== undefined) pushField("location_name", location_name);
    if (address !== undefined) pushField("address", address);
    if (latitude !== undefined) pushField("latitude", latitude);
    if (longitude !== undefined) pushField("longitude", longitude);
    if (category_id !== undefined) pushField("category_id", category_id);
    if (venue_id !== undefined) pushField("venue_id", venue_id);
    if (max_capacity !== undefined) pushField("max_capacity", max_capacity);
    if (is_featured !== undefined) pushField("is_featured", is_featured);
    if (featured_rank !== undefined) pushField("featured_rank", featured_rank);
    if (commission_rate !== undefined)
      pushField("commission_rate", commission_rate);
    if (is_commission_based !== undefined)
      pushField("is_commission_based", is_commission_based);
    if (status !== undefined) pushField("status", status);
    if (organizer_id !== undefined) pushField("organizer_id", organizer_id);
    if (require_guest_details !== undefined)
      pushField("require_guest_details", require_guest_details);

    updateParams.push(eventId);
    const idIdx = updateParams.length;

    let event;
    try {
      const { rows } = await query(
        `UPDATE events SET ${setClauses.join(", ")}
         WHERE id = $${idIdx}
         RETURNING ${EVENTS_ROW_COLUMNS}`,
        updateParams
      );
      if (!rows[0]) {
        return NextResponse.json(
          { success: false, error: "Event not found" },
          { status: 404 },
        );
      }
      event = toNumericEventsRow(rows[0]);
    } catch (error) {
      console.error("Error updating event:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update event" },
        { status: 500 },
      );
    }

    // Log the admin action
    try {
      const { logEventUpdate } = await import("@/lib/audit");
      await logEventUpdate(
        session.userId,
        eventId.toString(),
        existingEvent,
        event,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event update:", logError);
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in admin event PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/events/[id] - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      );
    }

    const eventId = parseInt(id);
    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 },
      );
    }

    // Get event data before deletion for logging
    const { rows: eventRows } = await query(
      `SELECT ${EVENTS_ROW_COLUMNS} FROM events WHERE id = $1`,
      [eventId]
    );
    if (!eventRows[0]) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }
    const eventToDelete = toNumericEventsRow(eventRows[0]);

    // Delete event (this will cascade to related records)
    try {
      await query(`DELETE FROM events WHERE id = $1`, [eventId]);
    } catch (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete event" },
        { status: 500 },
      );
    }

    // Clean up event images from storage.
    try {
      console.log(`[EventDelete] Cleaning up images for event ${eventId}`);

      const filePaths = await listFiles(`event-images/${eventId}/`);

      if (filePaths.length > 0) {
        await Promise.all(filePaths.map((filePath) => deleteFile(filePath)));
        console.log(
          `[EventDelete] Successfully deleted ${filePaths.length} image files for event ${eventId}`,
        );
      }
    } catch (cleanupError) {
      console.error("Error during image cleanup:", cleanupError);
      // Don't fail the deletion if image cleanup fails
    }

    // Log the admin action
    try {
      const { logEventDeletion } = await import("@/lib/audit");
      await logEventDeletion(
        session.userId,
        eventId.toString(),
        eventToDelete,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event deletion:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Error in admin event DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
