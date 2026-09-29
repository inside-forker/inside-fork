import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Public, read-only data for the header's PremiumDiscoveryPanel: parent
// categories with their sub-categories, total content counts, and a small
// set of "trending" listings. Was previously fetched directly from the
// browser via the Supabase client.
export async function GET() {
  try {
    const [parentsResult, listingsCountResult, postsCountResult, eventsCountResult, trendingResult] =
      await Promise.all([
        query(
          `SELECT id, name, slug FROM categories
           WHERE parent_id IS NULL AND is_enabled = true
           ORDER BY name ASC`,
        ),
        query(`SELECT COUNT(*)::integer AS count FROM listings`),
        query(`SELECT COUNT(*)::integer AS count FROM posts`),
        query(
          `SELECT COUNT(*)::integer AS count FROM events
           WHERE status = 'published' AND end_time >= $1`,
          [new Date().toISOString()],
        ),
        query(
          `SELECT id, name, slug, address, category_name, avg_rating, review_count
           FROM listings_with_details
           WHERE status = 'published'
           ORDER BY created_at DESC
           LIMIT 6`,
        ),
      ]);

    const parentIds = parentsResult.rows.map((p) => p.id);
    const subsByParent = new Map<
      number,
      { id: number; name: string; slug: string }[]
    >();
    if (parentIds.length > 0) {
      const { rows: subs } = await query(
        `SELECT c.id, c.name, c.slug, c.parent_id
         FROM categories c
         WHERE c.parent_id = ANY($1)
           AND c.is_enabled = true
           AND (
             EXISTS (
               SELECT 1 FROM listings l
               WHERE (l.category_id = c.id OR EXISTS (
                 SELECT 1 FROM listing_categories lc WHERE lc.listing_id = l.id AND lc.category_id = c.id
               ))
               AND l.status = 'published'
             )
             OR EXISTS (
               SELECT 1 FROM events e
               WHERE e.category_id = c.id AND e.status = 'published' AND e.end_time >= NOW()
             )
           )
         ORDER BY c.name ASC`,
        [parentIds],
      );
      for (const sub of subs) {
        const parentId = Number(sub.parent_id);
        if (!subsByParent.has(parentId)) subsByParent.set(parentId, []);
        subsByParent.get(parentId)!.push({
          id: Number(sub.id),
          name: sub.name,
          slug: sub.slug,
        });
      }
    }

    const categories = parentsResult.rows
      .map((p) => ({
        id: Number(p.id),
        name: p.name,
        slug: p.slug,
        subcategories: subsByParent.get(Number(p.id)) || [],
      }))
      .filter((p) => p.subcategories.length > 0);

    const trendingListings = trendingResult.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      address: row.address,
      category_name: row.category_name,
      avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
      review_count: row.review_count !== null ? Number(row.review_count) : 0,
    }));

    return NextResponse.json({
      categories,
      trendingListings,
      contentCounts: {
        listings: Number(listingsCountResult.rows[0]?.count || 0),
        posts: Number(postsCountResult.rows[0]?.count || 0),
        events: Number(eventsCountResult.rows[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error("Discovery API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
