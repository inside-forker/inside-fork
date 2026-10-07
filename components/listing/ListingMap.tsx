"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Landmark } from "lucide-react";
import { PremiumHeading } from "@/components/brand/Typography";
import { Database, Json } from "@/types/database";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
  parking_information?: string | null;
  parking_amenities?: Json | null;
};

interface ListingMapProps {
  listing: Listing;
}

function detectAreaFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const addr = address.toLowerCase();

  if (
    addr.includes("gulshan") ||
    addr.includes("gulshan-e-iqbal") ||
    addr.includes("gulshan e iqbal")
  ) {
    return "Gulshan-e-Iqbal";
  }
  if (
    addr.includes("johar") ||
    addr.includes("gulistan-e-johar") ||
    addr.includes("gulistan e johar")
  ) {
    return "Gulistan-e-Johar";
  }
  if (addr.includes("dha") || addr.includes("defence") || addr.includes("phase ")) {
    return "DHA";
  }
  if (
    addr.includes("clifton") ||
    addr.includes("boat basin") ||
    addr.includes("sea view")
  ) {
    return "Clifton";
  }
  if (addr.includes("bahadurabad")) {
    return "Bahadurabad";
  }
  if (addr.includes("north nazimabad") || addr.includes("nazimabad")) {
    return "North Nazimabad";
  }
  if (addr.includes("pechs") || addr.includes("p.e.c.h.s")) {
    return "PECHS";
  }
  if (
    addr.includes("saddar") ||
    addr.includes("burns road") ||
    addr.includes("i.i. chundrigar")
  ) {
    return "Saddar";
  }
  if (addr.includes("tariq road")) {
    return "Tariq Road";
  }
  if (addr.includes("tipu sultan")) {
    return "Tipu Sultan";
  }
  if (
    addr.includes("fb area") ||
    addr.includes("federal b") ||
    addr.includes("f.b area")
  ) {
    return "Federal B Area";
  }
  if (addr.includes("gulberg")) {
    return "Gulberg";
  }
  if (addr.includes("malir") || addr.includes("malir cantt")) {
    return "Malir";
  }
  if (addr.includes("korangi")) {
    return "Korangi";
  }
  if (addr.includes("north karachi") || addr.includes("new karachi")) {
    return "North Karachi";
  }
  if (addr.includes("scheme 33")) {
    return "Scheme 33";
  }
  if (addr.includes("shahrah-e-faisal") || addr.includes("shahrah e faisal")) {
    return "Shahrah-e-Faisal";
  }
  return null;
}

const AREA_LANDMARKS: Record<
  string,
  Array<{ name: string; distance: string; icon: string }>
> = {
  "Gulshan-e-Iqbal": [
    { name: "Maskan Chowrangi", distance: "Nearby", icon: "🏙️" },
    { name: "Expo Centre", distance: "Nearby", icon: "🏛️" },
    { name: "Disco Bakery", distance: "Nearby", icon: "🥐" },
    { name: "Karachi University", distance: "Nearby", icon: "🎓" },
  ],
  "Gulistan-e-Johar": [
    { name: "Johar Chowrangi", distance: "Nearby", icon: "🏙️" },
    { name: "Darul Sehat", distance: "Nearby", icon: "🏥" },
    { name: "Millennium Mall", distance: "Nearby", icon: "🛍️" },
    { name: "Safari Park", distance: "Nearby", icon: "🌳" },
  ],
  DHA: [
    { name: "DHA Phase 5 / 6", distance: "Nearby", icon: "🏢" },
    { name: "Bukhari Commercial", distance: "Nearby", icon: "☕" },
    { name: "Dolmen Mall Clifton", distance: "Nearby", icon: "🛍️" },
    { name: "Sea View", distance: "Nearby", icon: "🌊" },
  ],
  Clifton: [
    { name: "Boat Basin", distance: "Nearby", icon: "🍲" },
    { name: "Dolmen Mall Clifton", distance: "Nearby", icon: "🛍️" },
    { name: "Clifton Block 2 / 4", distance: "Nearby", icon: "🏢" },
    { name: "Sea View", distance: "Nearby", icon: "🌊" },
  ],
  PECHS: [
    { name: "Tariq Road", distance: "Nearby", icon: "🛍️" },
    { name: "Khalid Bin Walid Rd", distance: "Nearby", icon: "🚗" },
    { name: "Sindhi Muslim (SMCHS)", distance: "Nearby", icon: "🍔" },
    { name: "Shahrah-e-Faisal", distance: "Nearby", icon: "🛣️" },
  ],
  "North Nazimabad": [
    { name: "Hyderi Market", distance: "Nearby", icon: "🛍️" },
    { name: "Five Star Chowrangi", distance: "Nearby", icon: "⭐" },
    { name: "KDA Chowrangi", distance: "Nearby", icon: "🏙️" },
    { name: "Ziauddin Hospital", distance: "Nearby", icon: "🏥" },
  ],
  Bahadurabad: [
    { name: "Char Minar Chowrangi", distance: "Nearby", icon: "🏛️" },
    { name: "Tariq Road", distance: "Nearby", icon: "🛍️" },
    { name: "Alamgir Road", distance: "Nearby", icon: "☕" },
    { name: "Shaheed-e-Millat", distance: "Nearby", icon: "🛣️" },
  ],
};

