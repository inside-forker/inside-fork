import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { toComment, type CommentRowLike } from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const COMMENT_SQL_COLUMNS =
  "c.id, c.review_id, c.user_id, c.parent_id, c.content, c.status, " +
  "to_json(c.created_at) #>> '{}' AS created_at, " +
  "to_json(c.updated_at) #>> '{}' AS updated_at, " +
  "CASE WHEN p.id IS NOT NULL " +
  "THEN json_build_object('username', CASE WHEN p.deleted_at IS NOT NULL THEN 'Insider' ELSE p.username END, 'avatar_url', p.avatar_url) " +
  "ELSE NULL END AS profiles";

const COMMENT_FROM_JOIN =
  "FROM review_comments c LEFT JOIN profiles p ON p.id = c.user_id";

function toNumericCommentRow(row: Record<string, unknown>): CommentRowLike {
  return {
    ...row,
    id: Number(row.id),
    review_id: Number(row.review_id),
    parent_id: row.parent_id !== null ? Number(row.parent_id) : null,
  } as unknown as CommentRowLike;
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * A comment thread: the approved top-level comment plus its approved replies.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  const { rows: commentRows } = await query(
    `SELECT ${COMMENT_SQL_COLUMNS} ${COMMENT_FROM_JOIN}
     WHERE c.id = $1 AND c.review_id = $2 AND c.parent_id IS NULL AND c.status = 'approved'`,
    [commentId, reviewId],
  );
  if (!commentRows[0]) {
    throw new MobileApiError("not_found", "Comment not found.", 404);
  }
  const comment = toNumericCommentRow(commentRows[0]);

  const { rows: replyRows } = await query(
    `SELECT ${COMMENT_SQL_COLUMNS} ${COMMENT_FROM_JOIN}
     WHERE c.parent_id = $1 AND c.status = 'approved'
     ORDER BY c.created_at ASC`,
    [commentId],
  );
  const replies = replyRows
    .map(toNumericCommentRow)
    .map((r) => toComment(r, currentUserId));

  return ok({
    comment: toComment(comment, currentUserId, replies.length),
    replies,
  });
});

const editCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

/** Loads a comment scoped to the review for ownership/status pre-checks. */
async function loadOwnPending(
  reviewId: number,
  commentId: number,
  userId: string,
  verb: string,
): Promise<void> {
  const { rows } = await query(
    `SELECT id, user_id, status FROM review_comments WHERE id = $1 AND review_id = $2`,
    [commentId, reviewId],
  );
  const existing = rows[0];
  if (!existing) {
    throw new MobileApiError("not_found", "Comment not found.", 404);
  }
  if (existing.user_id !== userId) {
    throw new MobileApiError(
      "forbidden",
      `You can only ${verb} your own comments.`,
      403,
    );
  }
  if (existing.status !== "pending") {
    throw new MobileApiError(
      "validation_error",
      `You can only ${verb} pending comments.`,
      400,
    );
  }
}

/**
 * PATCH /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * Edit your own still-pending comment's content. Owner + pending only - the
 * guards are also folded into the UPDATE so the invariant holds under races.
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user } = await requireMobileUser(request);

  const parsed = editCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Invalid content.",
      400,
      "content",
    );
  }

  await loadOwnPending(reviewId, commentId, user.id, "edit");

  let updated: CommentRowLike | undefined;
  try {
    const { rows } = await query(
      `WITH updated AS (
         UPDATE review_comments SET content = $1
         WHERE id = $2 AND review_id = $3 AND user_id = $4 AND status = 'pending'
         RETURNING *
       )
       SELECT ${COMMENT_SQL_COLUMNS}
       FROM updated c
       LEFT JOIN profiles p ON p.id = c.user_id`,
      [parsed.data.content, commentId, reviewId, user.id],
    );
    updated = rows[0] ? toNumericCommentRow(rows[0]) : undefined;
  } catch (error) {
    console.error("[mobile-api] comment edit failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to update comment.",
      500,
    );
  }
  if (!updated) {
    // Pre-check passed but the row changed (e.g. moderated) before the write.
    throw new MobileApiError(
      "conflict",
      "Comment can no longer be edited.",
      409,
    );
  }

  return ok(toComment(updated, user.id));
});

/**
 * DELETE /api/mobile/v1/reviews/{reviewId}/comments/{commentId}
 *
 * Delete your own still-pending comment (replies cascade). Owner + pending only,
 * enforced atomically in the DELETE.
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user } = await requireMobileUser(request);

  await loadOwnPending(reviewId, commentId, user.id, "delete");

  let deletedCount: number;
  try {
    const { rows } = await query(
      `DELETE FROM review_comments
       WHERE id = $1 AND review_id = $2 AND user_id = $3 AND status = 'pending'
       RETURNING id`,
      [commentId, reviewId, user.id],
    );
    deletedCount = rows.length;
  } catch (error) {
    console.error("[mobile-api] comment delete failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to delete comment.",
      500,
    );
  }
  if (deletedCount === 0) {
    throw new MobileApiError(
      "conflict",
      "Comment can no longer be deleted.",
      409,
    );
  }

  return ok({ deleted: true });
});
