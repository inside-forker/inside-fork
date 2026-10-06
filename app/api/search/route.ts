import { query } from "@/lib/db";
import {
  clampPlacesLimit,
  parseCoord,
  PlacesSearchValidationError,
  queryPlaces,
} from "@/lib/search/query-places";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { NextRequest, NextResponse } from "next/server";

const POSTS_APPEND_LIMIT = 3;

/**
 * GET /api/search?q=&limit=&offset=&type=&lat=&lng=
 *
 * Public places-search engine (same SQL as mobile /search/places), with an
 * optional thin posts append when type=all so guide discovery does not regress.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") ?? "";
    const searchType = (searchParams.get("type") ?? "all").toLowerCase();
    const limit = clampPlacesLimit(
      parseInt(searchParams.get("limit") ?? "10", 10),
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") ?? "0", 10) || 0,
    );
    const lat = parseCoord(searchParams.get("lat"), -90, 90);
    const lng = parseCoord(searchParams.get("lng"), -180, 180);
    const hasGeo = lat != null && lng != null;

    if (!q || q.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters long" },
        { status: 400 },
      );
    }

    const places = await queryPlaces({
      q,
      limit,
      offset,
      type: searchType,
      lat,
      lng,
    });

    const results: Record<string, unknown>[] = places.listings.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: row.address,
      category: row.category,
      category_name: row.category,
      avg_rating: row.avg_rating,
      review_count: row.review_count,
      distance_meters: row.distance_meters ?? null,
      image_url: row.image_url ?? null,
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      type: row.type,
      description: null,
    }));

    // Web-only: append a few guides when browsing "all" on the first page
    if (searchType === "all" && offset === 0) {
      const sanitized = sanitizeSearchTerm(q);
      if (sanitized.length >= 2) {
        const searchTerm = `%${sanitized}%`;
        const { rows: posts } = await query(
          `SELECT id, title, slug, excerpt,
                  to_json(published_at) #>> '{}' AS published_at
           FROM posts
           WHERE status = 'published'
             AND (title ILIKE $1 OR excerpt ILIKE $1)
           LIMIT $2`,
          [searchTerm, POSTS_APPEND_LIMIT],
        );

        for (const post of posts ?? []) {
          results.push({
            id: post.id !== null ? Number(post.id) : post.id,
            name: post.title,
            slug: post.slug,
            description: post.excerpt,
            type: "post",
            category: "Guide/Article",
            published_at: post.published_at,
          });
        }
      }
    }

    const headers: Record<string, string> = hasGeo
      ? { "Cache-Control": "private, no-store" }
      : {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          "CDN-Cache-Control": "max-age=300",
          "Vercel-CDN-Cache-Control": "max-age=300",
        };

    return NextResponse.json(
      {
        query: q,
        results,
        total: results.length,
        listings_offset: places.listings_offset,
        listings_limit: places.listings_limit,
        listings_has_more: places.listings_has_more,
        cached: false,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof PlacesSearchValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
