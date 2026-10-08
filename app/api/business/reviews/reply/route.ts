import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import {
  verifyBusinessOwner,
  apiSuccess,
  apiError,
  handleApiError,
} from "@/lib/business-owner/api-utils";
import { z } from "zod";
import { validateReviewContent } from "@/lib/reviews/profanity-filter";
import { notifyReviewReply } from "@/lib/reviews/notifications";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  reviewId: z.number().positive(),
  content: z.string().min(10).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyBusinessOwner();

    const body = await request.json();
    const validation = replySchema.safeParse(body);

    if (!validation.success) {
      return apiError(
        "Invalid input: " + validation.error.errors[0].message,
        400,
      );
    }

    const { reviewId, content } = validation.data;

    // Check for prohibited/explicit language
    const contentValidation = validateReviewContent(content);
    if (!contentValidation.isValid) {
      return apiError(contentValidation.error ?? "Invalid content", 400);
    }

    // Get the review and verify ownership
    const { rows: reviewRows } = await query(
      `SELECT r.id, r.user_id AS reviewer_id, r.listing_id, l.owner_id, l.name AS listing_name
       FROM reviews r
       JOIN listings l ON l.id = r.listing_id
       WHERE r.id = $1`,
      [reviewId],
    );
    const review = reviewRows[0];

    if (!review) {
      return apiError("Review not found", 404);
    }

    if (review.owner_id !== userId) {
      return apiError("You do not own this listing", 403);
    }

    // Check if already replied
    const { rows: existingReplyRows } = await query(
      `SELECT id FROM review_comments WHERE review_id = $1 AND user_id = $2`,
      [reviewId, userId],
    );

    if (existingReplyRows.length > 0) {
      return apiError("You have already replied to this review", 400);
    }

    // Create the reply (auto-approved)
    let comment;
    try {
      const { rows: insertedRows } = await query(
        `INSERT INTO review_comments (review_id, user_id, content, status, edit_count, moderated_at)
         VALUES ($1, $2, $3, 'approved', 0, NOW())
         RETURNING *`,
        [reviewId, userId, content],
      );
      comment = insertedRows[0];
    } catch (commentError) {
      throw new Error(
        `Failed to create reply: ${commentError instanceof Error ? commentError.message : "Unknown error"}`,
      );
    }

    // Notify the reviewer of the business owner's reply
    try {
      if (review.reviewer_id && review.reviewer_id !== userId) {
        await notifyReviewReply({
          review: {
            reviewId,
            userId: review.reviewer_id,
            listingId: Number(review.listing_id),
          },
          commentId: Number(comment.id),
          replySnippet: content.slice(0, 200),
        });
      }
    } catch (notifyError) {
      console.error("Failed to notify reviewer of reply:", notifyError);
    }

    return apiSuccess({
      commentId: comment.id,
      status: "approved",
      message: "Reply published successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
