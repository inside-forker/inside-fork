import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { toReview, type ReviewRowLike } from "@/lib/mobile/mappers";
import { validateReviewContent } from "@/lib/reviews/profanity-filter";
import { cleanupLeaveReviewXpOnDelete } from "@/lib/reviews/moderation-xp";

export const dynamic = "force-dynamic";

const REVIEW_SQL_COLUMNS =
  "r.id, r.listing_id, r.branch_id, r.user_id, r.rating, r.comment, r.status, r.helpful_count, " +
  "to_json(r.created_at) #>> '{}' AS created_at, " +
  "to_json(r.updated_at) #>> '{}' AS updated_at, " +
  "CASE WHEN p.id IS NOT NULL " +
  "THEN json_build_object('username', CASE WHEN p.deleted_at IS NOT NULL THEN 'Insider' ELSE p.username END, 'avatar_url', p.avatar_url) " +
  "ELSE NULL END AS profiles";

function toNumericReviewRow(row: Record<string, unknown>): ReviewRowLike {
  return {
    ...row,
    id: Number(row.id),
    listing_id: row.listing_id !== null ? Number(row.listing_id) : null,
    branch_id: row.branch_id !== null ? Number(row.branch_id) : null,
  } as unknown as ReviewRowLike;
}

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).max(500).trim().optional(),
});

/**
 * PATCH /api/mobile/v1/reviews/{reviewId}
 * Edit your own review (rating and/or comment).
 */
export const PATCH = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const reviewId = Number((await params)?.reviewId);
  if (!Number.isFinite(reviewId) || reviewId <= 0) {
    throw new MobileApiError("validation_error", "Invalid reviewId.", 400);
  }

  const parsed = updateReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid review update.",
      400,
      first?.path.join("."),
    );
  }

  const { rating, comment } = parsed.data;
  if (rating === undefined && comment === undefined) {
    throw new MobileApiError("validation_error", "Nothing to update.", 400);
  }

  if (comment !== undefined) {
    const contentValidation = validateReviewContent(comment);
    if (!contentValidation.isValid) {
      throw new MobileApiError(
        "validation_error",
        contentValidation.error ?? "Invalid content.",
        400,
        "comment",
      );
    }
  }

  // Verify ownership
  const { rows: existingRows } = await query(
    `SELECT id, user_id, listing_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (!existingRows[0]) {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
  if (existingRows[0].user_id !== user.id) {
    throw new MobileApiError(
      "forbidden",
      "You can only edit your own reviews.",
      403,
    );
  }

  let updatedRow: ReviewRowLike;
  try {
    const sets: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [reviewId, user.id];

    if (rating !== undefined) {
      values.push(rating);
      sets.push(`rating = $${values.length}`);
    }
    if (comment !== undefined) {
      values.push(comment);
      sets.push(`comment = $${values.length}`);
    }

    const { rows } = await query(
      `WITH updated AS (
         UPDATE reviews
         SET ${sets.join(", ")}
         WHERE id = $1 AND user_id = $2
         RETURNING *
       )
       SELECT ${REVIEW_SQL_COLUMNS}
       FROM updated r
       LEFT JOIN profiles p ON p.id = r.user_id`,
      values,
    );
    if (!rows[0]) {
      throw new MobileApiError("not_found", "Review not found.", 404);
    }
    updatedRow = toNumericReviewRow(rows[0]);
  } catch (error) {
    if (error instanceof MobileApiError) throw error;
    console.error("[mobile-api] review update failed:", error);
    throw new MobileApiError("internal_error", "Failed to update review.", 500);
  }

  // Comment count
  const { rows: commentCountRows } = await query(
    `SELECT COUNT(*) FROM review_comments WHERE review_id = $1 AND status = 'approved'`,
    [reviewId],
  );

  return ok({
    ...toReview(updatedRow, user.id),
    comment_count: Number(commentCountRows[0]?.count ?? 0),
  });
});

/**
 * DELETE /api/mobile/v1/reviews/{reviewId}
 * Delete your own review.
 */
export const DELETE = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const reviewId = Number((await params)?.reviewId);
  if (!Number.isFinite(reviewId) || reviewId <= 0) {
    throw new MobileApiError("validation_error", "Invalid reviewId.", 400);
  }

  const { rows: existingRows } = await query(
    `SELECT id, user_id, listing_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (!existingRows[0]) {
    throw new MobileApiError("not_found", "Review not found.", 404);
  }
  if (existingRows[0].user_id !== user.id) {
    throw new MobileApiError(
      "forbidden",
      "You can only delete your own reviews.",
      403,
    );
  }

  try {
    await query(`DELETE FROM reviews WHERE id = $1 AND user_id = $2`, [
      reviewId,
      user.id,
    ]);

    await cleanupLeaveReviewXpOnDelete({
      reviewId,
      userId: user.id,
      listingId: Number(existingRows[0].listing_id),
    });
  } catch (error) {
    console.error("[mobile-api] review delete failed:", error);
    throw new MobileApiError("internal_error", "Failed to delete review.", 500);
  }

  return ok({ deleted: true });
});