const DEFAULT_LANDMARKS = [
  { name: "Karachi Central", distance: "City Centre", icon: "🏙️" },
  { name: "Shahrah-e-Faisal", distance: "Main Arterial", icon: "🛣️" },
  { name: "Airport Route", distance: "Connecting Road", icon: "✈️" },
  { name: "City Hub", distance: "Metro Area", icon: "📍" },
];

export function ListingMap({ listing }: ListingMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);

  const detectedArea = detectAreaFromAddress(listing.address);
  const nearbyPlaces =
    (detectedArea && AREA_LANDMARKS[detectedArea]) || DEFAULT_LANDMARKS;

  // Prefer precise coordinates if present; otherwise fallback to address; otherwise Karachi default
  const hasCoords = !!(listing.latitude && listing.longitude);
  const latitude = hasCoords ? listing.latitude! : 24.8607;
  const longitude = hasCoords ? listing.longitude! : 67.0011;

  // Build directions URL with best available data
  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : listing.address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        listing.address
      )}`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  // Marker-enabled embed (no API key):
  // - If coords: use q=loc:lat,lng to force a pin
  // - Else if address: use q=encoded address
  const embedUrl = hasCoords
    ? `https://www.google.com/maps?q=loc:${latitude},${longitude}&z=16&output=embed`
    : listing.address
    ? `https://www.google.com/maps?q=${encodeURIComponent(
        listing.address
      )}&z=16&output=embed`
    : `https://www.google.com/maps?q=loc:${latitude},${longitude}&z=12&output=embed`;

  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Mobile-First Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Location & <span className="gradient-text-primary">Map</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                Find us easily
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs font-medium bg-primary/5"
          >
            Location
          </Badge>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Location & <span className="gradient-text-primary">Map</span>
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              Find us easily with detailed directions
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="px-4 py-2 font-semibold border-2 bg-primary/5"
        >
          Location Details
        </Badge>
      </div>

      {/* Map Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`relative bg-card border-2 md:border rounded-2xl overflow-hidden shadow-lg ${
          isFullscreen ? "fixed inset-4 z-50" : "h-80 md:h-96"
        }`}
      >
        {/* Map Controls */}
        <div className="absolute top-3 md:top-4 right-3 md:right-4 z-10 flex gap-2 pointer-events-none">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg rounded-xl px-2 md:px-3 py-2 pointer-events-auto"
          >
            {isFullscreen ? (
              <svg
                className="w-4 h-4"
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
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            )}
          </Button>
          {/* Open in Maps (inside embed) */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.open(directionsUrl, "_blank")}
            className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg rounded-xl px-2 md:px-3 py-2 pointer-events-auto"
            title="Open in Google Maps"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden md:inline ml-2">Open</span>
          </Button>
        </div>

        {/* Map Display */}
        <div className="w-full h-full relative">
          {!mapLoadError ? (
            /* Google Maps Embed */
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="rounded-xl"
              title={`Map showing location of ${listing.name}`}
              onError={() => setMapLoadError(true)}
            />
          ) : (
            /* Fallback when map fails to load */
            <div className="w-full h-full bg-muted/30 flex items-center justify-center rounded-xl">
              <div className="text-center space-y-3 md:space-y-4 px-4">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <svg
                    className="w-6 h-6 md:w-8 md:h-8 text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-base md:text-lg">
                    {listing.name}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {listing.address}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </p>
                  <button
                    onClick={() => window.open(directionsUrl, "_blank")}
                    className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
                  >
                    View on Google Maps
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive overlay - only show when map is loaded */}
          {!mapLoadError && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none rounded-xl" />
          )}
        </div>

        {/* Map Overlay with Location Info - moved to top-left and non-interactive to not block map UI */}
        <div className="absolute top-3 md:top-4 left-3 md:left-4 max-w-md pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-2xl p-3 md:p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-md">
                <svg
                  className="w-4 h-4 md:w-5 md:h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">
                  {listing.name}
                </h3>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed line-clamp-2">
                  {listing.address}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Address and Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6"
      >
        {/* Address Details */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-4 md:p-6">
          {/* Background effects for consistency */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
          <div className="absolute top-2 right-2 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <h3 className="font-semibold text-base md:text-lg">
                Full Address
              </h3>
            </div>
            <p className="text-muted-foreground mb-3 md:mb-4 leading-relaxed text-sm md:text-base">
              {listing.address}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="px-2 md:px-3 py-1 text-xs">
                📍 Karachi
              </Badge>
              {detectedArea && (
                <Badge variant="secondary" className="px-2 md:px-3 py-1 text-xs">
                  🏙️ {detectedArea}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-4 md:p-6">
          {/* Background effects for consistency */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
          <div className="absolute top-2 right-2 w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-lg" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <Navigation className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              <h3 className="font-semibold text-base md:text-lg">
                Get Directions
              </h3>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 text-sm md:text-base"
                onClick={() => window.open(directionsUrl, "_blank")}
              >
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Open in Google Maps
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="py-2.5 rounded-xl border-border hover:bg-accent transition-all duration-300 text-xs md:text-sm"
                  onClick={() =>
                    window.open(
                      `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
                      "_blank"
                    )
                  }
                >
                  🚗 Waze
                </Button>
                <Button
                  variant="outline"
                  className="py-2.5 rounded-xl border-border hover:bg-accent transition-all duration-300 text-xs md:text-sm"
                  onClick={() => {
                    if (listing.address) {
                      navigator.clipboard.writeText(listing.address);
                    }
                  }}
                >
                  📋 Copy
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Nearby Places */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="bg-gradient-to-r from-primary/5 to-secondary/5 border rounded-2xl p-4 md:p-6"
      >
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Landmark className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          <h3 className="font-semibold text-base md:text-lg">
            Nearby Landmarks
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {nearbyPlaces.map((place, index) => (
            <motion.div
              key={place.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.7 + index * 0.1 }}
              className="text-center p-3 md:p-4 bg-background/50 backdrop-blur-sm border rounded-xl hover:bg-background/70 transition-all duration-300 hover:scale-105"
            >
              <div className="text-xl md:text-2xl mb-2">{place.icon}</div>
              <h4 className="font-medium text-xs md:text-sm mb-1 line-clamp-1">
                {place.name}
              </h4>
              <p className="text-xs text-muted-foreground">{place.distance}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Parking Information - Display from database if available */}
      {(listing.parking_information ||
        (listing.parking_amenities &&
          Array.isArray(listing.parking_amenities) &&
          listing.parking_amenities.length > 0)) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8 }}
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 md:p-6"
        >
          <div className="flex items-start gap-3">
            <div className="text-blue-500 text-lg md:text-xl">🚗</div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm md:text-base">
                Parking Information
              </h3>
              {listing.parking_information && (
                <p className="text-xs md:text-sm text-blue-800 dark:text-blue-200 mb-3 leading-relaxed">
                  {listing.parking_information}
                </p>
              )}
              {listing.parking_amenities &&
                Array.isArray(listing.parking_amenities) &&
                listing.parking_amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {listing.parking_amenities.map(
                      (amenity: Json, index: number) => (
                        <Badge
                          key={`${String(amenity)}-${index}`}
                          className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700 text-xs"
                        >
                          {String(amenity)}
                        </Badge>
                      )
                    )}
                  </div>
                )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
