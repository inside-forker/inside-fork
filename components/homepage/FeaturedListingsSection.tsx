"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Star } from "lucide-react";
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
};

interface FeaturedListingsSectionProps {
  listings: Listing[];
}

export function FeaturedListingsSection({
  listings,
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
          title="Featured places"
          subtitle="Spots worth knowing about"
          href="/listings"
          actionLabel="All places"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const rating = Number(listing.avg_rating || 0);
            const reviews = listing.review_count || 0;
            const isFavorite = favorites.some(
              (fav) => String(fav.id) === String(listing.id),
            );

            return (
              <div
                key={listing.id || `listing-${listing.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card"
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
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {listing.show_member_badge && (
                      <span className="absolute bottom-3 left-3 rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                        Member
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 p-4">
                    <h3 className="line-clamp-1 font-semibold tracking-tight text-foreground group-hover:text-primary">
                      {listing.name || "Unnamed listing"}
                    </h3>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      {reviews > 0 ? (
                        <>
                          <Star className="h-4 w-4 fill-primary text-primary" aria-hidden />
                          <span className="font-semibold text-foreground">
                            {rating.toFixed(1)}
                          </span>
                          <span>({reviews})</span>
                        </>
                      ) : (
                        <span>No reviews yet</span>
                      )}
                      {listing.category_name ? (
                        <span className="line-clamp-1"> · {listing.category_name}</span>
                      ) : null}
                    </p>
                    {listing.address ? (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{listing.address}</span>
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
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card active:opacity-80"
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
