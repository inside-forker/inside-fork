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

/** Throws 404 unless the review exists and is approved (comments live on
 * approved reviews only). */
async function assertApprovedReview(reviewId: number): Promise<void> {
  const { rows } = await query(
    `SELECT id, status FROM reviews WHERE id = $1`,
    [reviewId],
  );
  const review = rows[0];
  if (!review || review.status !== "approved") {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
}

/**
 * GET /api/mobile/v1/reviews/{reviewId}/comments?page=&limit=
 *
 * Paginated top-level approved comments for an approved review, each with an
 * approved-reply count. Pending comments are invisible to everyone (incl. the
 * author) until approved.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;
  await assertApprovedReview(reviewId);

  // Hide comments from users the caller has blocked. Each query below has
  // its own param list, so the blocked-clause placeholder index is computed
  // per query rather than shared.
  const blockedClause = (paramIndex: number) =>
    `NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.blocker_id = $${paramIndex} AND bu.blocked_id = c.user_id)`;
  const countBlockedClause = (paramIndex: number) =>
    `NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.blocker_id = $${paramIndex} AND bu.blocked_id = user_id)`;

  const rowsParams: unknown[] = [reviewId, limit, offset];
  let rowsBlockedSql = "";
  if (currentUserId) {
    rowsParams.push(currentUserId);
    rowsBlockedSql = ` AND ${blockedClause(rowsParams.length)}`;
  }

  const countParams: unknown[] = [reviewId];
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
         WHERE c.review_id = $1 AND c.parent_id IS NULL AND c.status = 'approved'${rowsBlockedSql}
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        rowsParams,
      ),
      query(
        `SELECT COUNT(*) FROM review_comments WHERE review_id = $1 AND parent_id IS NULL AND status = 'approved'${countBlockedSql}`,
        countParams,
      ),
    ]);
    rows = rowsRes.rows;
    total = Number(countRes.rows[0]?.count ?? 0);
  } catch (error) {
    console.error("[mobile-api] comments query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load comments.", 500);
  }

  const commentRows = rows.map(toNumericCommentRow);
  const ids = commentRows.map((r) => r.id);
  const replyCounts: Record<number, number> = {};
  if (ids.length > 0) {
    const { rows: replyRows } = await query(
      `SELECT parent_id FROM review_comments WHERE parent_id = ANY($1::bigint[]) AND status = 'approved'`,
      [ids],
    );
    for (const r of replyRows) {
      if (r.parent_id != null) {
        const pid = Number(r.parent_id);
        replyCounts[pid] = (replyCounts[pid] ?? 0) + 1;
      }
    }
  }

  const comments = commentRows.map((r) =>
    toComment(r, currentUserId, replyCounts[r.id] ?? 0),
  );
  return ok(comments, {
    pagination: {
      total,
      page,
      limit,
      has_more: offset + comments.length < total,
    },
  });
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  parent_id: z.number().int().positive().optional(),
});

/**
 * POST /api/mobile/v1/reviews/{reviewId}/comments
 *
 * Create a comment (-> pending). An optional `parent_id` must reference an
 * approved, top-level comment on the same review (replies are single-level).
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const reviewId = parsePathId((await params).reviewId, "reviewId");
  const { user } = await requireMobileUser(request);

  const parsed = createCommentSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid comment.",
      400,
      first?.path.join("."),
    );
  }
  const { content, parent_id } = parsed.data;

  await assertApprovedReview(reviewId);

  if (parent_id != null) {
    const { rows: parentRows } = await query(
      `SELECT id FROM review_comments
       WHERE id = $1 AND review_id = $2 AND parent_id IS NULL AND status = 'approved'`,
      [parent_id, reviewId],
    );
    if (!parentRows[0]) {
      throw new MobileApiError(
        "not_found",
        "Parent comment not found.",
        404,
        "parent_id",
      );
    }
  }

  let created: CommentRowLike;
  try {
    const { rows } = await query(
      `WITH inserted AS (
         INSERT INTO review_comments (review_id, user_id, content, parent_id, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *
       )
       SELECT ${COMMENT_SQL_COLUMNS}
       FROM inserted c
       LEFT JOIN profiles p ON p.id = c.user_id`,
      [reviewId, user.id, content, parent_id ?? null],
    );
    created = toNumericCommentRow(rows[0]);
  } catch (error) {
    console.error("[mobile-api] comment insert failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to create comment.",
      500,
    );
  }

  return ok(toComment(created, user.id, 0), undefined, { status: 201 });
});
