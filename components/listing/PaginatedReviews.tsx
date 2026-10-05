"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Star,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  MapPin,
  X,
  MoreVertical,
  Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentSection } from "@/components/review/CommentSection";
import { HelpfulVoteButton } from "@/components/review/HelpfulVoteButton";
import { ReportContentModal } from "@/components/shared/ReportContentModal";
import { useToast } from "@/hooks/use-toast";
import {
  sectionVariants,
  cardVariants,
  cardGridVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

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

interface PaginatedReviewsProps {
  reviews: Review[];
  listingId: number;
  currentUser?: {
    id: string;
    email?: string;
  } | null;
  isCheckingAuth?: boolean;
  onWriteReview?: () => void;
}

const REVIEWS_PER_PAGE = 5;

export function PaginatedReviews({
  reviews,
  listingId: _listingId,
  currentUser,
  isCheckingAuth = false,
  onWriteReview,
}: PaginatedReviewsProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedComments, setExpandedComments] = useState<Set<number>>(
    new Set(),
  );
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [reportingReviewId, setReportingReviewId] = useState<number | null>(null);
  const { toast } = useToast();

  const handleReportClick = (reviewId: number) => {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "Please sign in to report a review",
        variant: "destructive",
      });
      return;
    }
    setReportingReviewId(reviewId);
  };

  const toggleComments = (reviewId: number) => {
    setExpandedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const openLightbox = (
    imageUrl: string,
    allImages: string[],
    index: number,
  ) => {
    setLightboxImage(imageUrl);
    setLightboxImages(allImages);
    setLightboxIndex(index);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    setLightboxImages([]);
    setLightboxIndex(0);
    document.body.style.overflow = "unset";
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (lightboxImages.length === 0) return;
    const newIndex =
      direction === "prev"
        ? (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length
        : (lightboxIndex + 1) % lightboxImages.length;
    setLightboxIndex(newIndex);
    setLightboxImage(lightboxImages[newIndex]);
  };

  const totalPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const startIndex = (currentPage - 1) * REVIEWS_PER_PAGE;
  const endIndex = startIndex + REVIEWS_PER_PAGE;
  const currentReviews = reviews.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    // Smooth scroll to reviews section
    const reviewsSection = document.getElementById("reviews-section");
    if (reviewsSection) {
      reviewsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const goToPrevious = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  if (!reviews || reviews.length === 0) {
    return (
      <motion.div
        className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-6 md:p-8 text-center"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={sectionVariants}
      >
        {/* Background effects for consistency */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
        <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

        <div className="relative">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20">
            <Star className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          </div>
          <h4 className="text-lg md:text-xl font-bold mb-2">No Reviews Yet</h4>
          <p className="text-muted-foreground mb-6 text-sm md:text-base">
            Be the first to share your experience with this place!
          </p>

          {/* Write Review Button - Only show if user is authenticated */}
          {currentUser && (
            <Button
              onClick={onWriteReview}
              disabled={isCheckingAuth}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 px-6 py-3"
            >
              {isCheckingAuth ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Write a Review
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Reviews List */}
      <motion.div
        className="space-y-4 md:space-y-6"
        variants={cardGridVariants}
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
      >
        {currentReviews.map((review) => (
          <motion.div
            key={review.id}
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={viewportSettings}
            className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-4 md:p-6"
          >
            {/* Background effects for consistency */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
            <div className="absolute top-2 right-2 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg" />

            <div className="relative flex items-start gap-3 md:gap-4">
              <Avatar className="w-10 h-10 md:w-12 md:h-12 border border-primary/20 bg-primary/10">
                <AvatarImage
                  src={review.profiles?.avatar_url || undefined}
                  alt={review.profiles?.full_name || "User"}
                  className="object-cover"
                />
                <AvatarFallback className="text-sm md:text-base font-semibold text-primary bg-primary/10">
                  {review.profiles?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                  <h4 className="font-semibold text-sm md:text-base">
                    {review.profiles?.full_name || "Anonymous"}
                  </h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    {review.branch_name && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-primary/5 border-primary/20 text-primary"
                      >
                        <MapPin className="w-3 h-3 mr-1" />
                        {review.branch_name}
                      </Badge>
                    )}
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? "text-amber-400"
                              : "text-gray-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs md:text-sm text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                    <HelpfulVoteButton
                      reviewId={review.id}
                      initialHelpfulCount={review.helpful_count || 0}
                      className="ml-2"
                    />
                    {(!currentUser || currentUser.id !== review.user_id) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleReportClick(review.id)}>
                            <Flag className="h-4 w-4 mr-2" />
                            Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                {review.comment && (
                  <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-3">
                    {review.comment}
                  </p>
                )}

                {/* Review Images Gallery */}
                {review.review_images && review.review_images.length > 0 && (
                  <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {review.review_images
                      .sort(
                        (a, b) =>
                          new Date(a.created_at).getTime() -
                          new Date(b.created_at).getTime(),
                      )
                      .map((image, index) => {
                        const allImageUrls =
                          review.review_images?.map((img) => img.image_url) ||
                          [];
                        return (
                          <div
                            key={image.id}
                            className="relative aspect-square overflow-hidden rounded-lg border border-border/30 bg-muted/20 hover:border-primary/50 transition-all duration-300 group cursor-pointer"
                            onClick={() =>
                              openLightbox(image.image_url, allImageUrls, index)
                            }
                          >
                            <Image
                              src={image.image_url}
                              alt="Review image"
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Comments Section - Always show for all reviews */}
                <div className="mt-4 pt-4 border-t border-border/30">
                  {!expandedComments.has(review.id) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(review.id)}
                      className="text-muted-foreground hover:text-foreground hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors duration-200 p-0 h-auto"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <span className="text-sm">
                        {review.comment_count && review.comment_count > 0
                          ? `Show ${review.comment_count} comment${
                              review.comment_count !== 1 ? "s" : ""
                            }`
                          : "Add a comment"}
                      </span>
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComments(review.id)}
                        className="text-muted-foreground hover:text-foreground hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors duration-200 p-0 h-auto w-full justify-start"
                      >
                        <ChevronUp className="h-4 w-4 mr-2" />
                        <span className="text-sm">
                          {review.comment_count && review.comment_count > 0
                            ? "Hide comments"
                            : "Hide comment form"}
                        </span>
                      </Button>
                      <div className="bg-muted/20 rounded-lg p-4 border border-border/20">
                        <CommentSection reviewId={review.id} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Pagination Controls - Only show if more than 5 reviews */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/20">
          {/* Page Info */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, reviews.length)} of{" "}
              {reviews.length} reviews
            </span>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentPage === 1}
              className="h-9 px-3 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => {
                  // Show first page, last page, current page and adjacent pages
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  // Show ellipsis
                  const showEllipsis =
                    (page === 2 && currentPage > 4) ||
                    (page === totalPages - 1 && currentPage < totalPages - 3);

                  if (!showPage && !showEllipsis) return null;

                  if (showEllipsis) {
                    return (
                      <span
                        key={`ellipsis-${page}`}
                        className="px-2 text-muted-foreground"
                      >
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className={`h-9 w-9 p-0 ${
                        currentPage === page
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20"
                      }`}
                    >
                      {page}
                    </Button>
                  );
                },
              )}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentPage === totalPages}
              className="h-9 px-3 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center !mt-0"
          style={{
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.97) 100%)",
            backdropFilter: "blur(8px)",
          }}
          onClick={closeLightbox}
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-[9999] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 cursor-pointer"
            aria-label="Close lightbox"
            style={{ cursor: "pointer" }}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Navigation Buttons */}
          {lightboxImages.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox("prev");
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-[9999] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 cursor-pointer"
                aria-label="Previous image"
                style={{ cursor: "pointer" }}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateLightbox("next");
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-[9999] p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all duration-200 cursor-pointer"
                aria-label="Next image"
                style={{ cursor: "pointer" }}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {lightboxImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm">
              {lightboxIndex + 1} / {lightboxImages.length}
            </div>
          )}

          {/* Main Image */}
          <div
            className="relative w-full h-full flex items-center justify-center p-4 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative max-w-7xl max-h-full w-full h-full">
              <Image
                src={lightboxImage}
                alt="Review image"
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            </div>
          </div>
        </div>
      )}

      <ReportContentModal
        isOpen={reportingReviewId !== null}
        onClose={() => setReportingReviewId(null)}
        endpoint={`/api/reviews/${reportingReviewId}/report`}
      />
    </motion.div>
  );
}
