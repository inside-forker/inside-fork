"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  User,
  Loader2,
  CheckCircle,
  Upload,
  X,
  MapPin,
} from "lucide-react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useToast } from "@/hooks/use-toast";

interface FullScreenReviewProps {
  listingId: number;
  listingName: string;
  branchId: number;
  branchName: string;
  isOpen: boolean;
  onClose: () => void;
  onReviewCreated?: () => void;
}

export function FullScreenReview({
  listingId,
  listingName,
  branchId,
  branchName,
  isOpen,
  onClose,
  onReviewCreated,
}: FullScreenReviewProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { user, isLoading: isLoadingUser } = useSupabaseUser();
  const [uploadedImages, setUploadedImages] = useState<
    Array<{
      id: number;
      image_url: string;
      tempFileName?: string;
      uploading?: boolean;
    }>
  >([]);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);

  const { toast } = useToast();

  // Track temp images for cleanup
  const tempImagesRef = useRef<string[]>([]);

  // Close and warn if the drawer opened without an authenticated user
  useEffect(() => {
    if (isOpen && !isLoadingUser && !user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to write a review.",
        variant: "destructive",
      });
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isLoadingUser, user]);

  // Cleanup temp images when drawer closes without submission
  useEffect(() => {
    return () => {
      if (!isOpen && tempImagesRef.current.length > 0) {
        const filesToClean = [...tempImagesRef.current];
        tempImagesRef.current = [];
        for (const tempFileName of filesToClean) {
          fetch("/api/reviews/temp-images", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tempFileName }),
          }).catch((error) => {
            console.error("Error cleaning up temp image:", error);
          });
        }
      }
    };
  }, [isOpen]);

  // Reset state when drawer opens/closes (matching FullScreenDeals pattern)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => {
        setRating(0);
        setHoverRating(0);
        setComment("");
        setUploadedImages([]);
        setIsSubmitting(false);
      }, 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to write a review.",
        variant: "destructive",
      });
      return;
    }

    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating for this place.",
        variant: "destructive",
      });
      return;
    }

    if (comment.trim().length < 10) {
      toast({
        title: "Review Too Short",
        description: "Please write at least 10 characters for your review.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          branch_id: branchId,
          rating,
          comment: comment.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || "Failed to create review");
      }

      const review = result.review;

      // Move images from temp to permanent if uploaded
      if (uploadedImages.length > 0) {
        try {
          const moveResponse = await fetch("/api/reviews/move-temp-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewId: review.id,
              userId: user.id,
              tempImages: uploadedImages.map((img) => ({
                tempFileName: img.tempFileName,
                imageUrl: img.image_url,
              })),
            }),
          });

          if (!moveResponse.ok) {
            console.error("Failed to move temp images");
          }
        } catch (imgError) {
          console.error("Error processing images:", imgError);
        }
      }

      tempImagesRef.current = [];

      toast({
        title: "Review Published!",
        description: "Thank you! Your review has been published.",
      });

      setRating(0);
      setComment("");
      setUploadedImages([]);

      onClose();
      onReviewCreated?.();
    } catch (error) {
      console.error("Error submitting review:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      toast({
        title: "Failed to Submit Review",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Only JPEG, PNG, and WebP images are allowed.",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Image must be smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    if (uploadedImages.length >= 5) {
      toast({
        title: "Too Many Images",
        description: "Maximum 5 images allowed per review.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/reviews/temp-images", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload image");
      }

      tempImagesRef.current.push(result.data.tempFileName);

      setUploadedImages((prev) => [
        ...prev,
        {
          id: Date.now(),
          image_url: result.data.image_url,
          tempFileName: result.data.tempFileName,
          uploading: false,
        },
      ]);

      toast({
        title: "Image Uploaded",
        description: "Image uploaded successfully.",
      });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload Failed",
        description:
          error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const removeImage = async (imageId: number) => {
    const image = uploadedImages.find((img) => img.id === imageId);
    if (image?.tempFileName) {
      try {
        await fetch("/api/reviews/temp-images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tempFileName: image.tempFileName }),
        });

        tempImagesRef.current = tempImagesRef.current.filter(
          (f) => f !== image.tempFileName,
        );
      } catch (error) {
        console.error("Error removing image:", error);
      }
    }

    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[10000] flex flex-col bg-background"
        >
          {/* Header - exact copy from FullScreenDeals */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {listingName}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    Write a Review
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 rounded-full min-w-0">
                    <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="text-xs font-medium text-primary truncate max-w-[140px] sm:max-w-xs">
                      {branchName}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                disabled={isSubmitting}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {isLoadingUser ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-safe"
              >
                {/* User Info */}
                {user && (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                    <Avatar className="h-12 w-12 border-2 border-primary/20">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {user.full_name || user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Posting as verified user
                      </p>
                    </div>
                  </div>
                )}

                {/* Rating */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Your Rating *
                  </Label>
                  <div className="flex items-center justify-center gap-2 p-6 bg-muted/30 rounded-xl border border-border/50">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="p-1 hover:scale-110 active:scale-95 transition-transform"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star)}
                        disabled={isSubmitting}
                      >
                        <Star
                          className={`h-10 w-10 sm:h-12 sm:w-12 transition-colors ${
                            star <= (hoverRating || rating)
                              ? "text-amber-400 fill-amber-400"
                              : "text-gray-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {rating > 0 && (
                    <p className="text-center text-sm font-medium text-primary">
                      {rating === 1 && "😞 Poor"}
                      {rating === 2 && "😐 Fair"}
                      {rating === 3 && "🙂 Good"}
                      {rating === 4 && "😊 Very Good"}
                      {rating === 5 && "🤩 Excellent"}
                    </p>
                  )}
                </div>

                {/* Comment */}
                <div className="space-y-3">
                  <Label htmlFor="comment" className="text-base font-semibold">
                    Your Review *
                  </Label>
                  <Textarea
                    id="comment"
                    placeholder="Tell others about your experience... What did you like? What could be improved?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={5}
                    className="resize-none text-base bg-muted/30 border-border/50"
                    disabled={isSubmitting}
                    required
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Minimum 10 characters</span>
                    <span
                      className={
                        comment.length > 500
                          ? "text-destructive font-medium"
                          : undefined
                      }
                    >
                      {comment.length}/500
                    </span>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">
                    Photos (Optional)
                  </Label>

                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={
                        isUploadingImage ||
                        isSubmitting ||
                        uploadedImages.length >= 5
                      }
                      className="hidden"
                      id="image-upload"
                    />
                    <Label
                      htmlFor="image-upload"
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                        isUploadingImage ||
                        isSubmitting ||
                        uploadedImages.length >= 5
                          ? "border-border/30 text-muted-foreground cursor-not-allowed bg-muted/30"
                          : "border-primary/50 text-primary hover:border-primary hover:bg-primary/5 active:scale-95"
                      }`}
                    >
                      {isUploadingImage ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                      {isUploadingImage ? "Uploading..." : "Add Photo"}
                    </Label>
                    <span className="text-sm text-muted-foreground">
                      {uploadedImages.length}/5
                    </span>
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {uploadedImages.map((image) => (
                        <div
                          key={image.id}
                          className="relative group aspect-square"
                        >
                          <div className="w-full h-full rounded-xl overflow-hidden border-2 border-border/50 bg-muted/30">
                            <Image
                              src={image.image_url}
                              alt="Review photo"
                              width={200}
                              height={200}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            disabled={isSubmitting}
                            className="absolute -top-2 -right-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg disabled:opacity-50"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Max 5 photos • 2MB each • JPEG, PNG, WebP
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting || rating === 0 || comment.trim().length < 10
                    }
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Review
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
