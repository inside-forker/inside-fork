"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

// Transform-based Slider Component
interface SliderContainerProps {
  images: string[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

function SliderContainer({
  images,
  currentIndex,
  onIndexChange,
}: SliderContainerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Cache dimensions to prevent forced reflows
  const cachedDimensions = useRef({ sliderWidth: 800, containerWidth: 800 });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
    setDragOffset(0);

    // Cache dimensions once at drag start
    const sliderContainer = containerRef.current?.parentElement;
    const sliderWidth = sliderContainer?.offsetWidth || 800;
    const containerWidth = containerRef.current?.offsetWidth || 800;
    cachedDimensions.current = { sliderWidth, containerWidth };
  };

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const diff = clientX - startX.current;

      // Simple 1:1 movement with light boundary resistance
      let constrainedDiff = diff;

      if (currentIndex === 0 && diff > 0) {
        constrainedDiff = diff * 0.3; // Resistance at start
      } else if (currentIndex === images.length - 1 && diff < 0) {
        constrainedDiff = diff * 0.3; // Resistance at end
      }

      setDragOffset(constrainedDiff);
    },
    [isDragging, currentIndex, images.length],
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    // Use cached dimensions instead of querying DOM
    const { sliderWidth } = cachedDimensions.current;
    const threshold = sliderWidth * 0.25; // 25% of slider width

    setIsDragging(false);

