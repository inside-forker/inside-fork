import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

const ROUTE = "/api/admin/events";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

const EVENT_COLUMNS =
  "event_id, event_name, event_slug, event_description, " +
  "to_json(start_time) #>> '{}' AS start_time, to_json(end_time) #>> '{}' AS end_time, " +
  "event_status, to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at, " +
  "category_id, max_capacity, is_featured, " +
  "featured_rank, is_commission_based, commission_rate, require_guest_details, " +
  "organizer_id, organizer_name, organizer_avatar, location_name, address, " +
  "latitude, longitude, scanning_mode, total_gates";

function toNumericEvent(row: Record<string, unknown>) {
  return {
    ...row,
    event_id: Number(row.event_id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    total_gates: row.total_gates !== null && row.total_gates !== undefined ? Number(row.total_gates) : 1,
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

// GET /api/admin/events - Get all events with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const organizer = searchParams.get("organizer");
    const category = searchParams.get("category");

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
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
        { status: 404 },
      );
    }
    const isOrganizer = profile.role === "organizer";
    if (!ADMIN_ROLES.includes(profile.role) && !isOrganizer) {
      return NextResponse.json(
        { success: false, error: "Access required" },
        { status: 403 },
      );
    }

    // Build query for events with details
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (isOrganizer) {
      params.push(session.userId);
      const userParam = `$${params.length}`;
      whereClauses.push(`(organizer_id = ${userParam} OR EXISTS (
        SELECT 1 FROM public.event_co_organizers eco
        WHERE eco.event_id = events_with_details.event_id AND eco.organizer_id = ${userParam}
      ))`);
    }

    if (status && status !== "all") {
      params.push(status);
      whereClauses.push(`event_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`event_name ILIKE $${params.length}`);
    }

    if (organizer) {
      params.push(`%${organizer}%`);
      whereClauses.push(`organizer_name ILIKE $${params.length}`);
    }

    if (category) {
      params.push(parseInt(category, 10));
      whereClauses.push(`category_id = $${params.length}`);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let events, count;
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM events_with_details ${whereSql}`,
        params
      );
      count = parseInt(countRows[0].count, 10);

      const offset = (page - 1) * limit;
      const dataParams = [...params, limit, offset];
      const { rows } = await query(
        `SELECT ${EVENT_COLUMNS} FROM events_with_details
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      events = rows.map(toNumericEvent);
    } catch (error) {
      console.error("Error fetching events:", error);
      captureRouteError(error, { route: ROUTE, method: "GET" });
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 },
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        events: events || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error in admin events API:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/admin/events - Create new event (if needed for admin creation)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
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
        { status: 404 },
      );
    }
    if (!ADMIN_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 },
      );
    }

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
      organizer_id,
      max_capacity,
      is_featured,
      featured_rank,
      commission_rate,
      is_commission_based,
      status,
      require_guest_details,
      scanning_mode,
      total_gates,
      layout_image_url,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Event name is required" },
        { status: 400 },
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { success: false, error: "Start time and end time are required" },
        { status: 400 },
      );
    }

    let baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "event";

    // Ensure slug uniqueness to avoid unique constraint violation on events_slug_key
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const { rows: existing } = await query(
        `SELECT id FROM events WHERE slug = $1 LIMIT 1`,
        [slug]
      );
      if (existing.length === 0) break;
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    let event;
    try {
      const { rows } = await query(
        `INSERT INTO events (
           name, slug, description, start_time, end_time,
           location_name, address, latitude, longitude, category_id, organizer_id, max_capacity,
           is_featured, featured_rank, commission_rate, is_commission_based, status, require_guest_details,
           scanning_mode, total_gates, layout_image_url
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING id, organizer_id, name, slug, description,
           to_json(start_time) #>> '{}' AS start_time,
           to_json(end_time) #>> '{}' AS end_time,
           is_commission_based, commission_rate, status,
           to_json(created_at) #>> '{}' AS created_at,
           to_json(updated_at) #>> '{}' AS updated_at,
           category_id, max_capacity, is_featured, featured_rank, require_guest_details,
           location_name, address, latitude, longitude, scanning_mode, total_gates,
           layout_image_url`,
        [
          name.trim(),
          slug,
          description?.trim() || null,
          start_time,
          end_time,
          location_name?.trim() || null,
          address?.trim() || null,
          latitude !== undefined && latitude !== null && latitude !== "" && !isNaN(Number(latitude))
            ? Number(latitude)
            : null,
          longitude !== undefined && longitude !== null && longitude !== "" && !isNaN(Number(longitude))
            ? Number(longitude)
            : null,
          category_id ? Number(category_id) : null,
          organizer_id || session.userId,
          max_capacity !== undefined && max_capacity !== null && max_capacity !== "" && !isNaN(Number(max_capacity))
            ? Number(max_capacity)
            : null,
          is_featured === true || is_featured === "true",
          featured_rank ? Number(featured_rank) : null,
          commission_rate !== undefined && commission_rate !== null && commission_rate !== "" && !isNaN(Number(commission_rate))
            ? Number(commission_rate)
            : null,
          is_commission_based === true || is_commission_based === "true",
          status || "draft",
          require_guest_details === true || require_guest_details === "true",
          scanning_mode || "single",
          total_gates ? Math.max(1, parseInt(String(total_gates), 10) || 1) : 1,
          layout_image_url || null,
        ]
      );
      const row = rows[0];
      const insertedId = Number(row.id);

      // Attempt to return complete enriched row from events_with_details
      try {
        const { rows: detailRows } = await query(
          `SELECT ${EVENT_COLUMNS} FROM events_with_details WHERE event_id = $1`,
          [insertedId]
        );
        if (detailRows[0]) {
          event = {
            ...toNumericEvent(detailRows[0]),
            id: insertedId,
            event_id: insertedId,
          };
        } else {
          event = {
            ...toNumericEvent(row),
            id: insertedId,
            event_id: insertedId,
          };
        }
      } catch {
        event = {
          ...toNumericEvent(row),
          id: insertedId,
          event_id: insertedId,
        };
      }
    } catch (error) {
      console.error("Error creating event:", error);
      captureRouteError(error, { route: ROUTE, method: "POST" });
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create event";
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 },
      );
    }

    // Log the admin action
    try {
      const { logEventCreation } = await import("@/lib/audit");
      await logEventCreation(
        session.userId,
        event.id.toString(),
        event,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log event creation:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error in admin events POST:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
