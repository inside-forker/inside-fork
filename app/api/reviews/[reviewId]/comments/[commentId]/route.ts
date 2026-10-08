import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { validateReviewContent } from "@/lib/reviews/profanity-filter";
import { CommentWithAuthor, CommentStatus } from "@/types/comment.types";

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

function toNumericComment<T extends { id: unknown; review_id: unknown; parent_id: unknown }>(
  row: T
) {
  return {
    ...row,
    id: Number(row.id),
    review_id: Number(row.review_id),
    parent_id: row.parent_id !== null ? Number(row.parent_id) : null,
  };
}

// GET /api/reviews/[reviewId]/comments/[commentId] - Get a specific comment with its replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Get the main comment with author info
    const { rows: commentRows } = await query(
      `SELECT ${commentColumns("c")},
         CASE WHEN p.id IS NOT NULL
           THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
           ELSE NULL
         END AS profiles
       FROM review_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.id = $1 AND c.review_id = $2 AND c.status = 'approved' AND c.parent_id IS NULL`,
      [commentId, reviewId]
    );
    const comment = commentRows[0];

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Get replies to this comment
    const { rows: replyRows } = await query(
      `SELECT ${commentColumns("c")},
         CASE WHEN p.id IS NOT NULL
           THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
           ELSE NULL
         END AS profiles
       FROM review_comments c
       LEFT JOIN profiles p ON p.id = c.user_id
       WHERE c.parent_id = $1 AND c.status = 'approved'
       ORDER BY c.created_at ASC`,
      [commentId]
    );

    // Transform data
    const transformedComment = {
      ...toNumericComment(comment),
      author_name: comment.profiles?.full_name || null,
      author_avatar: comment.profiles?.avatar_url || null,
    };

    const transformedReplies = replyRows.map((reply) => ({
      ...toNumericComment(reply),
      author_name: reply.profiles?.full_name || null,
      author_avatar: reply.profiles?.avatar_url || null,
    }));

    return NextResponse.json({
      thread: {
        comment: transformedComment as CommentWithAuthor,
        replies: transformedReplies as CommentWithAuthor[],
      },
      total_replies: transformedReplies.length,
    });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT /api/reviews/[reviewId]/comments/[commentId] - Update a comment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Parse request body - support both content updates and status moderation
    const body = await request.json();
    const { content, status } = body;

    // Check if user is admin for status updates
    const { rows: roleRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const isAdmin =
      roleRows[0]?.role === "admin" || roleRows[0]?.role === "super_admin";

    // Validate request
    if (content !== undefined && status !== undefined) {
      return NextResponse.json(
        { error: "Cannot update both content and status in one request" },
        { status: 400 }
      );
    }

    if (!content && !status) {
      return NextResponse.json(
        { error: "Either content or status must be provided" },
        { status: 400 }
      );
    }

    // Validate content if provided
    if (content !== undefined) {
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
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses: CommentStatus[] = [
        "pending",
        "approved",
        "rejected",
        "flagged",
      ];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
    }

    // Check if comment exists and user owns it
    const { rows: existingRows } = await query(
      `SELECT id, user_id, status FROM review_comments WHERE id = $1 AND review_id = $2`,
      [commentId, reviewId]
    );
    const existingComment = existingRows[0];

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // Check permissions based on operation type
    if (content !== undefined) {
      // Content updates: only comment owner can edit pending comments
      if (existingComment.user_id !== session.userId) {
        return NextResponse.json(
          { error: "You can only edit your own comments" },
          { status: 403 }
        );
      }

      if (existingComment.status !== "pending") {
        return NextResponse.json(
          { error: "You can only edit pending comments" },
          { status: 400 }
        );
      }
    } else if (status !== undefined) {
      // Status updates: only admins can moderate
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Admin access required for moderation" },
          { status: 403 }
        );
      }
    }

    // Prepare update
    const setClauses: string[] = ["updated_at = NOW()"];
    const updateParams: unknown[] = [];

    if (content !== undefined) {
      updateParams.push(content.trim());
      setClauses.push(`content = $${updateParams.length}`);
    }

    if (status !== undefined) {
      updateParams.push(status);
      setClauses.push(`status = $${updateParams.length}`);
      updateParams.push(session.userId);
      setClauses.push(`moderated_by = $${updateParams.length}`);
      setClauses.push(`moderated_at = NOW()`);
    }

    updateParams.push(commentId, reviewId);
    const idIdx = updateParams.length - 1;
    const reviewIdIdx = updateParams.length;

    let updatedComment;
    try {
      const { rows: updatedRows } = await query(
        `WITH updated AS (
           UPDATE review_comments
           SET ${setClauses.join(", ")}
           WHERE id = $${idIdx} AND review_id = $${reviewIdIdx}
           RETURNING *
         )
         SELECT ${commentColumns("updated")},
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS profiles
         FROM updated
         LEFT JOIN profiles p ON p.id = updated.user_id`,
        updateParams
      );
      updatedComment = updatedRows[0];
    } catch (error) {
      console.error("Error updating comment:", error);
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    // The old Supabase `.update().select().single()` threw (surfacing as a
    // 500) if the row vanished between the existence check above and this
    // UPDATE (e.g. a concurrent delete) - the CTE above would otherwise
    // return zero rows silently, so fail the same way explicitly here.
    if (!updatedComment) {
      console.error("Error updating comment: no matching row after update");
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    // Transform the response data
    const transformedComment = {
      ...toNumericComment(updatedComment),
      author_name: updatedComment.profiles?.full_name || null,
      author_avatar: updatedComment.profiles?.avatar_url || null,
    };

    return NextResponse.json({
      comment: transformedComment as CommentWithAuthor,
      message: "Comment updated successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PUT /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/reviews/[reviewId]/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string; commentId: string }> }
) {
  try {
    // Check authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewId: reviewIdParam, commentId: commentIdParam } = await params;
    const reviewId = parseInt(reviewIdParam);
    const commentId = parseInt(commentIdParam);

    if (isNaN(reviewId) || isNaN(commentId)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    // Check if comment exists and user owns it
    const { rows: existingRows } = await query(
      `SELECT id, user_id, status FROM review_comments WHERE id = $1 AND review_id = $2`,
      [commentId, reviewId]
    );
    const existingComment = existingRows[0];

    if (!existingComment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.user_id !== session.userId) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    if (existingComment.status !== "pending") {
      return NextResponse.json(
        { error: "You can only delete pending comments" },
        { status: 400 }
      );
    }

    // Delete the comment (this will cascade to delete replies, per the
    // review_comments_parent_id_fkey ON DELETE CASCADE constraint)
    try {
      await query(
        `DELETE FROM review_comments WHERE id = $1 AND review_id = $2`,
        [commentId, reviewId]
      );
    } catch (error) {
      console.error("Error deleting comment:", error);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/reviews/[reviewId]/comments/[commentId]:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
