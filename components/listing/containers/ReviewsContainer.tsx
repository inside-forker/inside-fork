import { query } from "@/lib/db";
import { ReviewsContainerClient } from "./ReviewsContainerClient";

interface ReviewsContainerProps {
  listingId: number;
  listingName: string;
}

export async function ReviewsContainer({
  listingId,
  listingName,
}: ReviewsContainerProps) {
  try {
    // Fetch branches for this listing
    const { rows: branchRows } = await query(
      `SELECT id, name FROM listing_branches
       WHERE listing_id = $1
       ORDER BY is_primary DESC`,
      [listingId],
    );

    if (!branchRows || branchRows.length === 0) {
      return null; // No branches = no reviews section
    }

    // node-pg returns bigint id columns as strings.
    const branches = branchRows.map((b) => ({ ...b, id: Number(b.id) }));

    // Fetch all approved reviews for all branches of this listing
    const { rows: reviewRows } = await query(
      `SELECT r.*, p.full_name, p.avatar_url
       FROM reviews r
       LEFT JOIN profiles p ON p.id = r.user_id
       WHERE r.listing_id = $1 AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [listingId],
    );

    const reviewIds = reviewRows
      .map((r) => Number(r.id))
      .filter((n) => Number.isFinite(n) && n > 0);

    let imagesByReview = new Map<number, Array<{ id: number; image_url: string; created_at: string }>>();
    if (reviewIds.length > 0) {
      const { rows: imageRows } = await query(
        `SELECT id, review_id, image_url, created_at
         FROM review_images WHERE review_id = ANY($1::bigint[])`,
        [reviewIds],
      );
      imagesByReview = new Map();
      for (const img of imageRows) {
        const reviewId = Number(img.review_id);
        const list = imagesByReview.get(reviewId) ?? [];
        list.push({
          id: Number(img.id),
          image_url: img.image_url,
          created_at: img.created_at,
        });
        imagesByReview.set(reviewId, list);
      }
    }

    const reviews = reviewRows.map((r) => ({
      ...r,
      id: Number(r.id),
      listing_id: Number(r.listing_id),
      branch_id: r.branch_id !== null ? Number(r.branch_id) : null,
      rating: Number(r.rating),
      helpful_count: r.helpful_count !== null ? Number(r.helpful_count) : null,
      profiles: r.full_name !== null || r.avatar_url !== null
        ? { full_name: r.full_name, avatar_url: r.avatar_url }
        : null,
      review_images: imagesByReview.get(Number(r.id)) ?? [],
    }));

    // Get comment counts for each review
    let reviewsWithCommentCount = reviews;
    if (reviewIds.length > 0) {
      const { rows: commentCounts } = await query(
        `SELECT review_id, COUNT(*)::integer AS count
         FROM review_comments
         WHERE review_id = ANY($1::bigint[]) AND status = 'approved'
         GROUP BY review_id`,
        [reviewIds],
      );

      const commentCountMap = new Map<number, number>();
      for (const row of commentCounts) {
        commentCountMap.set(Number(row.review_id), Number(row.count));
      }

      reviewsWithCommentCount = reviews.map((review) => ({
        ...review,
        comment_count: commentCountMap.get(review.id) || 0,
      }));
    }

    return (
      <ReviewsContainerClient
        initialReviews={reviewsWithCommentCount}
        listingId={listingId}
        listingName={listingName}
        branches={branches}
      />
    );
  } catch (error) {
    console.error("[ReviewsContainer] Error:", error);
    return null;
  }
}
