import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getAdminAuthErrorStatus,
  requireListingCapacityAccess,
} from "@/lib/auth/admin";
import { resolveCategoryIdScope } from "@/lib/listings/category-scope";
import type { ListingCapacityCompleteness } from "@/types/listing.types";

const CAPACITY_SELECT = `
  l.id,
  l.name,
  l.slug,
  l.status,
  l.category_id,
  COALESCE((
    SELECT json_agg(lc.category_id ORDER BY lc.is_primary DESC, lc.category_id ASC)
    FROM listing_categories lc
    WHERE lc.listing_id = l.id
  ), CASE WHEN l.category_id IS NOT NULL THEN json_build_array(l.category_id) ELSE '[]'::json END) AS category_ids,
  l.address,
  l.description,
  l.phone_number,
  l.website,
  l.min_price_per_person,
  l.max_price_per_person,
  l.min_guest_capacity,
  l.max_guest_capacity,
  COALESCE(
    c.name,
    (
      SELECT c2.name
      FROM listing_categories lc2
      JOIN categories c2 ON c2.id = lc2.category_id
      WHERE lc2.listing_id = l.id
      ORDER BY lc2.is_primary DESC, lc2.category_id ASC
      LIMIT 1
    )
  ) AS category_name,
  img.url AS image_url,
  img.alt_text AS image_alt
`;

function completenessSql(completeness: ListingCapacityCompleteness): string {
  const allFilled = `(
    l.min_price_per_person IS NOT NULL
    AND l.max_price_per_person IS NOT NULL
    AND l.min_guest_capacity IS NOT NULL
    AND l.max_guest_capacity IS NOT NULL
  )`;

  if (completeness === "complete") {
    return allFilled;
  }
  if (completeness === "incomplete") {
    return `NOT ${allFilled}`;
  }
  return "";
}

export async function GET(request: NextRequest) {
  try {
    await requireListingCapacityAccess(request);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20),
    );
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status") || "";
    const categoryId = searchParams.get("category_id") || "";
    const completeness = (searchParams.get("completeness") ||
      "all") as ListingCapacityCompleteness;

    const offset = (page - 1) * limit;
    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    if (search) {
      whereParams.push(`%${search}%`);
      whereClauses.push(
        `(l.name ILIKE $${whereParams.length} OR l.address ILIKE $${whereParams.length})`,
      );
    }

    if (status && status !== "all") {
      whereParams.push(status);
      whereClauses.push(`l.status = $${whereParams.length}`);
    }

    if (categoryId && categoryId !== "all") {
      const categoryIdNum = parseInt(categoryId, 10);
      if (!Number.isNaN(categoryIdNum)) {
        const categoryIds = await resolveCategoryIdScope(categoryIdNum);
        if (categoryIds.length > 0) {
          whereParams.push(categoryIds);
          whereClauses.push(
            `(l.category_id = ANY($${whereParams.length}::int[]) OR EXISTS (SELECT 1 FROM listing_categories lc WHERE lc.listing_id = l.id AND lc.category_id = ANY($${whereParams.length}::int[])))`,
          );
        } else {
          whereClauses.push("1 = 0");
        }
      }
    }

    const completenessClause = completenessSql(
      ["all", "incomplete", "complete"].includes(completeness)
        ? completeness
        : "all",
    );
    if (completenessClause) {
      whereClauses.push(completenessClause);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countResult = await query(
      `SELECT COUNT(*)::int AS count
       FROM listings l
       ${whereSql}`,
      whereParams,
    );
    const total = countResult.rows[0]?.count ?? 0;

    const listParams = [...whereParams, limit, offset];
    const listingsResult = await query(
      `SELECT ${CAPACITY_SELECT}
       FROM listings l
       LEFT JOIN categories c ON c.id = l.category_id
       LEFT JOIN LATERAL (
         SELECT li.url, li.alt_text
         FROM listing_images li
         WHERE li.listing_id = l.id
         ORDER BY li.is_primary DESC, li.display_order ASC, li.id ASC
         LIMIT 1
       ) img ON true
       ${whereSql}
       ORDER BY l.name ASC
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const incompleteWhere = [
      `NOT (
         l.min_price_per_person IS NOT NULL
         AND l.max_price_per_person IS NOT NULL
         AND l.min_guest_capacity IS NOT NULL
         AND l.max_guest_capacity IS NOT NULL
       )`,
      ...whereClauses,
    ];
    const incompleteWhereSql = `WHERE ${incompleteWhere.join(" AND ")}`;

    const [incompleteResult, statusStatsResult] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS count
         FROM listings l
         ${incompleteWhereSql}`,
        whereParams,
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'published')::int AS published,
           COUNT(*) FILTER (WHERE status = 'draft')::int AS draft,
           COUNT(*) FILTER (WHERE status = 'archived')::int AS archived,
           COUNT(*)::int AS total
         FROM listings`,
      ),
    ]);

    const statusStats = statusStatsResult.rows[0] || {
      published: 0,
      draft: 0,
      archived: 0,
      total: 0,
    };

    return NextResponse.json({
      listings: listingsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        total,
        incomplete: incompleteResult.rows[0]?.count ?? 0,
        published: statusStats.published ?? 0,
        draft: statusStats.draft ?? 0,
        archived: statusStats.archived ?? 0,
        all: statusStats.total ?? 0,
      },
    });
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }
    console.error("Error fetching listing capacity rows:", error);
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 },
    );
  }
}
