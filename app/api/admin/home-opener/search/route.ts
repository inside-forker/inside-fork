import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { query } from "@/lib/db";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/home-opener/search?kind=event|listing&q=
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const q = (searchParams.get("q") || "").trim();

    if (kind !== "event" && kind !== "listing") {
      return NextResponse.json(
        { error: "kind must be 'event' or 'listing'" },
        { status: 400 },
      );
    }

    if (kind === "event") {
      const params: unknown[] = [];
      const clauses = ["event_status = 'published'", "end_time >= NOW()"];
      if (q) {
        params.push(`%${q}%`);
        clauses.push(`event_name ILIKE $${params.length}`);
      }
      params.push(20);
      const { rows } = await query(
        `SELECT event_id, event_name, event_slug, event_status,
                to_json(start_time) #>> '{}' AS start_time,
                is_featured
         FROM events_with_details
         WHERE ${clauses.join(" AND ")}
         ORDER BY is_featured DESC NULLS LAST, start_time ASC
         LIMIT $${params.length}`,
        params,
      );
      const eventIds = rows.map((r) => Number(r.event_id));
      const imageMap = await fetchPrimaryImagesByEventId(eventIds);

      return NextResponse.json({
        success: true,
        data: rows.map((r) => {
          const id = Number(r.event_id);
          return {
            kind: "event" as const,
            id,
            title: String(r.event_name ?? ""),
            image_url: imageMap.get(id) ?? null,
            subtitle: r.start_time
              ? new Date(String(r.start_time)).toLocaleString("en-PK", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : null,
            status: r.event_status as string | null,
            is_featured: Boolean(r.is_featured),
          };
        }),
      });
    }

    const params: unknown[] = [];
    const clauses = ["status = 'published'"];
    if (q) {
      params.push(`%${q}%`);
      clauses.push(
        `(name ILIKE $${params.length} OR slug ILIKE $${params.length})`,
      );
    }
    params.push(20);
    const { rows } = await query(
      `SELECT id, name, slug, status, category_name, is_featured
       FROM listings_with_details
       WHERE ${clauses.join(" AND ")}
       ORDER BY is_featured DESC NULLS LAST, avg_rating DESC NULLS LAST, id DESC
       LIMIT $${params.length}`,
      params,
    );
    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        kind: "listing" as const,
        id: Number(r.id),
        title: String(r.name ?? ""),
        subtitle: (r.category_name as string | null) ?? null,
        status: r.status as string | null,
        is_featured: Boolean(r.is_featured),
      })),
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("[admin/home-opener/search] failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
