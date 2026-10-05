"use client";

import { ReviewsSection } from "@/components/listing/ReviewsSection";

interface Branch {
  id: number;
  name: string;
}

interface BaseReview {
  id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  listing_id?: number;
  branch_id?: number | null;
  helpful_count?: number | null;
  comment_count?: number | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  review_images?: Array<{
    id: number;
    image_url: string;
    created_at: string;
  }> | null;
}

interface ReviewWithBranchName extends BaseReview {
  branch_name?: string;
}

interface ReviewsContainerClientProps {
  initialReviews: BaseReview[];
  listingId: number;
  listingName: string;
  branches: Branch[];
}

export function ReviewsContainerClient({
  initialReviews,
  listingId,
  listingName,
  branches,
}: ReviewsContainerClientProps) {
  // Create a branch lookup map for efficient access
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));

  // Attach branch names to all initial reviews without filtering
  const reviewsWithBranchNames: ReviewWithBranchName[] = initialReviews.map(
    (review) => ({
      ...review,
      branch_name: review.branch_id
        ? branchMap.get(review.branch_id) || "Branch"
        : undefined,
    }),
  );

  return (
    <ReviewsSection
      initialReviews={reviewsWithBranchNames}
      listingId={listingId}
      listingName={listingName}
      branches={branches}
    />
  );
}
