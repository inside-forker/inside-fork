"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Navigation, Ticket, Sparkles } from "lucide-react";
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

  // Google Maps: exact pin when we have coordinates, else search the address
  const directionsUrl =
    event.latitude && event.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          event.address || event.location_name || "",
        )}`;
  const heroImage =
    images && images.length > 0
      ? images[currentImageIndex]
      : "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=800&fit=crop&crop=center";

  return (
    <div
      className={`relative overflow-hidden md:flex md:flex-col md:justify-between md:min-h-[620px] md:h-[75vh] lg:h-[80vh] ${
        withTopMargin ? "mt-16 md:mt-20" : ""
      }`}
    >
      {/* Phones: the whole poster on its own (no crop), details below it */}
      <motion.div
        key={`poster-${currentImageIndex}`}
        className="bg-black md:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <OptimizedImage
          src={heroImage}
          alt={event.name}
          width={1200}
          height={675}
          className="h-auto w-full"
          priority
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
      </motion.div>

      {/* Tablet & desktop: Background Image with Smooth Fade */}
      <motion.div
        key={currentImageIndex}
        className="absolute inset-0 hidden md:block"
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

      {/* Floating Top Bar (Status & Featured Badges) - tablet & desktop */}
      <div className="relative z-20 w-full container mx-auto px-4 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-5 hidden md:flex items-center justify-between pointer-events-none">
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

      {/* Main Content - below the poster on phones, over it from tablet up */}
      <div className="relative z-10 w-full pt-4 pb-1 md:pt-8 md:pb-10">
        <div className="container mx-auto px-4 md:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="max-w-4xl text-left space-y-3 md:space-y-5"
          >
            {/* Status (phones) */}
            <div className="flex items-center gap-3 text-xs font-semibold md:hidden">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {event.status === "published" ? "Upcoming Event" : event.status}
              </span>
              {event.is_featured && (
                <span className="flex items-center gap-1 text-amber-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  Featured
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold text-foreground md:text-white tracking-tight leading-tight md:drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {event.name}
            </h1>

            {/* Event Details - plain rows on phones, glass chips from tablet up */}
            <div className="flex flex-col items-start gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3 text-foreground md:text-white">
              {/* Date & Time Chip */}
              <div className="flex items-center gap-2.5 text-sm md:backdrop-blur-md md:bg-black/40 md:border md:border-white/15 md:px-3.5 md:py-2 md:rounded-xl md:shadow-md">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 md:bg-primary/20 text-primary flex-shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-foreground md:text-white block leading-snug">
                    {eventDateTime.date}
                  </span>
                  <span className="text-muted-foreground md:text-white/70 text-xs block leading-tight">
                    {eventDateTime.time}
                  </span>
                </div>
              </div>

              {/* Location Chip */}
              {event.location_name && (
                <div className="flex items-center gap-2.5 text-sm max-w-full md:max-w-md md:backdrop-blur-md md:bg-black/40 md:border md:border-white/15 md:px-3.5 md:py-2 md:rounded-xl md:shadow-md">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 md:bg-primary/20 text-primary flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground md:text-white block leading-snug md:truncate">
                      {event.location_name}
                    </span>
                    {event.address && (
                      <span className="text-muted-foreground md:text-white/70 text-xs block leading-tight md:truncate">
                        {event.address}
                      </span>
                    )}
                  </div>
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 md:bg-primary md:text-primary-foreground md:hover:bg-primary/90"
                  >
                    <Navigation className="h-3 w-3" />
                    Directions
                  </a>
                </div>
              )}

              {/* Organizer Capsule */}
              {event.organizer_name && (
                <div className="flex items-center gap-2.5 md:gap-2 text-sm md:text-xs md:backdrop-blur-md md:bg-black/40 md:border md:border-white/15 md:px-3 md:py-1.5 md:rounded-full md:shadow-md">
                  <Avatar className="h-7 w-7 md:h-6 md:w-6 border border-border md:border-white/20">
                    <AvatarImage src={event.organizer_avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      {event.organizer_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground md:text-white/80">
                    By <span className="font-medium text-foreground md:text-white">{event.organizer_name}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-1 md:pt-2 flex items-center gap-3">
              <Button
                size="lg"
                className="flex-1 md:flex-none bg-primary text-primary-foreground font-bold px-7 sm:px-9 py-3.5 rounded-xl shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(255,24,77,0.5)] focus-visible:ring-2 focus-visible:ring-primary/40 focus:outline-none text-sm sm:text-base gap-2"
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
