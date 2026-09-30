"use client";

import { Database } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, MapPin } from "lucide-react";
import { ShareButton } from "@/components/shared/ShareButton";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface PremiumListingHeroClientProps {
  listing: Listing;
  images: string[];
  fallbackImage: string;
}

// Smart description truncation - takes first meaningful sentences
function truncateDescription(
  text: string | null,
  maxLength: number = 180,
): string {
  if (!text) return "";

  // Clean up the text
  const cleaned = text.trim().replace(/\s+/g, " ");

  if (cleaned.length <= maxLength) return cleaned;

  // Try to truncate at sentence boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastQuestion = truncated.lastIndexOf("?");
  const lastExclaim = truncated.lastIndexOf("!");

  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclaim);

  // If we found a sentence boundary after 80 chars, use it
  if (lastSentenceEnd > 80) {
    return cleaned.substring(0, lastSentenceEnd + 1);
  }

  // Otherwise truncate at word boundary with ellipsis
  const lastSpace = truncated.lastIndexOf(" ");
  return cleaned.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "...";
}

// Smart address truncation - keeps key parts
function truncateAddress(
  address: string | null,
  maxLength: number = 50,
): string {
  if (!address) return "";

  const cleaned = address.trim();
  if (cleaned.length <= maxLength) return cleaned;

  // Try to keep the most relevant part (usually area/locality)
  const parts = cleaned.split(",").map((p) => p.trim());

  // If address has multiple parts, try to fit the first 2-3
  let result = parts[0];
  for (let i = 1; i < parts.length && i < 3; i++) {
    const next = result + ", " + parts[i];
    if (next.length <= maxLength) {
      result = next;
    } else {
      break;
    }
  }

  return result.length < cleaned.length ? result + "..." : result;
}

