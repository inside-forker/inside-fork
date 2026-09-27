"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import type { Event } from "@/types/events.types";

interface TrendingEventsSectionProps {
  events: Event[];
}

export function TrendingEventsSection({ events }: TrendingEventsSectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const,
      },
    },
  };

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background to-background/50" />

      {/* Floating Background Elements */}
      <div className="absolute top-32 left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-32 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile-First Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 sm:mb-16"
        >
          {/* Unified Header for All Screen Sizes */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Trending <span className="gradient-text-primary">Events</span>
              </h2>
            </div>
            <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              Don&apos;t miss out on the hottest events happening in Karachi.
              From concerts to cultural festivals.
            </p>
          </div>
        </motion.div>

        {/* Events Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8"
        >
          {events.map((event, index) => (
            <motion.div key={event.id} variants={itemVariants}>
              <EventCard event={event} index={index} />
            </motion.div>
          ))}
        </motion.div>

        {/* View All Events CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mt-16"
        >
          <Link href="/events">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center space-x-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/20 shadow-premium hover:shadow-premium-lg hover:bg-primary/20 dark:hover:bg-primary/30 transition-all duration-300 group"
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="text-base sm:text-lg font-semibold text-primary">
                View All Events
              </span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
