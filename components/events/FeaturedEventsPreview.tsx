"use client";

import { motion } from "framer-motion";
import FeaturedEventsCarousel from "@/components/events/FeaturedEventsCarousel";
import { SectionHeading } from "@/components/shared/SectionHeading";

import type { Event } from "@/types/events.types";

interface FeaturedEventsPreviewProps {
  featuredEvents: Event[];
}

export function FeaturedEventsPreview({
  featuredEvents,
}: FeaturedEventsPreviewProps) {
  if (!featuredEvents || featuredEvents.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="w-full pb-10"
    >
      <SectionHeading title="Spotlight" subtitle="Featured events coming up" />

      <FeaturedEventsCarousel items={featuredEvents.slice(0, 6)} />
    </motion.div>
  );
}
