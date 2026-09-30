"use client";

import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { EventHeroProps } from "@/types/events.types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShareButton } from "@/components/shared/ShareButton";

export function EventHero({
  event,
  images,
  withTopMargin = true,
}: EventHeroProps) {
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
    images && images.length ? images[0] : "/placeholder-event.jpg";

  return (
    <div
      className={`relative ${withTopMargin ? "mt-16 md:mt-20 lg:mt-24" : ""}`}
    >
      {/* Hero Image Section with Responsive Heights */}
      <div className="relative h-[60vh] sm:h-[65vh] md:h-[70vh] lg:h-[75vh] xl:h-[80vh] overflow-hidden">
        <div className="absolute inset-0 bg-black">
          <OptimizedImage
            src={heroImage}
            alt={event.name}
            fill
            className="object-cover animate-kenburns"
            priority
            data-debug={heroImage}
          />
        </div>

        {/* Gradient Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 dark:from-black/95 dark:via-black/60 dark:to-black/40" />

        {/* Radial vignette to focus center */}
        <div
          className="absolute inset-0 pointer-events-none bg-radial-vignette"
          aria-hidden="true"
        />

        {/* Subtle animated noise/grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none noise-overlay opacity-30"
          aria-hidden="true"
        />

        {/* Content Overlay - Mobile Centered, Desktop Bottom (matches PremiumListingHero) */}
        <div className="absolute inset-0 flex items-center md:items-end">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 md:pb-16 lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-4xl mx-auto md:mx-0 text-center md:text-left"
            >
              {/* Event Status Badge with Better Responsiveness */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="mb-3 sm:mb-4 md:mb-6 flex justify-center md:justify-start"
              >
                <Badge className="bg-primary/20 dark:bg-primary/30 border border-primary/30 text-primary-foreground font-semibold px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm md:text-base shadow-lg">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {event.status === "published"
                    ? "Upcoming Event"
                    : event.status}
                </Badge>
              </motion.div>

              {/* Event Title with Better Responsive Scaling */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight mb-3 sm:mb-4 md:mb-6 px-2 md:px-0"
              >
                {(() => {
                  const name = event.name || "";
                  const parts = name.trim().split(/\s+/);
                  if (parts.length === 0) return null;
                  if (parts.length === 1) {
                    return (
                      <span className="text-primary">{parts[0]}</span>
                    );
                  }
                  const last = parts.pop();
                  const first = parts.join(" ");
                  return (
                    <>
                      {first}{" "}
                      <span className="text-primary">{last}</span>
                    </>
                  );
                })()}
              </motion.h1>

              {/* Event Details - Single Card for Date/Time on Mobile, Grid on Desktop */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8"
              >
                {/* Date & Time Card */}
                <div className="glass-card rounded-xl p-4 md:p-5 border border-white/20 bg-white/5 dark:bg-white/10 w-full sm:w-auto">
                  <div className="flex items-center justify-center sm:justify-start space-x-3 sm:space-x-4">
                    <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 shadow-sm flex-shrink-0">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-white font-semibold text-sm sm:text-base md:text-lg">
                        {eventDateTime.date}
                      </p>
                      <p className="text-white/75 text-xs sm:text-sm">
                        {eventDateTime.time}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Location Card */}
                {event.location_name && (
                  <div className="glass-card rounded-xl p-4 md:p-5 border border-white/20 bg-white/5 dark:bg-white/10 w-full sm:w-auto">
                    <div className="flex items-center justify-center sm:justify-start space-x-3 sm:space-x-4">
                      <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 shadow-sm flex-shrink-0">
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-white font-semibold text-sm sm:text-base md:text-lg">
                          {event.location_name}
                        </p>
                        {event.address && (
                          <p className="text-white/75 text-xs sm:text-sm line-clamp-1">
                            {event.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Action Buttons - Centered on Mobile */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="flex items-center justify-center md:justify-start space-x-3 mb-4 sm:mb-6"
              >
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground font-semibold px-6 sm:px-8 py-3 rounded-xl shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(255,24,77,0.5)] focus-visible:ring-2 focus-visible:ring-primary/40 focus:outline-none text-sm sm:text-base"
                  onClick={() => {
                    const ticketsSection = document.getElementById("tickets");
                    if (ticketsSection) {
                      ticketsSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                >
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Tickets
                </Button>

                <ShareButton
                  contentType="event"
                  contentId={event.id}
                  contentTitle={event.name}
                  contentUrl={`/events/${event.slug}`}
                  variant="compact"
                />
              </motion.div>

              {/* Organizer Info - Below buttons, more subtle */}
              {event.organizer_name && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.35 }}
                  className="flex items-center justify-center md:justify-start space-x-3"
                >
                  <div className="p-0.5 bg-white/20 rounded-full">
                    <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                      <AvatarImage src={event.organizer_avatar || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {event.organizer_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-white/60 text-xs">Organized by</p>
                    <p className="text-white/90 font-medium text-sm">
                      {event.organizer_name}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
