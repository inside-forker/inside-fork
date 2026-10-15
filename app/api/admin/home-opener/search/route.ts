import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { query } from "@/lib/db";
import { fetchPrimaryImagesByEventId } from "@/lib/mobile/event-images";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/home-opener/search?kind=event|listing|brand&q=
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const q = (searchParams.get("q") || "").trim();

    if (kind !== "event" && kind !== "listing" && kind !== "brand") {
      return NextResponse.json(
        { error: "kind must be 'event', 'listing', or 'brand'" },
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

    if (kind === "brand") {
      const params: unknown[] = [];
      let whereClause = "";
      if (q) {
        params.push(`%${q}%`);
        whereClause = `WHERE g.name ILIKE $${params.length} OR g.slug ILIKE $${params.length}`;
      }
      params.push(25);

      const { rows: brandRows } = await query(
        `SELECT g.id, g.name, g.slug,
                COUNT(DISTINCT m.listing_id)::int AS member_count
         FROM brand_groups g
         LEFT JOIN brand_group_members m ON m.group_id = g.id
         ${whereClause}
         GROUP BY g.id, g.name, g.slug
         ORDER BY member_count DESC, g.name ASC
         LIMIT $${params.length}`,
        params,
      );

      const brandIds = brandRows.map((b) => Number(b.id));

      // Fetch member branches and images for these brands
      let memberRows: any[] = [];
      if (brandIds.length > 0) {
        const { rows } = await query(
          `SELECT m.group_id, l.id, l.name, l.slug, l.status, l.address,
                  l.latitude, l.longitude, l.avg_rating, l.review_count,
                  img.url AS image_url
           FROM brand_group_members m
           JOIN listings l ON l.id = m.listing_id
           LEFT JOIN LATERAL (
             SELECT url FROM listing_images
             WHERE listing_id = l.id
             ORDER BY is_primary DESC NULLS LAST, display_order ASC NULLS LAST, id ASC
             LIMIT 1
           ) img ON true
           WHERE m.group_id = ANY($1) AND l.status = 'published'
           ORDER BY m.sort_order ASC, l.name ASC`,
          [brandIds],
        );
        memberRows = rows;
      }

      const membersByGroup = new Map<number, any[]>();
      for (const m of memberRows) {
        const gid = Number(m.group_id);
        if (!membersByGroup.has(gid)) membersByGroup.set(gid, []);
        membersByGroup.get(gid)!.push({
          id: Number(m.id),
          name: m.name,
          slug: m.slug,
          status: m.status,
          address: m.address,
          latitude: m.latitude != null ? Number(m.latitude) : null,
          longitude: m.longitude != null ? Number(m.longitude) : null,
          avg_rating: m.avg_rating != null ? Number(m.avg_rating) : 0,
          review_count: m.review_count != null ? Number(m.review_count) : 0,
          image_url: m.image_url ?? null,
        });
      }

      return NextResponse.json({
        success: true,
        data: brandRows.map((b) => {
          const id = Number(b.id);
          const members = membersByGroup.get(id) || [];
          const sampleImage = members.find((m) => m.image_url)?.image_url ?? null;
          return {
            kind: "brand" as const,
            id,
            title: String(b.name ?? ""),
            image_url: sampleImage,
            subtitle: `${members.length} published branch${members.length !== 1 ? "es" : ""}`,
            status: members.length > 0 ? "active" : "empty",
            is_featured: false,
            members,
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
