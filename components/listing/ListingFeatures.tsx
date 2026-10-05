"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";

import { Database } from "@/types/database";
import {
  sectionVariants,
  cardGridVariants,
  cardVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface Feature {
  name: string;
  icon: string;
  description: string;
}

interface ListingFeaturesProps {
  listing: Listing;
  /** Server-fetched listing_features, joined with listing_features_master. */
  initialFeatures?: Feature[];
}

// Feature icon mapping for better visuals
const featureIcons: Record<string, string> = {
  "Free WiFi": "📶",
  "Parking Available": "🚗",
  "Air Conditioned": "❄️",
  "Family Friendly": "👨‍👩‍👧‍👦",
  "Halal Certified": "🥩",
  "Card Payments": "💳",
  "Delivery Service": "🚚",
  Takeaway: "📦",
  "Outdoor Seating": "🌿",
  "Private Dining": "🏛️",
  "Wheelchair Accessible": "♿",
  "Vegan Options": "🌱",
  "Live Music": "🎵",
  "Valet Parking": "🔑",
  "Pet Friendly": "🐕",
  "Buffet Available": "🍛",
  "Digital Payments": "📱",
  Catering: "🍽️",
  "Room Service": "🛎️",
};

export function ListingFeatures({
  listing,
  initialFeatures = [],
}: ListingFeaturesProps) {
  const databaseFeatures = initialFeatures;

  // Get feature descriptions
  const getFeatureDescription = (feature: string): string => {
    const descriptions: Record<string, string> = {
      "Free WiFi": "Complimentary high-speed internet",
      "Parking Available": "Convenient on-site parking",
      "Air Conditioned": "Climate controlled environment",
      "Family Friendly": "Welcoming for all ages",
      "Halal Certified": "Certified halal preparation",
      "Card Payments": "All major cards accepted",
      "Delivery Service": "Home delivery available",
      Takeaway: "Quick pickup service",
      "Outdoor Seating": "Al fresco dining experience",
      "Private Dining": "Exclusive dining rooms",
      "Wheelchair Accessible": "Fully accessible facility",
      "Vegan Options": "Plant-based menu available",
      "Live Music": "Regular live entertainment",
      "Valet Parking": "Professional parking service",
      "Pet Friendly": "Pets welcome",
      "Buffet Available": "All-you-can-eat dining",
      "Digital Payments": "Mobile wallet accepted",
      Catering: "Event catering services",
      "Room Service": "24-hour in-room dining",
    };
    return descriptions[feature] || "Premium service available";
  };

  // Extract features from custom_attributes amenities (admin-managed)
  const getCustomAmenities = (): Feature[] => {
    try {
      const customAttrs = listing.custom_attributes as Record<string, unknown>;
      if (customAttrs?.amenities && Array.isArray(customAttrs.amenities)) {
        return customAttrs.amenities.map(
          (amenity: { name: string; icon?: string; description?: string }) => ({
            name: amenity.name,
            icon: amenity.icon || featureIcons[amenity.name] || "✨",
            description:
              amenity.description || getFeatureDescription(amenity.name),
          })
        );
      }
    } catch (error) {
      console.error("Error parsing custom amenities:", error);
    }
    return [];
  };

  // Extract features from custom_attributes (fallback)
  const getFallbackFeatures = (): Feature[] => {
    try {
      const customAttrs = listing.custom_attributes as Record<string, unknown>;
      if (customAttrs?.features && Array.isArray(customAttrs.features)) {
        return customAttrs.features.map((feature: string) => ({
          name: feature,
          icon: featureIcons[feature] || "✨",
          description: getFeatureDescription(feature),
        }));
      }
    } catch (error) {
      console.error("Error parsing features:", error);
    }
    return [];
  };

  // Combine database features and custom amenities (admin-managed)
  // Admin can remove database features and add custom ones via admin interface
  const customAmenities = getCustomAmenities();
  const allFeatures = [...databaseFeatures, ...customAmenities];

  // Remove duplicates based on feature name (case-insensitive)
  const uniqueFeatures = allFeatures.filter(
    (feature, index, self) =>
      index ===
      self.findIndex((f) => f.name.toLowerCase() === feature.name.toLowerCase())
  );

  const features =
    uniqueFeatures.length > 0 ? uniqueFeatures : getFallbackFeatures();

  if (features.length === 0) return null;

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Mobile-First Features Section */}
      <div className="md:hidden">
        {/* Mobile Header - Matching Photos Section Style */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Features &{" "}
                <span className="gradient-text-primary">Amenities</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                What makes this place special
              </p>
            </div>
          </div>
          <Badge variant="outline" className="px-3 py-1 text-xs font-medium">
            {features.length} {features.length === 1 ? "feature" : "features"}
          </Badge>
        </div>

        {/* Mobile Features Grid - Compact 2-column layout */}
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={cardGridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportSettings}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              variants={cardVariants}
              className="group"
            >
              <div className="relative overflow-hidden rounded-xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 p-3 h-24">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Content */}
                <div className="relative z-10 text-center space-y-2 h-full flex flex-col justify-center">
                  {/* Icon */}
                  <div className="mx-auto w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center text-sm group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 flex flex-col justify-center">
                    <h4 className="font-semibold text-xs group-hover:text-primary transition-colors duration-300 line-clamp-1 leading-tight">
                      {feature.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1 leading-tight">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Desktop Features Section - Original Design */}
      <div className="hidden md:block space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Features &{" "}
                <span className="gradient-text-primary">Amenities</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                What makes this place special
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-4 py-2 font-semibold border-2 bg-primary/5"
          >
            {features.length} Features
          </Badge>
        </div>

        {/* Desktop Features Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={cardGridVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportSettings}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              variants={cardVariants}
              whileHover={{ y: -2, scale: 1.02 }}
              className="group"
            >
              <div className="relative overflow-hidden rounded-2xl bg-background/80 backdrop-blur-xl border border-border/50 shadow-premium hover:shadow-premium-lg transition-all duration-300 p-4">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Content */}
                <div className="relative z-10 flex items-center space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm group-hover:text-primary transition-colors duration-300 truncate">
                      {feature.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
