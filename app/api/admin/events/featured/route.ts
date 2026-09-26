import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { query } from "@/lib/db";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/events/featured
 * Returns all currently featured events with thumbnail images and display metadata.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { rows } = await query(
      `SELECT e.id, e.name, e.slug, e.status,
              to_json(e.start_time) #>> '{}' AS start_time,
              to_json(e.end_time) #>> '{}' AS end_time,
              e.location_name, e.address, e.is_featured,
              COALESCE(e.featured_rank, 0) AS featured_rank,
              (e.end_time < NOW()) AS is_expired
       FROM events e
       WHERE e.is_featured = true
       ORDER BY e.featured_rank DESC NULLS LAST, e.start_time ASC, e.id ASC`,
    );

    const eventIds = rows.map((r) => Number(r.id));
    const imageMap = await fetchPrimaryImagesByEventId(eventIds);

    const data = rows.map((r) => {
      const id = Number(r.id);
      return {
        id,
        title: String(r.name ?? ""),
        slug: String(r.slug ?? ""),
        status: String(r.status ?? ""),
        start_time: (r.start_time as string | null) ?? null,
        end_time: (r.end_time as string | null) ?? null,
        subtitle: r.start_time
          ? new Date(String(r.start_time)).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        location_name: (r.location_name as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        image_url: imageMap.get(id) ?? null,
        is_featured: Boolean(r.is_featured),
        featured_rank: Number(r.featured_rank),
        is_expired: Boolean(r.is_expired),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/events/featured] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to load featured events" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/events/featured
 * Updates which events are featured and assigns featured_rank based on array order.
 * Body: `{ event_ids: number[] }`
 */
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || !Array.isArray((body as { event_ids?: unknown }).event_ids)) {
      return NextResponse.json(
        { error: "event_ids must be an array of event IDs" },
        { status: 400 },
      );
    }

    const eventIds = (body as { event_ids: unknown[] }).event_ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    // Run updates sequentially
    await query("BEGIN");
    try {
      // Clear existing featured flags
      await query("UPDATE events SET is_featured = false, featured_rank = 0 WHERE is_featured = true");

      // Set new featured events with decreasing rank so top item has highest rank
      for (let i = 0; i < eventIds.length; i++) {
        const rank = (eventIds.length - i) * 10;
        await query(
          "UPDATE events SET is_featured = true, featured_rank = $1 WHERE id = $2",
          [rank, eventIds[i]],
        );
      }

      await query("COMMIT");
    } catch (err) {
      await query("ROLLBACK");
      throw err;
    }

    // Return the updated list
    const { rows } = await query(
      `SELECT e.id, e.name, e.slug, e.status,
              to_json(e.start_time) #>> '{}' AS start_time,
              to_json(e.end_time) #>> '{}' AS end_time,
              e.location_name, e.address, e.is_featured,
              COALESCE(e.featured_rank, 0) AS featured_rank,
              (e.end_time < NOW()) AS is_expired
       FROM events e
       WHERE e.is_featured = true
       ORDER BY e.featured_rank DESC NULLS LAST, e.start_time ASC, e.id ASC`,
    );

    const imageMap = await fetchPrimaryImagesByEventId(rows.map((r) => Number(r.id)));

    const data = rows.map((r) => {
      const id = Number(r.id);
      return {
        id,
        title: String(r.name ?? ""),
        slug: String(r.slug ?? ""),
        status: String(r.status ?? ""),
        start_time: (r.start_time as string | null) ?? null,
        end_time: (r.end_time as string | null) ?? null,
        subtitle: r.start_time
          ? new Date(String(r.start_time)).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null,
        location_name: (r.location_name as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        image_url: imageMap.get(id) ?? null,
        is_featured: Boolean(r.is_featured),
        featured_rank: Number(r.featured_rank),
        is_expired: Boolean(r.is_expired),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/events/featured] PUT failed:", error);
    return NextResponse.json(
      { error: "Failed to update featured events" },
      { status: 500 },
    );
  }
}
