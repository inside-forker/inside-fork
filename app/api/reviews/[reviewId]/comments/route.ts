import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { validateReviewContent } from "@/lib/reviews/profanity-filter";
import {
  CreateCommentPayload,
  CommentWithAuthor,
  CommentListResponse,
} from "@/types/comment.types";

function commentColumns(alias: string): string {
  return (
    `${alias}.id, ${alias}.review_id, ${alias}.user_id, ${alias}.parent_id, ${alias}.content, ${alias}.status, ${alias}.moderated_by, ` +
    `to_json(${alias}.moderated_at) #>> '{}' AS moderated_at, ` +
    `to_json(${alias}.created_at) #>> '{}' AS created_at, ` +
    `to_json(${alias}.updated_at) #>> '{}' AS updated_at, ` +
    `${alias}.edit_count, ` +
    `to_json(${alias}.last_edited_at) #>> '{}' AS last_edited_at`
  );
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const role = rows[0]?.role;
  return role === "admin" || role === "super_admin";
}

// GET /api/reviews/[reviewId]/comments - Get comments for a review
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);

    const { reviewId: reviewIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    // Check if user is admin (must verify role, not just login status)
    const session = await getSession(request);
    const isAdmin = session ? await isAdminUser(session.userId) : false;

    // Check if review exists (admins can see comments on all reviews, regular users only on approved reviews)
    const reviewParams: unknown[] = [reviewId];
    let reviewSql = `SELECT id, status FROM reviews WHERE id = $1`;
    if (!isAdmin) {
      reviewSql += ` AND status = 'approved'`;
    }
    const { rows: reviewRows } = await query(reviewSql, reviewParams);
    const review = reviewRows[0];

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20"))
    );
    const offset = (page - 1) * limit;

    // Get top-level comments with author info
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM review_comments WHERE review_id = $1 AND parent_id IS NULL`,
      [reviewId]
    );
    const count = parseInt(countRows[0].count, 10);

    const { rows: commentRows } = await query(
      `SELECT ${commentColumns("c")},
         CASE WHEN p.id IS NOT NULL
           THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
           ELSE NULL
         END AS profiles
       FROM review_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.review_id = $1 AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [reviewId, limit, offset]
    );

    const comments = commentRows.map((row) => ({
      ...row,
      id: Number(row.id),
      review_id: Number(row.review_id),
      parent_id: row.parent_id !== null ? Number(row.parent_id) : null,
    }));

    // Get reply counts for each comment
    const commentIds = comments.map((c) => c.id);
    let replyCounts: { parent_id: number }[] = [];
    if (commentIds.length > 0) {
      const { rows: replyRows } = await query(
        `SELECT parent_id FROM review_comments WHERE parent_id = ANY($1::bigint[])`,
        [commentIds]
      );
      replyCounts = replyRows.map((r) => ({ parent_id: Number(r.parent_id) }));
    }

    // Add reply counts to comments and transform data
    const commentsWithReplyCount = comments.map((comment) => ({
      ...comment,
      author_name: comment.profiles?.full_name || null,
      author_avatar: comment.profiles?.avatar_url || null,
      reply_count: replyCounts.filter((r) => r.parent_id === comment.id).length,
    }));

    const response: CommentListResponse = {
      comments: commentsWithReplyCount as CommentWithAuthor[],
      total: count || 0,
      page,
      limit,
      has_more: (count || 0) > offset + limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/reviews/[reviewId]/comments:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/reviews/[reviewId]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId: reviewIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    if (isNaN(reviewId)) {
      return NextResponse.json({ error: "Invalid review ID" }, { status: 400 });
    }

    // Check if review exists (admins can comment on all reviews, regular users only on approved reviews)
    // First check user's admin status
    const isAdmin = await isAdminUser(session.userId);

    let reviewSql = `SELECT id, status FROM reviews WHERE id = $1`;
    if (!isAdmin) {
      reviewSql += ` AND status = 'approved'`;
    }
    const { rows: reviewRows } = await query(reviewSql, [reviewId]);
    const review = reviewRows[0];

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Parse request body
    const body: CreateCommentPayload = await request.json();
    const { content, parent_id } = body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { error: "Comment content must be less than 2000 characters" },
        { status: 400 }
      );
    }

    // Check for prohibited/explicit language
    const contentValidation = validateReviewContent(content);
    if (!contentValidation.isValid) {
      return NextResponse.json(
        {
          error: contentValidation.error,
          code: contentValidation.code,
        },
        { status: 400 }
      );
    }

    // If this is a reply, validate parent comment exists
    if (parent_id) {
      const { rows: parentRows } = await query(
        `SELECT id, review_id FROM review_comments WHERE id = $1 AND review_id = $2`,
        [parent_id, reviewId]
      );

      if (!parentRows[0]) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    }

    // Create the comment (auto-approved)
    let newComment;
    try {
      const { rows: insertedRows } = await query(
        `WITH inserted AS (
           INSERT INTO review_comments (review_id, user_id, content, parent_id, status, moderated_at)
           VALUES ($1, $2, $3, $4, 'approved', NOW())
           RETURNING *
         )
         SELECT ${commentColumns("inserted")},
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS profiles
         FROM inserted
         LEFT JOIN profiles p ON p.id = inserted.user_id`,
        [reviewId, session.userId, content.trim(), parent_id || null]
      );
      const row = insertedRows[0];
      newComment = {
        ...row,
        id: Number(row.id),
        review_id: Number(row.review_id),
        parent_id: row.parent_id !== null ? Number(row.parent_id) : null,
      };
    } catch (error) {
      console.error("Error creating comment:", error);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedComment = {
      ...newComment,
      author_name: newComment.profiles?.full_name || null,
      author_avatar: newComment.profiles?.avatar_url || null,
    };

    // Award XP for commenting on a review (max 10/day per activity rules).
    // related_id must be the comment's own id, not the reviewId: points_log
    // has a per-(user, related_id, reason) unique dedup, so keying on
    // reviewId would let a user earn comment_review XP only once ever per
    // review, contradicting its "unlimited, up to 10/day" cooldown config -
    // a second comment on the same review would silently fail to award XP.
    try {
      const { awardXP } = await import("@/lib/gamification");
      const xpResult = await awardXP(session.userId, "comment_review", newComment.id);

      if ("error" in xpResult) {
        console.error(
          `[REVIEW COMMENT XP] Failed for user ${session.userId} on review ${reviewId}:`,
          xpResult.error,
          xpResult.details
        );
      } else {
        console.log(
          `[REVIEW COMMENT XP] Awarded ${xpResult.xp_awarded} XP to user ${session.userId}`
        );
      }
    } catch (xpError) {
      console.error(
        `[REVIEW COMMENT XP] Exception for user ${session.userId} on review ${reviewId}:`,
        xpError
      );
    }

    return NextResponse.json({
      comment: transformedComment as CommentWithAuthor,
      message: "Comment published successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/reviews/[reviewId]/comments:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
