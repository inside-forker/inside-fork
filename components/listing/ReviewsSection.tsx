"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaginatedReviews } from "@/components/listing/PaginatedReviews";
import { ReviewCreationModal } from "@/components/review/ReviewCreationModal";
import { FullScreenReview } from "@/components/review/FullScreenReview";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useToast } from "@/hooks/use-toast";
import { useBranchSelection } from "@/lib/context/BranchSelectionContext";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import {
  useListingReviewsStore,
  useListingReviewsRealtime,
} from "@/lib/context/listingReviewsStore";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";
import { Star, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumHeading } from "@/components/brand/Typography";

interface Review {
  id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  branch_id?: number | null;
  branch_name?: string;
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

interface Branch {
  id: number;
  name: string;
}

interface ReviewsSectionProps {
  initialReviews: Review[];
  listingId: number;
  listingName: string;
  branches: Branch[];
}

export function ReviewsSection({
  initialReviews,
  listingId,
  listingName,
  branches,
}: ReviewsSectionProps) {
  const { toast } = useToast();
  const { selectedBranchId } = useBranchSelection();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const { user: _currentUser, isLoading: isCheckingAuth } = useSupabaseUser();

  // Check if desktop (lg breakpoint = 1024px, same as ListingPageWrapper)
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Use the global reviews store
  const storeReviews = useListingReviewsStore((state) => state.reviews);
  const currentListingId = useListingReviewsStore(
    (state) => state.currentListingId,
  );
  const _loading = useListingReviewsStore((state) => state.loading);

  // Initialize real-time updates at component level
  useListingReviewsRealtime(listingId);

  // Use reviews from store, fallback to initial reviews if store is empty
  const displayReviews =
    currentListingId === listingId && storeReviews.length > 0
      ? storeReviews
      : initialReviews;

  const handleWriteReview = () => {
    if (!_currentUser) {
      toast({
        title: "Login Required",
        description: "Please log in to write a review for this place.",
        variant: "destructive",
      });
      return;
    }
    setIsReviewModalOpen(true);
  };

  const handleReviewCreated = () => {
    // Close the modal - real-time updates will handle showing the new review
    setIsReviewModalOpen(false);
    toast({
      title: "Review Submitted",
      description: "Your review has been submitted and is pending approval.",
    });
  };

  // Get selected branch details for review creation modal
  const selectedBranch =
    (selectedBranchId ? branches.find((b) => b.id === selectedBranchId) : null) ||
    branches[0] || { id: 0, name: "" };

  const hasUserReviewed = React.useMemo(() => {
    if (!_currentUser || !displayReviews) return false;
    return displayReviews.some((r) => r.user_id === _currentUser.id);
  }, [_currentUser, displayReviews]);

  return (
    <>
      <motion.div
        id="reviews-section"
        className="space-y-6 md:space-y-8"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={sectionVariants}
      >
        {/* Header Section (Unified) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Reviews & <span className="gradient-text-primary">Ratings</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                What people are saying
              </p>
            </div>
          </div>

          {/* Action Area: Badge or Write Review Button */}
          <div>
            {_currentUser && !hasUserReviewed ? (
              <Button
                onClick={handleWriteReview}
                disabled={isCheckingAuth}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 w-9 h-9 md:w-auto md:h-10 md:px-4 rounded-full md:rounded-md p-0"
              >
                {isCheckingAuth ? (
                  <Loader2 className="h-4 w-4 md:mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 md:mr-2" />
                )}
                <span className="hidden md:inline">Write a Review</span>
              </Button>
            ) : (
              <Badge
                variant="outline"
                className="px-4 py-2 font-semibold border-2 bg-primary/5"
              >
                {displayReviews?.length || 0} Reviews
              </Badge>
            )}
          </div>
        </div>

        <PaginatedReviews
          reviews={displayReviews}
          listingId={listingId}
          currentUser={_currentUser}
          isCheckingAuth={isCheckingAuth}
          onWriteReview={handleWriteReview}
        />
      </motion.div>

      {/* Conditional rendering: Desktop uses modal, Mobile uses fullscreen drawer wrapped in AnimatePresence */}
      {isDesktop ? (
        <ReviewCreationModal
          listingId={listingId}
          listingName={listingName}
          branchId={selectedBranch.id}
          branchName={selectedBranch.name}
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onReviewCreated={handleReviewCreated}
        />
      ) : (
        <AnimatePresence>
          {isReviewModalOpen && (
            <FullScreenReview
              listingId={listingId}
              listingName={listingName}
              branchId={selectedBranch.id}
              branchName={selectedBranch.name}
              isOpen={isReviewModalOpen}
              onClose={() => setIsReviewModalOpen(false)}
              onReviewCreated={handleReviewCreated}
            />
          )}
        </AnimatePresence>
      )}
    </>
  );
}
