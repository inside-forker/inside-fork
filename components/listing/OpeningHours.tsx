"use client";

import { motion } from "framer-motion";
import { Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PremiumHeading } from "@/components/brand/Typography";
import {
  sectionVariants,
  listContainerVariants,
  listItemVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

interface OpeningHour {
  id: number;
  listing_id: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
}

interface OpeningHoursProps {
  openingHours: OpeningHour[];
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const formatTime = (time: string | null) => {
  if (!time) return "";
  try {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return time;
  }
};

const isCurrentDay = (dayOfWeek: number) => {
  return new Date().getDay() === dayOfWeek;
};

const is24Hours = (open: string | null, close: string | null) => {
  if (!open || !close) return false;
  // Check if open is start of day (00:00) and close is end of day (23:59)
  return open.startsWith("00:00") && close.startsWith("23:59");
};

export function OpeningHours({ openingHours }: OpeningHoursProps) {
  if (!openingHours || openingHours.length === 0) {
    return null;
  }

  // Sort by day of week, starting with Monday (1) instead of Sunday (0)
  const sortedHours = [...openingHours].sort((a, b) => {
    // Convert Sunday (0) to 7 so it comes after Saturday (6)
    const dayA = a.day_of_week === 0 ? 7 : a.day_of_week;
    const dayB = b.day_of_week === 0 ? 7 : b.day_of_week;
    return dayA - dayB;
  });

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
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <PremiumHeading level={2} dense className="text-foreground">
                Opening <span className="gradient-text-primary">Hours</span>
              </PremiumHeading>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
                Check when we&apos;re open
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1 text-xs font-medium bg-primary/5"
          >
            Hours
          </Badge>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium flex-shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <PremiumHeading level={2} dense className="text-foreground">
              Opening <span className="gradient-text-primary">Hours</span>
            </PremiumHeading>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
              Check when we&apos;re open
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="px-4 py-2 font-semibold border-2 bg-primary/5"
        >
          Opening Hours
        </Badge>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-primary/10 backdrop-blur-sm border-2 md:border rounded-2xl p-6 md:p-8">
        {/* Background effects for consistency */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-50" />
        <div className="absolute top-4 right-4 w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl" />

        <motion.div
          className="relative space-y-4"
          variants={listContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportSettings}
        >
          {sortedHours.map((hour) => {
            const isCurrent = isCurrentDay(hour.day_of_week);

            return (
              <motion.div
                key={hour.id}
                variants={listItemVariants}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? "bg-primary/10 border-primary/30 shadow-md"
                    : "bg-background/50 border-border/30 hover:bg-background/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isCurrent
                        ? "bg-primary animate-pulse"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold text-sm md:text-base ${
                        isCurrent ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {DAYS[hour.day_of_week]}
                    </span>
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="hidden md:inline-flex text-xs px-2 py-1 bg-primary/20 text-primary border-primary/30"
                      >
                        Today
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  {hour.is_closed || !hour.open_time || !hour.close_time ? (
                    <span className="text-sm md:text-base text-muted-foreground font-medium">
                      Closed
                    </span>
                  ) : is24Hours(hour.open_time, hour.close_time) ? (
                    <span
                      className={`text-sm md:text-base font-semibold ${
                        isCurrent ? "text-primary" : "text-foreground"
                      }`}
                    >
                      Open 24 Hours
                    </span>
                  ) : (
                    <span
                      className={`text-sm md:text-base font-semibold ${
                        isCurrent ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {formatTime(hour.open_time)} -{" "}
                      {formatTime(hour.close_time)}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Quick info */}
        <div className="mt-6 pt-4 border-t border-border/30">
          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Times shown in local timezone</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