    // Simple logic: if dragged more than threshold, navigate
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0 && currentIndex > 0) {
        // Navigate to previous slide
        onIndexChange(currentIndex - 1);
      } else if (dragOffset < 0 && currentIndex < images.length - 1) {
        // Navigate to next slide
        onIndexChange(currentIndex + 1);
      }
    }

    // Always reset drag offset
    setDragOffset(0);
  }, [isDragging, dragOffset, currentIndex, images.length, onIndexChange]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e: TouchEvent) => handleDragMove(e);
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Simple transform calculation - use cached dimensions
  const baseTransform = -(currentIndex * (100 / images.length));
  const { containerWidth } = cachedDimensions.current;
  const dragTransform = isDragging ? (dragOffset / containerWidth) * 100 : 0;
  const totalTransform = baseTransform + dragTransform;

  return (
    <div
      ref={containerRef}
      className="flex h-full select-none"
      style={{
        width: `${images.length * 100}%`,
        transform: `translateX(${totalTransform}%)`,
        cursor: isDragging ? "grabbing" : "grab",
        willChange: "transform",
        // Smooth CSS transitions when not dragging
        transition: isDragging
          ? "none"
          : "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
      }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      {images.map((image, index) => (
        <div
          key={index}
          className="relative flex-shrink-0 h-full"
          style={{ width: `${100 / images.length}%` }}
        >
          <OptimizedImage
            src={image}
            alt={`Gallery image ${index + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            className="object-contain pointer-events-none"
            priority={index <= 2}
            quality={index === 0 ? 90 : 75}
            draggable={false}
            instant
          />
        </div>
      ))}
    </div>
  );
}

interface PremiumGalleryProps {
  images:
    | Array<{
        id: number;
        listing_id: number;
        url: string;
        alt_text: string | null;
        display_order: number | null;
        is_primary: boolean | null;
        created_at: string;
        updated_at: string;
      }>
    | string[];
  title?: string;
  /** Camera icon next to the heading (off on the event page). */
  showIcon?: boolean;
}

export function PremiumGallery({
  images = [],
  title: _title = "Gallery",
  showIcon = true,
}: PremiumGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [mainImageIndex, setMainImageIndex] = useState(0);

  // Convert image objects to URLs if needed, and find primary image index
  const getGalleryUrls = () => {
    if (images.length === 0) {
      // Return diverse placeholder images for better visual appeal
      return {
        urls: [
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop&crop=center",
          "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&crop=center",
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=600&fit=crop&crop=center",
          "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=600&fit=crop&crop=center",
        ],
        primaryIndex: 0,
      };
    }

    // Check if images are objects with url property or just strings
    const isObjectArray =
      images.length > 0 &&
      typeof images[0] === "object" &&
      images[0] !== null &&
      "url" in images[0];

    if (isObjectArray) {
      // Images are objects with metadata
      const imageObjects = images as Array<{
        url: string;
        is_primary?: boolean | null;
        display_order?: number | null;
      }>;

      // Find primary image index
      let primaryIndex = 0;
      const primaryImage = imageObjects.findIndex((img) => img.is_primary);
      if (primaryImage !== -1) {
        primaryIndex = primaryImage;
      } else {
        // Fallback to first image
        primaryIndex = 0;
      }

      const urls = imageObjects.map((img) => img.url);
      return { urls, primaryIndex };
    } else {
      // Images are strings
      const urls = images as string[];
      return { urls, primaryIndex: 0 };
    }
  };

  const { urls: galleryUrls, primaryIndex } = getGalleryUrls();

  // Set main image to primary image index
  useEffect(() => {
    setMainImageIndex(primaryIndex);
  }, [primaryIndex]);

  const openLightbox = (index: number) => {
    setSelectedImage(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImage(null);
  };

  const galleryLength = galleryUrls.length;

  const navigateImage = useCallback(
    (direction: "prev" | "next") => {
      if (selectedImage === null) return;

      const newIndex =
        direction === "prev"
          ? selectedImage === 0
            ? galleryLength - 1
            : selectedImage - 1
          : selectedImage === galleryLength - 1
            ? 0
            : selectedImage + 1;

      setSelectedImage(newIndex);
    },
    [selectedImage, galleryLength],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateImage("prev");
      if (e.key === "ArrowRight") navigateImage("next");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, selectedImage, navigateImage]);

  // Scroll lock when lightbox is open
  useEffect(() => {
    if (isLightboxOpen) {
      // Store original styles
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(
        document.body,
      ).paddingRight;

      // Get scrollbar width to prevent layout shift
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      // Apply scroll lock
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${
        parseInt(originalPaddingRight) + scrollBarWidth
      }px`;

      return () => {
        // Restore original styles
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isLightboxOpen]);

  if (galleryUrls.length === 0) return null;

  return (
    <>
      <motion.div
        className="space-y-6"
        initial="hidden"
        whileInView="visible"
        viewport={viewportSettings}
        variants={sectionVariants}
      >
        {/* Mobile-First Photo Section - Compact Swipeable Gallery */}
        <div className="md:hidden">
          {/* Mobile Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {showIcon && (
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Camera className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="font-bold text-base text-foreground leading-tight">
                  Photos
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Explore all photos
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openLightbox(0)}
              className="h-7 px-2.5 text-xs font-medium rounded-lg flex-shrink-0"
            >
              View all ({galleryUrls.length})
            </Button>
          </div>

          {/* Mobile Horizontal Snap-Scroll Photos */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory -mx-4 px-4">
            {galleryUrls.map((image, index) => (
              <div
                key={index}
                onClick={() => openLightbox(index)}
                className="relative flex-shrink-0 w-44 h-32 rounded-xl overflow-hidden bg-muted/30 border border-border/50 snap-start cursor-pointer group shadow-sm active:scale-95 transition-transform"
              >
                <OptimizedImage
                  src={image}
                  alt={`Gallery photo ${index + 1}`}
                  fill
                  sizes="180px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  instant
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                  {index + 1}/{galleryUrls.length}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Header & Grid */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {showIcon && (
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <PremiumHeading level={2} dense className="text-foreground">
                  {_title} <span className="text-primary"></span>
                </PremiumHeading>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                  Explore all {_title.toLowerCase()}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="px-4 py-2 font-semibold border-2 bg-primary/5"
            >
              {galleryUrls.length}{" "}
              {galleryUrls.length === 1 ? "photo" : "photos"}
            </Badge>
          </div>

          {/* Desktop Main Gallery Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[500px]">
            {/* Main Image */}
            <motion.div
              className="lg:col-span-2 lg:row-span-2 relative group cursor-pointer overflow-hidden rounded-2xl bg-muted/30 dark:bg-zinc-800/30"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              onClick={() => openLightbox(mainImageIndex)}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={mainImageIndex}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className="relative w-full h-full"
                >
                  <OptimizedImage
                    src={galleryUrls[mainImageIndex]}
                    alt="Main gallery image"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 60vw"
                    className="object-cover transition-transform duration-500"
                    priority
                    instant
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View Full Size
              </div>
            </motion.div>

            {/* Thumbnail Grid */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              {galleryUrls.slice(0, 4).map((image, index) => (
                <motion.div
                  key={index}
                  className={`relative group cursor-pointer overflow-hidden rounded-xl aspect-square border-2 transition-all duration-300 bg-muted/30 dark:bg-zinc-800/30 ${
                    mainImageIndex === index
                      ? "border-primary shadow-lg shadow-primary/20"
                      : "border-transparent hover:border-primary/50"
                  }`}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => setMainImageIndex(index)}
                >
                  <OptimizedImage
                    src={image}
                    alt={`Gallery image ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                    className="object-cover transition-transform duration-500"
                    instant
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

                  {/* Active indicator */}
                  {mainImageIndex === index && (
                    <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded-xl" />
                  )}

                  {/* Show more overlay for last image */}
                  {index === 3 && galleryUrls.length > 4 && (
                    <div
                      className="absolute inset-0 bg-black/70 flex items-center justify-center cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox(0);
                      }}
                    >
                      <span className="text-white font-semibold text-lg">
                        +{galleryUrls.length - 4} more
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Desktop View All Button */}
          {galleryUrls.length > 4 && (
            <div className="text-center mt-6">
              <Button
                variant="outline"
                onClick={() => openLightbox(0)}
                className="px-8 py-3 rounded-full font-medium"
              >
                View All {galleryUrls.length} Photos
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && selectedImage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 !mt-0"
            onClick={closeLightbox}
            onTouchMove={(e) => e.preventDefault()} // Prevent scroll on touch devices
            style={{ touchAction: "none" }} // Additional touch prevention
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-60 text-white hover:bg-white/10 rounded-full p-2"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>

            {/* Navigation Arrows */}
            {galleryUrls.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage("prev");
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-60 text-white hover:bg-white/10 rounded-full p-3"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage("next");
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-60 text-white hover:bg-white/10 rounded-full p-3"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </>
            )}

            {/* Image Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {selectedImage + 1} of {galleryUrls.length}
            </div>

            {/* Navigation Hint */}
            {galleryUrls.length > 1 && (
              <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs opacity-70 z-20">
                Click & drag or use ← → keys
              </div>
            )}

            {/* Transform-based Slider Container */}
            <div
              className="relative max-w-7xl max-h-[90vh] w-full h-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <SliderContainer
                images={galleryUrls}
                currentIndex={selectedImage}
                onIndexChange={setSelectedImage}
              />
            </div>

            {/* Thumbnail Navigation */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-black/50 rounded-full p-2 max-w-md overflow-x-auto">
              {galleryUrls.map((image, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(index);
                  }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden flex-none transition-all duration-200 ${
                    index === selectedImage
                      ? "ring-2 ring-white scale-110"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <OptimizedImage
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    sizes="48px"
                    className="object-cover"
                    instant
                  />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
