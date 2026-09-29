import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    let rows: Array<{
      id: string | number;
      name: string;
      slug: string;
      parent_id: string | number | null;
      icon_name: string | null;
    }>;

    if (includeAll) {
      const result = await query(
        `SELECT id, name, slug, parent_id, icon_name
         FROM categories
         WHERE is_enabled = true
         ORDER BY name ASC`,
      );
      rows = result.rows;
    } else {
      const result = await query(
        `WITH RECURSIVE cat_tree AS (
          SELECT id AS root_id, id FROM categories
          UNION ALL
          SELECT t.root_id, c.id FROM categories c JOIN cat_tree t ON c.parent_id = t.id
        ),
        active_listings AS (
          SELECT id, category_id FROM listings WHERE status = 'published' AND category_id IS NOT NULL
          UNION
          SELECT l.id, lc.category_id FROM listings l JOIN listing_categories lc ON lc.listing_id = l.id WHERE l.status = 'published' AND lc.category_id IS NOT NULL
        ),
        listing_counts AS (
          SELECT t.root_id AS category_id, COUNT(DISTINCT al.id) AS listing_count
          FROM cat_tree t
          JOIN active_listings al ON al.category_id = t.id
          GROUP BY t.root_id
        ),
        active_events AS (
          SELECT category_id, COUNT(*) AS event_count
          FROM events
          WHERE status = 'published' AND end_time >= NOW()
          GROUP BY category_id
        ),
        direct_listing_counts AS (
          SELECT category_id, COUNT(DISTINCT id) AS direct_count
          FROM active_listings
          GROUP BY category_id
        )
        SELECT
          c.id,
          c.name,
          c.slug,
          c.parent_id,
          c.icon_name
        FROM categories c
        LEFT JOIN listing_counts lc ON lc.category_id = c.id
        LEFT JOIN direct_listing_counts dlc ON dlc.category_id = c.id
        LEFT JOIN active_events ae ON ae.category_id = c.id
        WHERE c.is_enabled = true
          AND (
            -- If parent category: keep if total hierarchy has published listings or active events
            (c.parent_id IS NULL AND (COALESCE(lc.listing_count, 0) > 0 OR COALESCE(ae.event_count, 0) > 0))
            OR
            -- If subcategory: keep if direct published listings or active events exist
            (c.parent_id IS NOT NULL AND (COALESCE(dlc.direct_count, 0) > 0 OR COALESCE(ae.event_count, 0) > 0))
          )
        ORDER BY c.name ASC`,
      );
      rows = result.rows;
    }

    const categoryOptions = rows.map((category) => ({
      value: String(category.id),
      label: category.name as string,
      slug: category.slug as string,
      parentId: category.parent_id ? String(category.parent_id) : null,
      iconName: category.icon_name as string | null,
    }));

    const response = NextResponse.json({
      success: true,
      categories: categoryOptions,
      count: categoryOptions.length,
    });

    response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );

    return response;
  } catch (error) {
    console.error("API error fetching categories:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

