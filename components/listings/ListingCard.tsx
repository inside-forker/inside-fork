"use client";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import { DistanceBadge } from "@/components/listings/DistanceBadge";
import { toggleFavorite } from "@/lib/favorites";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Database } from "@/types/database";
import { getListingImageUrl } from "@/lib/utils/listing-images";
import Link from "next/link";
import {
  Star,
  MapPin,
  Heart,
  Clock,
  Crown,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
  images?: Array<{
    id: number;
    listing_id: number;
    url: string;
    alt_text: string | null;
    display_order: number | null;
    is_primary: boolean | null;
    created_at: string;
    updated_at: string;
  }>;
  favorited?: boolean;
  distance_meters?: number;
};

interface ListingCardProps {
  listing: Listing;
  index?: number;
  showAnimation?: boolean;
  onUnfavorite?: () => void;
  /** Priority loading for above-the-fold images (first 3-4 cards) */
  priority?: boolean;
}

// Category color schemes
const categoryColorSchemes: Record<
  string,
  {
    bg: string;
    border: string;
    glow: string;
    accent: string;
    icon: string;
  }
> = {
  "Eat & Drink": {
    bg: "bg-orange-100 dark:bg-orange-500/10",
    border: "border-orange-200 dark:border-orange-500/20",
    glow: "hover:shadow-lg hover:shadow-orange-500/10",
    accent: "bg-orange-500",
    icon: "text-orange-600 dark:text-orange-400",
  },
  "Where to Stay": {
    bg: "bg-blue-100 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/20",
    glow: "hover:shadow-lg hover:shadow-blue-500/10",
    accent: "bg-blue-500",
    icon: "text-blue-600 dark:text-blue-400",
  },
  "Things to Do": {
    bg: "bg-amber-100 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
    glow: "hover:shadow-lg hover:shadow-amber-500/10",
    accent: "bg-amber-500",
    icon: "text-amber-600 dark:text-amber-400",
  },
  Shopping: {
    bg: "bg-emerald-100 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
    glow: "hover:shadow-lg hover:shadow-emerald-500/10",
    accent: "bg-emerald-500",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  Entertainment: {
    bg: "bg-purple-100 dark:bg-purple-500/10",
    border: "border-purple-200 dark:border-purple-500/20",
    glow: "hover:shadow-lg hover:shadow-purple-500/10",
    accent: "bg-purple-500",
    icon: "text-purple-600 dark:text-purple-400",
  },
  "Guides & Reviews": {
    bg: "bg-indigo-100 dark:bg-indigo-500/10",
    border: "border-indigo-200 dark:border-indigo-500/20",
    glow: "hover:shadow-lg hover:shadow-indigo-500/10",
    accent: "bg-indigo-500",
    icon: "text-indigo-600 dark:text-indigo-400",
  },
  Events: {
    bg: "bg-violet-100 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/20",
    glow: "hover:shadow-lg hover:shadow-violet-500/10",
    accent: "bg-violet-500",
    icon: "text-violet-600 dark:text-violet-400",
  },
};

export function ListingCard({
  listing,
  index = 0,
  showAnimation = true,
  onUnfavorite,
  priority = false,
}: ListingCardProps) {
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState(false);

  const isFavorited = favorites.some(
    (fav) => String(fav.id) === String(listing.id),
  );

  const imageUrl = getListingImageUrl(listing);
  const categoryColors = categoryColorSchemes[listing.category_name || ""] || {
    bg: "bg-gray-100 dark:bg-gray-500/10",
    border: "border-gray-200 dark:border-gray-500/20",
    glow: "hover:shadow-lg hover:shadow-gray-500/10",
    accent: "bg-gray-500",
    icon: "text-gray-600 dark:text-gray-400",
  };

  const getStatus = () => {
    return "Open"; // Static status to avoid hydration issues
  };

  const status = getStatus();

  const { toast } = useToast();

  return (
    <div
      className={cn("group h-full", showAnimation && "animate-fade-in")}
      style={{
        animationDelay: showAnimation ? `${index * 0.06}s` : "0s",
      }}
    >
      <div className="block group h-full">
        <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md sm:shadow-lg sm:hover:shadow-xl transition-all duration-300 transform-gpu group-hover:scale-[1.02] group-hover:-translate-y-1 flex flex-col h-full">
          {/* Glow */}
          <div
            className={cn(
              "absolute inset-0 rounded-xl sm:rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
              categoryColors.glow,
            )}
          />

          {/* Image Container */}
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-xl sm:rounded-t-2xl bg-muted/50 dark:bg-zinc-800/50 flex-shrink-0">
            {/* Status Badge */}
            <div
              className={cn(
                "absolute left-2 top-2 sm:left-3 sm:top-3 z-20 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium shadow-sm",
                status === "Open"
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white",
              )}
            >
              <div className="flex items-center space-x-1">
                <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                <span>{status === "Open" ? "Open" : "Closed"}</span>
              </div>
            </div>

            {/* Featured Badge */}
            {listing.is_featured && (
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-20">
                <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-yellow-500 text-yellow-900 text-[10px] sm:text-xs font-bold shadow-sm">
                  <div className="flex items-center space-x-1">
                    <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span>Featured</span>
                  </div>
                </div>
              </div>
            )}

            {/* Distance Badge */}
            {listing.distance_meters !== undefined &&
              listing.distance_meters !== null && (
                <div
                  className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-20"
                  style={{ marginBottom: listing.is_featured ? "2rem" : "0" }}
                >
                  <DistanceBadge
                    distanceMeters={listing.distance_meters}
                    compact
                  />
                </div>
              )}

            {/* Member Badge */}
            {listing.is_member && (
              <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-20">
                <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-primary text-primary-foreground text-[10px] sm:text-xs font-bold shadow-sm">
                  <div className="flex items-center space-x-1">
                    <Heart className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current" />
                    <span>Member</span>
                  </div>
                </div>
              </div>
            )}

            {/* Image */}
            <OptimizedImage
              src={imageUrl}
              alt={`Image of ${listing.name || "Listing"}`}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 350px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              fallbackSrc="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=center&auto=format&q=80"
            />

            {/* overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {/* Favorite button */}
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg shadow-sm hover:scale-110 transition-transform duration-200"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isFavLoading) return;
                setIsFavLoading(true);
                try {
                  const res = await toggleFavorite(listing.id as number);
                  if (typeof res?.favorited !== "undefined") {
                    if (res.favorited) {
                      addFavorite({
                        ...listing,
                        favorited_at: new Date().toISOString(),
                      });
                    } else {
                      removeFavorite(String(listing.id));
                      if (typeof onUnfavorite === "function") {
                        onUnfavorite();
                      }
                    }
                  }
                } catch (err) {
                  console.error("Favorite toggle failed", err);
                  if (
                    err instanceof Error &&
                    (err as { status?: number }).status === 401
                  ) {
                    toast({
                      title: "Sign in required",
                      description: "Please sign in to save favorites.",
                    });
                    const redirect = encodeURIComponent(window.location.href);
                    window.location.href = `/login?redirect=${redirect}`;
                  }
                } finally {
                  setIsFavLoading(false);
                }
              }}
            >
              <Heart
                className={`h-3 w-3 sm:h-4 sm:w-4 ${
                  isFavorited ? "fill-current text-red-500" : ""
                }`}
              />
            </Button>
          </div>

          {/* Details Content */}
          <Link
            href={`/listing/${listing.slug || "unknown"}`}
            className="p-2.5 sm:p-4 flex-1 flex flex-col justify-between space-y-1.5 sm:space-y-3"
          >
            <div className="space-y-1 sm:space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <span
                  className={cn(
                    "px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium truncate max-w-[85px] sm:max-w-none",
                    categoryColors.bg,
                    categoryColors.icon,
                  )}
                >
                  {listing.category_name || "Uncategorized"}
                </span>

                {/* Rating */}
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs sm:text-sm font-semibold text-foreground">
                    {Number(listing.avg_rating || 0).toFixed(1)}
                  </span>
                  <span className="hidden sm:inline text-xs text-muted-foreground">
                    ({listing.review_count || 0})
                  </span>
                </div>
              </div>

              <div className="space-y-0.5 sm:space-y-1">
                <h3 className="text-xs sm:text-lg font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-200">
                  {listing.name || "Unnamed Listing"}
                </h3>

                <div className="flex items-center space-x-1 text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  <span className="text-[11px] sm:text-sm line-clamp-1">
                    {listing.address}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 sm:pt-2 border-t border-border/20 text-[10px] sm:text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <MessageSquare className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
                <span>
                  {listing.review_count || 0}
                  <span className="hidden sm:inline ml-0.5">reviews</span>
                </span>
              </div>

              <div className="flex items-center text-[10px] sm:text-xs font-medium text-primary group-hover:translate-x-0.5 transition-transform duration-200">
                <span className="hidden sm:inline mr-1">Details</span>
                <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
