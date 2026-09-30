"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, Copy, Check } from "lucide-react";
import { EventLocationProps } from "@/types/events.types";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

export function EventLocation({ event }: EventLocationProps) {
  const [copied, setCopied] = useState(false);
  const locationName = event.location_name;
  const locationAddress = event.address;
  const locationLatitude = event.latitude;
  const locationLongitude = event.longitude;

  if (!locationName && !locationAddress) {
    return null;
  }

  const fullAddressText = [locationName, locationAddress]
    .filter(Boolean)
    .join(", ");

  const handleGetDirections = () => {
    if (locationLatitude && locationLongitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${locationLatitude},${locationLongitude}`;
      window.open(url, "_blank");
    } else if (locationAddress || locationName) {
      const query = locationAddress || locationName || "";
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query,
      )}`;
      window.open(url, "_blank");
    }
  };

  const handleCopyAddress = async () => {
    if (!fullAddressText) return;
    try {
      await navigator.clipboard.writeText(fullAddressText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      {/* Section eyebrow */}
      <p className="mb-3 text-xs font-mono font-semibold uppercase tracking-wider text-primary">
        Location
      </p>

      {/* Location Card */}
      <Card className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Location info */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary flex-shrink-0 mt-0.5 sm:mt-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              {locationName && (
                <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug truncate">
                  {locationName}
                </h3>
              )}
              {locationAddress && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed break-words">
                  {locationAddress}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
            {fullAddressText && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyAddress}
                className="rounded-xl border-border/60 text-xs gap-1.5 h-9"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Address
                  </>
                )}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleGetDirections}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold gap-1.5 h-9 shadow-sm shadow-primary/20"
            >
              <Navigation className="w-3.5 h-3.5" />
              Directions
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
