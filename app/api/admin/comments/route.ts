import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { CommentWithAuthor, CommentListResponse } from "@/types/comment.types";

// GET /api/admin/comments - Get all comments for moderation
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status"); // pending, approved, rejected, flagged
    const sort_by = searchParams.get("sort_by") || "created_at";
    const sort_order = searchParams.get("sort_order") || "desc";

    // Apply filters if provided
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(`(rc.content ILIKE $${paramIdx} OR p.full_name ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (
      status &&
      ["pending", "approved", "rejected", "flagged"].includes(status)
    ) {
      conditions.push(`rc.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Apply sorting (allow-list to avoid SQL injection via ORDER BY)
    const validSortFields = ["created_at", "updated_at"];
    const sortField = validSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order === "asc" ? "ASC" : "DESC";

    const commentsSql = `
      SELECT
        rc.*,
        p.full_name  AS author_full_name,
        p.avatar_url AS author_avatar_url,
        r.listing_id AS review_listing_id,
        r.user_id    AS review_user_id,
        COALESCE((SELECT COUNT(*)::int FROM public.content_reports cr WHERE cr.content_type = 'comment' AND cr.content_id = rc.id AND cr.status = 'pending'), 0) AS report_count
      FROM public.review_comments rc
      LEFT JOIN public.profiles p ON p.id = rc.user_id
      LEFT JOIN public.reviews r ON r.id = rc.review_id
      ${whereClause}
      ORDER BY rc.${sortField} ${sortDirection}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const { rows: comments } = await query(commentsSql, params);

    const countParams = params.slice(0, paramIdx - 1);
    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM public.review_comments rc
      ${whereClause}
    `;
    const { rows: countRows } = await query(countSql, countParams);
    const count = (countRows[0] as { count: number })?.count ?? 0;

    // Transform data
    type RawCommentRow = {
      author_full_name: string | null;
      author_avatar_url: string | null;
      review_listing_id: number | null;
      review_user_id: string | null;
      [key: string]: unknown;
    };

    const transformedComments = (comments as RawCommentRow[]).map(
      (comment) => {
        const {
          author_full_name,
          author_avatar_url,
          review_listing_id: _review_listing_id,
          review_user_id: _review_user_id,
          ...rest
        } = comment;
        return {
          ...rest,
          author_name: author_full_name || null,
          author_avatar: author_avatar_url || null,
        };
      }
    );

    // Get statistics
    const { rows: statsData } = await query(
      "SELECT status FROM public.review_comments"
    );

    const statistics = (() => {
      const stats = {
        totalComments: 0,
        pendingComments: 0,
        approvedComments: 0,
        rejectedComments: 0,
        flaggedComments: 0,
      };
      stats.totalComments = statsData.length;
      (statsData as { status: string }[]).forEach((comment) => {
        switch (comment.status) {
          case "pending":
            stats.pendingComments++;
            break;
          case "approved":
            stats.approvedComments++;
            break;
          case "rejected":
            stats.rejectedComments++;
            break;
          case "flagged":
            stats.flaggedComments++;
            break;
        }
      });
      return stats;
    })();

    const response: CommentListResponse & { statistics: typeof statistics } = {
      comments: transformedComments as unknown as CommentWithAuthor[],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
      statistics,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
