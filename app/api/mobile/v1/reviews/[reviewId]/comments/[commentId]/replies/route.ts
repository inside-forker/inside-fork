import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination } from "@/lib/mobile/pagination";
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
  "THEN json_build_object('username', CASE WHEN p.deleted_at IS NOT NULL THEN 'Inside Karachi User' ELSE p.username END, 'avatar_url', p.avatar_url) " +
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

/** The parent must be an approved, top-level comment on this review (replies are
 * single-level - you cannot reply to a reply). Throws 404 otherwise. */
async function assertApprovedParent(
  reviewId: number,
  commentId: number,
): Promise<void> {
  const { rows } = await query(
    `SELECT id FROM review_comments
     WHERE id = $1 AND review_id = $2 AND parent_id IS NULL AND status = 'approved'`,
    [commentId, reviewId],
  );
  if (!rows[0]) {
    throw new MobileApiError("not_found", "Parent comment not found.", 404);
  }
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments/{commentId}/replies
 *
 * Paginated approved replies to a top-level comment.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;
  await assertApprovedParent(reviewId, commentId);

  // Hide replies from users the caller has blocked (same pattern as the
  // top-level comments route).
  const blockedClause = (paramIndex: number) =>
    `NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.blocker_id = $${paramIndex} AND bu.blocked_id = c.user_id)`;
  const countBlockedClause = (paramIndex: number) =>
    `NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.blocker_id = $${paramIndex} AND bu.blocked_id = user_id)`;

  const rowsParams: unknown[] = [commentId, limit, offset];
  let rowsBlockedSql = "";
  if (currentUserId) {
    rowsParams.push(currentUserId);
    rowsBlockedSql = ` AND ${blockedClause(rowsParams.length)}`;
  }

  const countParams: unknown[] = [commentId];
  let countBlockedSql = "";
  if (currentUserId) {
    countParams.push(currentUserId);
    countBlockedSql = ` AND ${countBlockedClause(countParams.length)}`;
  }

  let rows: Record<string, unknown>[];
  let total: number;
  try {
    const [rowsRes, countRes] = await Promise.all([
      query(
        `SELECT ${COMMENT_SQL_COLUMNS} ${COMMENT_FROM_JOIN}
         WHERE c.parent_id = $1 AND c.status = 'approved'${rowsBlockedSql}
         ORDER BY c.created_at ASC
         LIMIT $2 OFFSET $3`,
        rowsParams,
      ),
      query(
        `SELECT COUNT(*) FROM review_comments WHERE parent_id = $1 AND status = 'approved'${countBlockedSql}`,
        countParams,
      ),
    ]);
    rows = rowsRes.rows;
    total = Number(countRes.rows[0]?.count ?? 0);
  } catch (error) {
    console.error("[mobile-api] replies query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load replies.", 500);
  }

  const replies = rows
    .map(toNumericCommentRow)
    .map((r) => toComment(r, currentUserId));
  return ok(replies, {
    pagination: {
      total,
      page,
      limit,
      has_more: offset + replies.length < total,
    },
  });
});

const createReplySchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/comments/{commentId}/replies
 *
 * Reply to a top-level approved comment (-> pending).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const p = await params;
  const reviewId = parsePathId(p.reviewId, "reviewId");
  const commentId = parsePathId(p.commentId, "commentId");
  const { user } = await requireMobileUser(request);

  const parsed = createReplySchema.safeParse(await request.json());
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "Invalid reply.",
      400,
      "content",
    );
  }

  await assertApprovedParent(reviewId, commentId);

  let created: CommentRowLike;
  try {
    const { rows } = await query(
      `WITH inserted AS (
         INSERT INTO review_comments (review_id, user_id, parent_id, content, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *
       )
       SELECT ${COMMENT_SQL_COLUMNS}
       FROM inserted c
       LEFT JOIN profiles p ON p.id = c.user_id`,
      [reviewId, user.id, commentId, parsed.data.content],
    );
    created = toNumericCommentRow(rows[0]);
  } catch (error) {
    console.error("[mobile-api] reply insert failed:", error);
    throw new MobileApiError("internal_error", "Failed to create reply.", 500);
  }

  return ok(toComment(created, user.id, 0), undefined, { status: 201 });
});
