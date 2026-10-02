"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Star, Tag } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/types/database";
import { getListingImageUrl } from "@/lib/utils/listing-images";
import { useFavoritesStore } from "@/lib/context/favoritesStore";
import { toggleFavorite } from "@/lib/favorites";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
  category_group?: string | null;
  /** Neighbourhood read off the address; null when none is recognised. */
  area?: string | null;
  /** Live card offers at this place. */
  live_deals?: number;
  best_percent?: number | null;
};

interface FeaturedListingsSectionProps {
  listings: Listing[];
  /** Published places in total, already formatted ("3,600+"); null hides it. */
  totalPlaces?: string | null;
}

function offerLine(listing: Listing): string | null {
  const count = listing.live_deals ?? 0;
  if (count === 0) return null;
  if (listing.best_percent) return `Up to ${listing.best_percent}% off`;
  return count === 1 ? "1 card offer" : `${count} card offers`;
}

export function FeaturedListingsSection({
  listings,
  totalPlaces,
}: FeaturedListingsSectionProps) {
  const { toast } = useToast();
  const favorites = useFavoritesStore((state) => state.favorites);
  const addFavorite = useFavoritesStore((state) => state.addFavorite);
  const removeFavorite = useFavoritesStore((state) => state.removeFavorite);
  const [isFavLoading, setIsFavLoading] = useState<Record<number, boolean>>({});

  const handleFavorite = async (listing: Listing) => {
    const id = listing.id as number;
    if (isFavLoading[id]) return;
    setIsFavLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await toggleFavorite(id);
      if (typeof res?.favorited !== "undefined") {
        if (res.favorited) {
          addFavorite({ ...listing, favorited_at: new Date().toISOString() });
        } else {
          removeFavorite(String(id));
        }
      }
    } catch (err) {
      console.error("Favorite toggle failed", err);
      if (err instanceof Error && (err as { status?: number }).status === 401) {
        toast({
          title: "Sign in required",
          description: "Please sign in to save favorites.",
        });
        const redirect = encodeURIComponent(window.location.href);
        window.location.href = `/login?redirect=${redirect}`;
      }
    } finally {
      setIsFavLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (!listings || listings.length === 0) {
    return null;
  }

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading
          title="Featured Listings"
          subtitle={
            totalPlaces
              ? `Handpicked places to explore, out of ${totalPlaces}.`
              : "Handpicked places flagged as featured by our team."
          }
          href="/listings"
          actionLabel="All places"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {listings.map((listing) => {
            const rating = Number(listing.avg_rating || 0);
            const reviews = listing.review_count || 0;
            const isFavorite = favorites.some(
              (fav) => String(fav.id) === String(listing.id),
            );
            const offer = offerLine(listing);

            return (
              <div
                key={listing.id || `listing-${listing.slug}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card"
              >
                <Link
                  href={`/listing/${listing.slug || "unknown"}`}
                  className="block active:opacity-80"
                >
                  <div className="relative aspect-[4/3] bg-muted">
                    <OptimizedImage
                      src={getListingImageUrl(listing)}
                      alt={listing.name || "Listing"}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
                      className="object-cover"
                    />
                    {listing.show_member_badge && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                        Member
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 p-3">
                    <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground group-hover:text-primary">
                      {listing.name || "Unnamed listing"}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {reviews > 0 ? (
                        <>
                          <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" aria-hidden />
                          <span className="font-semibold text-foreground">
                            {rating.toFixed(1)}
                          </span>
                          <span>({reviews})</span>
                        </>
                      ) : (
                        <span className="shrink-0">No reviews yet</span>
                      )}
                      {listing.category_name ? (
                        <span className="min-w-0 truncate"> · {listing.category_name}</span>
                      ) : null}
                    </p>
                    {listing.area || listing.address ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {/* The neighbourhood when one is recognised, else the address */}
                        <span className="line-clamp-1">{listing.area || listing.address}</span>
                      </p>
                    ) : null}
                    {offer ? (
                      <p className="flex items-center gap-1 text-xs font-medium text-primary">
                        <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{offer}</span>
                      </p>
                    ) : null}
                  </div>
                </Link>

                {/* Outside the link so saving doesn't navigate */}
                <button
                  type="button"
                  aria-label={isFavorite ? "Remove from favorites" : "Save to favorites"}
                  aria-pressed={isFavorite}
                  onClick={() => handleFavorite(listing)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card active:opacity-80"
                >
                  <Heart
                    className={cn(
                      "h-4 w-4",
                      isFavorite ? "fill-primary text-primary" : "text-foreground",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
