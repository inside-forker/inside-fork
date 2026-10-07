"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Ticket, Sparkles } from "lucide-react";
import { EventHeroProps } from "@/types/events.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareButton } from "@/components/shared/ShareButton";

export function EventHero({
  event,
  images = [],
  withTopMargin = false,
}: EventHeroProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Auto-rotate images if multiple provided
  useEffect(() => {
    if (images && images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [images]);

  const formatEventDate = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };

    const isSameDay = start.toDateString() === end.toDateString();

    if (isSameDay) {
      return {
        date: formatDate(start),
        time: `${formatTime(start)} - ${formatTime(end)}`,
      };
    } else {
      return {
        date: `${formatDate(start)} - ${formatDate(end)}`,
        time: `${formatTime(start)} - ${formatTime(end)}`,
      };
    }
  };

  const eventDateTime = formatEventDate(event.start_time, event.end_time);
  const heroImage =
    images && images.length > 0
      ? images[currentImageIndex]
      : "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center";

  return (
    <div
      className={`relative min-h-[580px] sm:min-h-[620px] md:h-[75vh] lg:h-[80vh] overflow-hidden flex flex-col justify-between ${
        withTopMargin ? "mt-16 md:mt-20" : ""
      }`}
    >
      {/* Background Image with Smooth Fade */}
      <motion.div
        key={currentImageIndex}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <OptimizedImage
          src={heroImage}
          alt={event.name}
          fill
          className="object-cover"
          priority
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />

        {/* Ambient Dark Tint & Deep High-Contrast Gradients */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 via-50% to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/90 via-black/60 to-transparent pointer-events-none" />
      </motion.div>

      {/* Floating Top Bar (Status & Featured Badges) */}
      <div className="relative z-20 w-full container mx-auto px-4 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap">
          <Badge
            variant="secondary"
            className="backdrop-blur-xl bg-black/70 text-white border border-white/20 px-3 py-1.5 text-xs font-semibold shadow-lg"
          >
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {event.status === "published" ? "Upcoming Event" : event.status}
            </span>
          </Badge>

          {event.is_featured && (
            <Badge
              variant="outline"
              className="backdrop-blur-xl bg-amber-500/30 text-amber-200 border border-amber-400/50 px-2.5 py-1.5 text-xs font-semibold shadow-lg"
            >
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Featured
              </span>
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content - Anchored at Bottom with Generous Spacing */}
      <div className="relative z-10 w-full pt-8 pb-6 sm:pb-10">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-4xl text-left space-y-4 sm:space-y-5"
          >
            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {event.name}
            </h1>

            {/* Event Details Chips Row */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-white">
              {/* Date & Time Chip */}
              <div className="backdrop-blur-md bg-black/40 border border-white/15 px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm shadow-md">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-primary flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white block leading-snug">
                    {eventDateTime.date}
                  </span>
                  <span className="text-white/70 text-[11px] sm:text-xs block leading-tight">
                    {eventDateTime.time}
                  </span>
                </div>
              </div>

              {/* Location Chip */}
              {event.location_name && (
                <div className="backdrop-blur-md bg-black/40 border border-white/15 px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm shadow-md max-w-full sm:max-w-md">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-primary flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-white block leading-snug truncate">
                      {event.location_name}
                    </span>
                    {event.address && (
                      <span className="text-white/70 text-[11px] sm:text-xs block leading-tight truncate">
                        {event.address}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Organizer Capsule */}
              {event.organizer_name && (
                <div className="backdrop-blur-md bg-black/40 border border-white/15 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs shadow-md">
                  <Avatar className="h-6 w-6 border border-white/20">
                    <AvatarImage src={event.organizer_avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      {event.organizer_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white/80">
                    By <span className="font-medium text-white">{event.organizer_name}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center gap-3 flex-wrap">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground font-bold px-7 sm:px-9 py-3.5 rounded-xl shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(255,24,77,0.5)] focus-visible:ring-2 focus-visible:ring-primary/40 focus:outline-none text-sm sm:text-base gap-2"
                onClick={() => {
                  const ticketsSection = document.getElementById("tickets");
                  if (ticketsSection) {
                    ticketsSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                Get Tickets
              </Button>

              <ShareButton
                contentType="event"
                contentId={event.id}
                contentTitle={event.name}
                contentUrl={`/events/${event.slug}`}
                variant="compact"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