export function PremiumListingHeroClient({
  listing,
  images,
  fallbackImage,
}: PremiumListingHeroClientProps) {
  const heroImage = images[0] || fallbackImage;

  return (
    <>
      {/* Background Image */}
      <div className="absolute inset-0 scale-105">
        <OptimizedImage
          src={heroImage}
          alt={listing.name || "Listing"}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          loading="eager"
        />
      </div>

      {/* Gradient Overlays - Must be AFTER background image for proper stacking */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Base darkening layer - stronger at bottom for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Primary color accent gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 opacity-60" />

        {/* Vignette effect for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.2)_100%)]" />
      </div>

      {/* Content - Mobile Centered, Desktop Bottom */}
      <div className="absolute inset-0 flex items-center md:items-end z-20">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 pb-8 md:pb-16 lg:pb-20">
          <div className="max-w-4xl text-center md:text-left opacity-0 translate-y-8 animate-[fadeInUp_0.5s_ease-out_0.1s_forwards]">
            {/* Category Badges - CSS animations instead of Framer */}
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4 md:mb-6 opacity-0 animate-[fadeInLeft_0.3s_ease-out_0.15s_forwards]">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-primary/20 rounded-full blur-md" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur-sm" />
                <Badge
                  variant="secondary"
                  className="relative backdrop-blur-xl text-white border px-3 md:px-6 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)/0.25) 0%, hsl(var(--primary)/0.15) 100%)",
                    borderColor: "hsl(var(--primary)/0.4)",
                    boxShadow:
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px hsl(var(--primary)/0.1)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    {/* Category icon - white with ring for visibility */}
                    <div className="relative flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-sm" />
                      <div className="absolute inset-0 w-2.5 h-2.5 rounded-full ring-2 ring-white/30" />
                    </div>
                    {listing.category_name}
                  </span>
                </Badge>
              </div>

              {listing.is_featured && (
                <div className="relative">
                  {/* Glow effect for featured */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/40 to-orange-400/30 rounded-full blur-md" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/15 rounded-full blur-sm" />
                  <Badge
                    variant="outline"
                    className="relative backdrop-blur-xl text-amber-100 border px-3 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(249, 115, 22, 0.25) 100%)",
                      borderColor: "rgba(251, 191, 36, 0.5)",
                      boxShadow:
                        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 20px rgba(245, 158, 11, 0.15)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Featured
                    </span>
                  </Badge>
                </div>
              )}

              {listing.is_member && (
                <div className="relative">
                  {/* Glow effect for verified */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/40 to-indigo-400/30 rounded-full blur-md" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-indigo-400/15 rounded-full blur-sm" />
                  <Badge
                    variant="outline"
                    className="relative backdrop-blur-xl text-blue-100 border px-3 md:px-5 py-2 md:py-2.5 text-xs md:text-sm font-bold tracking-wide shadow-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(99, 102, 241, 0.25) 100%)",
                      borderColor: "rgba(96, 165, 250, 0.5)",
                      boxShadow:
                        "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 20px rgba(59, 130, 246, 0.15)",
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Verified
                    </span>
                  </Badge>
                </div>
              )}
            </div>

            {/* Title with gradient - optimized for mobile */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 md:mb-5 leading-tight tracking-tight opacity-0 translate-y-5 animate-[fadeInUp_0.4s_ease-out_0.2s_forwards]">
              <span
                className="gradient-text-primary drop-shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)) 50%, hsl(var(--primary)/0.8) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  backgroundSize: "200% 200%",
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                }}
              >
                {listing.name}
              </span>
            </h1>

            {/* Description - Smart truncation for cleaner UX */}
            {listing.description && (
              <div className="mb-6 md:mb-8 max-w-2xl opacity-0 translate-y-4 animate-[fadeInUp_0.35s_ease-out_0.25s_forwards]">
                <div className="relative">
                  {/* Glassmorphism container for description */}
                  <div className="bg-white/5 dark:bg-white/5 backdrop-blur-md rounded-2xl px-5 py-4 border border-white/10">
                    <p className="text-sm md:text-base text-white/90 leading-relaxed font-medium tracking-wide">
                      {truncateDescription(listing.description, 200)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rating and Location - Mobile */}
            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start justify-center md:justify-start mb-6 md:mb-8 opacity-0 translate-y-4 animate-[fadeInUp_0.35s_ease-out_0.3s_forwards]">
              {(listing.review_count ?? 0) > 0 && (
                <div className="bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl px-6 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.floor(listing.avg_rating!)
                              ? "text-amber-300 drop-shadow-lg"
                              : "text-white/30"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-xl drop-shadow-sm">
                        {(listing.avg_rating ?? 0).toFixed(1)}
                      </span>
                      <div className="w-px h-5 bg-white/40" />
                      <span className="text-white/90 text-sm font-semibold">
                        {listing.review_count} reviews
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {listing.address && (
                <div
                  className="group relative bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl px-4 md:px-5 py-3 cursor-default hover:bg-white/15 dark:hover:bg-white/10 transition-all duration-300"
                  title={listing.address}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-blue-300" />
                    </div>
                    <span className="text-white/95 font-medium drop-shadow-sm text-sm md:text-base">
                      {truncateAddress(listing.address, 45)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Mobile Side-by-Side, Desktop Original */}
            <div className="flex flex-row md:flex-row gap-2 md:gap-4 justify-center md:justify-start opacity-0 translate-y-4 animate-[fadeInUp_0.35s_ease-out_0.35s_forwards]">
              {listing.phone_number && (
                <div className="flex-1 md:flex-none">
                  <Button
                    size="lg"
                    onClick={() => window.open(`tel:${listing.phone_number}`)}
                    className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group text-sm md:text-base hover:scale-105 active:scale-95"
                  >
                    <Phone className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
                    <span className="hidden xs:inline md:inline">Call Now</span>
                    <span className="xs:hidden md:hidden">Call</span>
                  </Button>
                </div>
              )}

              <div className="flex-1 md:flex-none">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const query = encodeURIComponent(
                      listing.address || listing.name || "",
                    );
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${query}`,
                      "_blank",
                    );
                  }}
                  className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-white/90 dark:bg-white/10 border-white/50 dark:border-white/30 text-gray-900 dark:text-white hover:bg-white hover:text-gray-900 dark:hover:bg-white/30 dark:hover:text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-sm shadow-lg text-sm md:text-base hover:scale-105 active:scale-95"
                >
                  <MapPin className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
                  <span className="hidden sm:inline md:inline">
                    Get Directions
                  </span>
                  <span className="sm:hidden md:hidden">Maps</span>
                </Button>
              </div>

              <div className="flex-1 md:flex-none">
                <ShareButton
                  contentType="listing"
                  contentId={listing.id!}
                  contentTitle={listing.name || "Listing"}
                  contentUrl={`/listing/${listing.slug}`}
                  variant="default"
                  className="w-full md:w-auto px-3 md:px-8 py-3 md:py-4 bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 text-white dark:text-white hover:bg-primary/20 hover:text-white dark:hover:bg-primary/20 dark:hover:text-white font-semibold rounded-2xl transition-all duration-300 backdrop-blur-md shadow-lg text-sm md:text-base from-primary/10 to-primary/10 hover:scale-105 active:scale-95"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
