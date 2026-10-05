"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Database } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, BadgeCheck } from "lucide-react";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { ShareButton } from "@/components/shared/ShareButton";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface PremiumListingHeroProps {
  listing: Listing;
  images?: string[];
  withTopMargin?: boolean;
}

export function PremiumListingHero({
  listing,
  images = [],
  withTopMargin = true,
}: PremiumListingHeroProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-rotate images
  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [images.length]);

  // Better image fallback logic with type-specific placeholders
  const getHeroImage = () => {
    if (images.length > 0) {
      return images[currentImageIndex];
    }

    // Fallback based on listing type/category
    const category = listing.category_name?.toLowerCase() || "";
    if (category.includes("restaurant") || category.includes("food")) {
      return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop&crop=center";
    } else if (
      category.includes("hotel") ||
      category.includes("accommodation")
    ) {
      return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=600&fit=crop&crop=center";
    } else if (category.includes("cafe") || category.includes("coffee")) {
      return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&h=600&fit=crop&crop=center";
    } else if (category.includes("shop") || category.includes("store")) {
      return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop&crop=center";
    } else {
      return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop&crop=center";
    }
  };

  // Fix: Calculate heroImage dynamically based on currentImageIndex
  const heroImage = getHeroImage();

  return (
    <div
      className={`relative min-h-[580px] sm:min-h-[620px] md:h-[75vh] lg:h-[80vh] overflow-hidden flex flex-col justify-between ${
        withTopMargin ? "mt-16 md:mt-20" : ""
      }`}
    >
      {/* Background Image with Smooth Fade */}
      <motion.div
        key={currentImageIndex}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <OptimizedImage
          src={heroImage}
          alt={listing.name || "Listing"}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />

        {/* Ambient Dark Tint & Deep High-Contrast Gradients */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 via-55% to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-none" />
      </motion.div>

      {/* Floating Top Bar (Category & Featured Badges) with Guaranteed Navbar Clearance */}
      <div
        className={`relative z-20 w-full container mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between pointer-events-none ${
          withTopMargin ? "pt-4 sm:pt-6" : "pt-20 sm:pt-24"
        }`}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          {listing.category_name && (
            <Badge
              variant="secondary"
              className="backdrop-blur-xl bg-black/70 text-white border border-white/20 px-3 py-1.5 text-xs font-semibold shadow-lg"
            >
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {listing.category_name}
              </span>
            </Badge>
          )}

          {listing.is_featured && (
            <Badge
              variant="outline"
              className="backdrop-blur-xl bg-amber-500/30 text-amber-200 border border-amber-400/50 px-2.5 py-1.5 text-xs font-semibold shadow-lg"
            >
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Featured
              </span>
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content - Anchored at Bottom with Generous Spacing */}
      <div className="relative z-10 w-full pt-8 pb-6 sm:pb-10">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-3xl text-left space-y-3.5 sm:space-y-4"
          >
            {/* Title & Verified Badge */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {listing.name}
              </h1>

              {listing.is_member && (
                <Badge
                  variant="outline"
                  className="backdrop-blur-md bg-blue-500/25 text-blue-200 border border-blue-400/50 px-2.5 py-1 text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Verified</span>
                </Badge>
              )}
            </div>

            {/* Inline Meta: Rating & Location */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs sm:text-sm">
              {(listing.review_count ?? 0) > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 font-bold text-white shadow-md">
                  <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{(listing.avg_rating ?? 0).toFixed(1)}</span>
                  <span className="text-white/70 font-normal">({listing.review_count})</span>
                </div>
              )}

              {listing.address && (
                <div className="inline-flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 text-white shadow-md max-w-full truncate">
                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="truncate text-xs sm:text-sm font-medium">{listing.address}</span>
                </div>
              )}
            </div>

            {/* Description - Bright Crisp White with Enhanced Legibility & Breathing Room */}
            {listing.description && (
              <p className="text-sm sm:text-base text-white/95 leading-relaxed line-clamp-3 font-normal drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] max-w-2xl pt-1">
                {listing.description}
              </p>
            )}

            {/* Action Buttons - Distinct, Unified, Touch-friendly */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 pt-2 sm:pt-3 pr-24 sm:pr-0 flex-wrap">
              {listing.phone_number && (
                <Button
                  size="sm"
                  onClick={() => window.open(`tel:${listing.phone_number}`)}
                  className="h-11 px-4 sm:px-6 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 flex-1 sm:flex-none"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const query = encodeURIComponent(
                    listing.address || listing.name || "",
                  );
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${query}`,
                    "_blank",
                  );
                }}
                className="h-11 px-4 sm:px-6 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-md font-semibold rounded-xl shadow-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-transform active:scale-95 flex-1 sm:flex-none"
              >
                <MapPin className="h-4 w-4" />
                <span>Directions</span>
              </Button>

              <ShareButton
                contentType="listing"
                contentId={listing.id!}
                contentTitle={listing.name || "Listing"}
                contentUrl={`/listing/${listing.slug}`}
                variant="default"
                className="h-11 px-3.5 sm:px-5 bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-md font-semibold rounded-xl shadow-lg text-xs sm:text-sm flex items-center justify-center transition-transform active:scale-95 flex-1 sm:flex-none"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Floating Photo Indicator in Bottom Right */}
      {images.length > 1 && (
        <div className="absolute bottom-6 right-4 sm:bottom-8 sm:right-6 lg:right-8 z-20 pointer-events-auto">
          <div className="flex items-center gap-2 bg-black/75 backdrop-blur-xl rounded-full px-3.5 py-1.5 border border-white/25 shadow-xl">
            <div className="flex items-center gap-1.5">
              {images.slice(0, 5).map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  aria-label={`Go to image ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentImageIndex
                      ? "w-4 bg-primary"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
            <span className="text-white text-xs font-bold tracking-wide ml-0.5">
              {currentImageIndex + 1}/{images.length}
            </span>
          </div>
        </div>
      )}

      {/* Gradient Orbs */}
      <div className="absolute top-1/3 left-1/4 hidden xl:block">
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 2, delay: 1.6 }}
          className="w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-xl"
        />
      </div>

      <div className="absolute bottom-1/4 right-1/3 hidden xl:block">
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.1, scale: 1 }}
          transition={{ duration: 2, delay: 1.8 }}
          className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full blur-xl"
        />
      </div>
    </div>
  );
}
