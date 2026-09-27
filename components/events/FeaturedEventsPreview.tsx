"use client";

import { motion } from "framer-motion";
import FeaturedEventsCarousel from "@/components/events/FeaturedEventsCarousel";
import { Ticket } from "lucide-react";

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
      className="pt-8 w-full"
    >
      <div className="mb-8">
        <div className="flex flex-col items-center justify-center sm:flex-row sm:items-center sm:justify-start gap-2 sm:gap-3 w-full">
          <div className="p-2 sm:p-3 rounded-2xl bg-primary/10 border border-primary/20 flex-shrink-0 mb-2 sm:mb-0">
            <Ticket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
              Featured <span className="gradient-text-primary">Events</span>
            </h2>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
              Handpicked featured events this week
            </p>
          </div>
        </div>
      </div>

      <FeaturedEventsCarousel items={featuredEvents.slice(0, 6)} />
    </motion.div>
  );
}
