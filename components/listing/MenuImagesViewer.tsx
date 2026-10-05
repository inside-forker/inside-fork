"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChefHat } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";

interface MenuImage {
  id: number;
  url: string;
  alt_text: string;
  display_order: number;
}

interface MenuImagesViewerProps {
  listingId: number;
  restaurantName: string;
  initialImages?: MenuImage[]; // Server-rendered images to prevent hydration mismatch
}

// Draggable Thumbnail Strip Component
interface DraggableThumbnailStripProps {
  images: MenuImage[];
  selectedImage: number;
  onSelect: (index: number) => void;
}

function DraggableThumbnailStrip({
  images,
  selectedImage,
  onSelect,
}: DraggableThumbnailStripProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [hasDragged, setHasDragged] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setHasDragged(false);
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;

    // Mark as dragged if moved more than 5px
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }

    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;

    // Mark as dragged if moved more than 5px
    if (Math.abs(walk) > 5) {
      setHasDragged(true);
    }

    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Auto-scroll to selected thumbnail
  React.useEffect(() => {
    if (scrollRef.current) {
      const thumbnail = scrollRef.current.children[
        selectedImage
      ] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [selectedImage]);

  return (
    <div
      ref={scrollRef}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 md:bottom-6 z-10 flex gap-2 md:gap-3 bg-black/50 backdrop-blur-sm rounded-full p-2 md:p-3 max-w-[calc(100vw-2rem)] md:max-w-4xl overflow-x-auto cursor-grab active:cursor-grabbing border border-white/10 shadow-2xl"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        handleMouseDown(e);
      }}
      onMouseMove={(e) => {
        e.stopPropagation();
        handleMouseMove(e);
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        handleEnd();
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        handleEnd();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        handleTouchStart(e);
      }}
      onTouchMove={(e) => {
        e.stopPropagation();
        handleTouchMove(e);
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        handleEnd();
      }}
    >
      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {images.map((image, index) => (
        <button
          key={image.id}
          onClick={(e) => {
            e.stopPropagation();
            // Only select if not dragging
            if (!hasDragged) {
              onSelect(index);
            }
          }}
          className={`relative w-12 h-12 md:w-14 md:h-14 rounded-lg md:rounded-xl overflow-hidden flex-none transition-all duration-200 ${
            index === selectedImage
              ? "ring-2 ring-white scale-110 shadow-lg"
              : "opacity-60 hover:opacity-100 scale-95"
          }`}
        >
          <OptimizedImage
            src={image.url}
            alt={`Page ${index + 1}`}
            fill
            sizes="48px"
            className="object-cover pointer-events-none"
            instant
            quality={90}
          />
        </button>
      ))}
    </div>
  );
}

