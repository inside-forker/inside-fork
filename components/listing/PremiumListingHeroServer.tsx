import { Database } from "@/types/database";
import { PremiumListingHeroClient } from "./PremiumListingHeroClient";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface PremiumListingHeroProps {
  listing: Listing;
  images?: string[];
  withTopMargin?: boolean;
}

// Better image fallback logic with type-specific placeholders
function getFallbackImage(listing: Listing): string {
  // Fallback based on listing type/category
  const category = listing.category_name?.toLowerCase() || "";
  if (category.includes("restaurant") || category.includes("food")) {
    return "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=600&fit=crop&crop=center";
  } else if (category.includes("hotel") || category.includes("accommodation")) {
    return "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=600&fit=crop&crop=center";
  } else if (category.includes("cafe") || category.includes("coffee")) {
    return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&h=600&fit=crop&crop=center";
  } else if (category.includes("shop") || category.includes("store")) {
    return "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop&crop=center";
  } else {
    return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&h=600&fit=crop&crop=center";
  }
}

export function PremiumListingHero({
  listing,
  images = [],
  withTopMargin = true,
}: PremiumListingHeroProps) {
  const fallbackImage = getFallbackImage(listing);

  return (
    <div
      className={`relative h-[70vh] lg:h-[85vh] overflow-hidden ${
        withTopMargin ? "mt-20" : ""
      }`}
    >
      {/* Client Component for Interactive Parts including Background Image */}
      <PremiumListingHeroClient
        listing={listing}
        images={images}
        fallbackImage={fallbackImage}
      />

      {/* Gradient Orbs */}
      <div className="absolute top-1/4 left-1/5 hidden xl:block pointer-events-none">
        <div className="w-32 h-32 bg-gradient-to-br from-primary/15 to-transparent rounded-full blur-3xl opacity-60 animate-pulse" />
      </div>

      <div className="absolute bottom-1/3 right-1/4 hidden xl:block pointer-events-none">
        <div
          className="w-40 h-40 bg-gradient-to-br from-blue-500/10 to-primary/10 rounded-full blur-3xl opacity-50 animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Top edge highlight for depth */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
