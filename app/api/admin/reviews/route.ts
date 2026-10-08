import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify user has admin/staff role
    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const rating = searchParams.get("rating") || "";

    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(
        `(r.comment ILIKE $${paramIdx} OR p.full_name ILIKE $${paramIdx} OR l.name ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (status && status !== "all") {
      conditions.push(`r.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }
    if (rating && rating !== "all") {
      conditions.push(`r.rating = $${paramIdx}`);
      params.push(parseInt(rating));
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Paginated reviews query
    const reviewsSql = `
      SELECT
        r.*,
        p.full_name  AS user_name,
        p.avatar_url AS user_avatar,
        l.name       AS listing_name,
        l.slug       AS listing_slug,
        COALESCE((SELECT json_agg(ri) FROM public.review_images ri WHERE ri.review_id = r.id), '[]') AS images,
        COALESCE((SELECT COUNT(*)::int FROM public.review_comments rc WHERE rc.review_id = r.id), 0) AS comment_count,
        COALESCE((SELECT COUNT(*)::int FROM public.content_reports cr WHERE cr.content_type = 'review' AND cr.content_id = r.id AND cr.status = 'pending'), 0) AS report_count
      FROM public.reviews r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN public.listings l ON l.id = r.listing_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const { rows: reviews } = await query(reviewsSql, params);

    // Count query
    const countParams = params.slice(0, paramIdx - 1); // without LIMIT/OFFSET
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM public.reviews r
      LEFT JOIN public.profiles p ON p.id = r.user_id
      LEFT JOIN public.listings l ON l.id = r.listing_id
      ${whereClause}
    `;
    const { rows: countRows } = await query(countSql, countParams);
    const total = (countRows[0] as { total: number })?.total ?? 0;

    // Statistics
    const { rows: statsRows } = await query(
      "SELECT rating, status FROM public.reviews"
    );
    const { rows: commentRows } = await query(
      "SELECT status FROM public.review_comments"
    );

    type StatRow = { rating: number; status: string | null };
    type CommentRow = { status: string | null };

    const statistics = {
      totalReviews: statsRows.length,
      pendingReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      flaggedReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      totalComments: commentRows.length,
      pendingComments: 0,
      approvedComments: 0,
      rejectedComments: 0,
      flaggedComments: 0,
    };

    statsRows.forEach((r: StatRow) => {
      switch (r.status) {
        case "pending": statistics.pendingReviews++; break;
        case "approved": statistics.approvedReviews++; break;
        case "rejected": statistics.rejectedReviews++; break;
        case "flagged": statistics.flaggedReviews++; break;
        default: statistics.pendingReviews++;
      }
      if (r.status === "approved") statistics.ratingDistribution[r.rating]++;
    });

    const approvedReviews = statsRows.filter((r: StatRow) => r.status === "approved");
    if (approvedReviews.length > 0) {
      const totalRating = approvedReviews.reduce(
        (sum: number, r: StatRow) => sum + r.rating, 0
      );
      statistics.averageRating = totalRating / approvedReviews.length;
    }

    commentRows.forEach((c: CommentRow) => {
      switch (c.status) {
        case "pending": statistics.pendingComments++; break;
        case "approved": statistics.approvedComments++; break;
        case "rejected": statistics.rejectedComments++; break;
        case "flagged": statistics.flaggedComments++; break;
        default: statistics.pendingComments++;
      }
    });

    return NextResponse.json({
      success: true,
      data: { reviews, total, page, limit, statistics },
    });
  } catch (error) {
    console.error("GET /api/admin/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    // Verify user has admin/staff role
    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;
    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { listing_id, user_id, rating, comment } = body;

    if (!listing_id || !user_id || !rating) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if review already exists for this user and listing
    const { rows: existing } = await query(
      "SELECT id FROM public.reviews WHERE listing_id = $1 AND user_id = $2 LIMIT 1",
      [listing_id, user_id]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: "User has already reviewed this listing" },
        { status: 409 },
      );
    }

    // Create the review
    const { rows: reviewRows } = await query(
      `INSERT INTO public.reviews (listing_id, branch_id, user_id, rating, comment, status, moderated_by, moderated_at)
       VALUES ($1, 1, $2, $3, $4, 'approved', $5, NOW()) RETURNING *`,
      [listing_id, user_id, rating, comment, session.userId]
    );

    return NextResponse.json({
      success: true,
      data: reviewRows[0],
    });
  } catch (error) {
    console.error("POST /api/admin/reviews error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create review" },
      { status: 500 },
    );
  }
}