// Transform-based Slider Component (same as PremiumGallery)
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
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const startX = React.useRef(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cachedDimensions = React.useRef({
    sliderWidth: 800,
    containerWidth: 800,
  });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
    setDragOffset(0);

    const sliderContainer = containerRef.current?.parentElement;
    const sliderWidth = sliderContainer?.offsetWidth || 800;
    const containerWidth = containerRef.current?.offsetWidth || 800;
    cachedDimensions.current = { sliderWidth, containerWidth };
  };

  const handleDragMove = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const diff = clientX - startX.current;

      let constrainedDiff = diff;

      if (currentIndex === 0 && diff > 0) {
        constrainedDiff = diff * 0.3;
      } else if (currentIndex === images.length - 1 && diff < 0) {
        constrainedDiff = diff * 0.3;
      }

      setDragOffset(constrainedDiff);
    },
    [isDragging, currentIndex, images.length],
  );

  const handleDragEnd = React.useCallback(() => {
    if (!isDragging) return;

    const { sliderWidth } = cachedDimensions.current;
    const threshold = sliderWidth * 0.25;

    setIsDragging(false);

    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0 && currentIndex > 0) {
        onIndexChange(currentIndex - 1);
      } else if (dragOffset < 0 && currentIndex < images.length - 1) {
        onIndexChange(currentIndex + 1);
      }
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, currentIndex, images.length, onIndexChange]);

  React.useEffect(() => {
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
            alt={`Menu page ${index + 1}`}
            fill
            sizes="95vw"
            className="object-contain pointer-events-none"
            style={{
              transform: `scale(${index === currentIndex ? 1 : 0.95})`,
              filter: "contrast(1.05) saturate(1.1)",
            }}
            priority={index === 0}
            quality={90}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

export function MenuImagesViewer({
  listingId,
  restaurantName: _restaurantName,
  initialImages,
}: MenuImagesViewerProps) {
  const [images, setImages] = React.useState<MenuImage[]>(initialImages || []);
  const [isLoading, setIsLoading] = React.useState(!initialImages);
  const [isLightboxOpen, setIsLightboxOpen] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  React.useEffect(() => {
    // Skip fetch if server provided images
    if (initialImages && initialImages.length > 0) {
      return;
    }

    const fetchMenuImages = async () => {
      try {
        const response = await fetch(`/api/listings/${listingId}/menu-images`);
        const data = await response.json();

        if (data.success) {
          setImages(data.data || []);
        }
      } catch (error) {
        console.error("[MENU IMAGES] Fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenuImages();
  }, [listingId, initialImages]);

  const openLightbox = (index: number) => {
    setSelectedImage(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImage(null);
  };

  const navigateImage = React.useCallback(
    (direction: "prev" | "next") => {
      if (selectedImage === null) return;

      const newIndex =
        direction === "prev"
          ? selectedImage === 0
            ? images.length - 1
            : selectedImage - 1
          : selectedImage === images.length - 1
            ? 0
            : selectedImage + 1;

      setSelectedImage(newIndex);
    },
    [selectedImage, images.length],
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateImage("prev");
      if (e.key === "ArrowRight") navigateImage("next");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, navigateImage]);

  // Scroll lock when lightbox is open
  React.useEffect(() => {
    if (isLightboxOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalPaddingRight = window.getComputedStyle(
        document.body,
      ).paddingRight;

      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${
        parseInt(originalPaddingRight) + scrollBarWidth
      }px`;

      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isLightboxOpen]);

  if (isLoading) {
    return null;
  }

  if (images.length === 0) {
    return null;
  }

  const imageUrls = images.map((img) => img.url);
  const previewCount = 5; // Show 5 images + "View Full Menu" card = 6 total (2 complete rows)
  const previewImages = images.slice(0, previewCount);
  const hasMore = images.length > previewCount;

  return (
    <>
      <div className="space-y-6">
        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <PremiumHeading level={2} dense className="text-foreground">
                  Digital <span className="gradient-text-primary">Menu</span>
                </PremiumHeading>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                  Browse our full menu
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="px-3 py-1 text-xs font-medium bg-primary/5"
            >
              {images.length} {images.length === 1 ? "page" : "pages"}
            </Badge>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <ChefHat className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Digital <span className="gradient-text-primary">Menu</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                Browse our full menu
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-4 py-2 font-semibold border-2 bg-primary/5"
          >
            {images.length} {images.length === 1 ? "page" : "pages"}
          </Badge>
        </div>

        {/* Menu Images Grid - Preview + View All */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {previewImages.map((image, index) => (
            <motion.div
              key={image.id}
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted/50 border border-border/50 hover:border-primary/50 transition-all duration-300 cursor-pointer"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              onClick={() => openLightbox(index)}
            >
              <OptimizedImage
                src={image.url}
                alt={image.alt_text}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                quality={90}
                style={{ filter: "contrast(1.05) saturate(1.1)" }}
              />

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex items-center justify-center">
                <div className="text-center space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="text-white font-semibold">View Full Size</div>
                </div>
              </div>

              {/* Page Number Badge */}
              <Badge className="absolute top-4 right-4 bg-black/80 text-white hover:bg-black/90">
                Page {index + 1}
              </Badge>
            </motion.div>
          ))}

          {/* View Full Menu Card */}
          {hasMore && (
            <motion.div
              className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-2 border-primary/30 hover:border-primary transition-all duration-300 cursor-pointer flex items-center justify-center"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              onClick={() => openLightbox(0)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
              <div className="relative text-center space-y-4 p-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/40">
                  <ChefHat className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    View Full Menu
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {images.length} pages available
                  </p>
                </div>
                <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/40">
                  Click to Browse
                </Badge>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && selectedImage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 !mt-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.97) 100%)",
              backdropFilter: "blur(8px)",
              touchAction: "none",
            }}
            onClick={closeLightbox}
            onTouchMove={(e) => e.preventDefault()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                closeLightbox();
              }}
              className="absolute top-4 right-4 md:top-6 md:right-6 z-60 text-white/90 hover:text-white hover:bg-white/15 rounded-full p-2 md:p-3 backdrop-blur-md bg-black/30 border border-white/10 shadow-xl transition-all duration-200 hover:scale-110"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>

            {/* Zoom Controls - Desktop Only */}
            <div className="hidden md:flex absolute top-6 left-6 z-20 flex-col gap-2 bg-black/40 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-2xl">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomLevel((z) => Math.min(3, z + 0.25));
                }}
                disabled={zoomLevel >= 3}
                className="text-white/90 hover:text-white hover:bg-white/20 rounded-xl p-2.5 disabled:opacity-30 transition-all duration-200"
                title="Zoom In"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomLevel((z) => Math.max(1, z - 0.25));
                }}
                disabled={zoomLevel <= 1}
                className="text-white/90 hover:text-white hover:bg-white/20 rounded-xl p-2.5 disabled:opacity-30 transition-all duration-200"
                title="Zoom Out"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                  />
                </svg>
              </Button>
              {zoomLevel > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomLevel(1);
                  }}
                  className="text-white/90 hover:text-white hover:bg-white/20 rounded-xl px-2 py-1.5 text-xs font-semibold transition-all duration-200"
                  title="Reset Zoom"
                >
                  {Math.round(zoomLevel * 100)}%
                </Button>
              )}
            </div>

            {/* Navigation Arrows - Desktop Only */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage("prev");
                  }}
                  className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 z-60 text-white/90 hover:text-white hover:bg-white/15 rounded-full p-4 backdrop-blur-md bg-black/30 border border-white/10 shadow-2xl transition-all duration-200 hover:scale-110"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
                  className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-60 text-white/90 hover:text-white hover:bg-white/15 rounded-full p-4 backdrop-blur-md bg-black/30 border border-white/10 shadow-2xl transition-all duration-200 hover:scale-110"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </>
            )}

            {/* Image Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 md:top-6 bg-black/40 backdrop-blur-md text-white px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm font-semibold z-20 border border-white/10 shadow-2xl">
              {selectedImage + 1} of {images.length}
            </div>

            {/* Slider Container with Zoom - Mobile uses native pinch-to-zoom */}
            <div
              className="relative max-w-7xl max-h-[90vh] w-full h-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `scale(${zoomLevel})`,
                transition: zoomLevel !== 1 ? "transform 0.3s ease" : "none",
                transformOrigin: "center center",
              }}
            >
              <SliderContainer
                images={imageUrls}
                currentIndex={selectedImage}
                onIndexChange={setSelectedImage}
              />
            </div>

            {/* Draggable Thumbnail Navigation */}
            <DraggableThumbnailStrip
              images={images}
              selectedImage={selectedImage}
              onSelect={setSelectedImage}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
