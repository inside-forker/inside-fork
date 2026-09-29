"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { Event } from "@/types/events.types";

interface EventCardProps {
  event: Event;
  index?: number;
  showAnimation?: boolean;
  variant?: "default" | "featured" | "compact";
}

// Pinned to Karachi time so the server render and the browser agree.
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Karachi",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

function formatWhen(startTime: string) {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return null;
  return `${dayFormat.format(date).replace(",", "")} · ${timeFormat.format(date)}`;
}

/** Only statuses worth flagging get a pill; plain "upcoming" gets none. */
function getStatus(startTime: string, endTime?: string | null) {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : null;
  if (end && now >= start && now <= end) return { text: "Happening now", tone: "success" as const };
  const hours = (start - now) / 3_600_000;
  if (hours < 0) return { text: "Ended", tone: "muted" as const };
  if (hours < 24) return { text: "Today", tone: "primary" as const };
  return null;
}

/**
 * Event card, flat to match the mobile app: photo, then name and one meta
 * line on the card surface. The whole card is the link.
 */
export function EventCard({
  event,
  showAnimation = true,
  variant = "default",
}: EventCardProps) {
  const image =
    event.images && event.images.length > 0
      ? event.images.find((img) => img.is_primary)?.url || event.images[0].url
      : null;
  const when = formatWhen(event.start_time);
  const status = getStatus(event.start_time, event.end_time);

  return (
    <motion.div
      initial={showAnimation ? { opacity: 0, y: 12 } : undefined}
      animate={showAnimation ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full"
    >
      <Link
        href={`/events/${event.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card active:opacity-80"
      >
        <div className="relative aspect-[16/10] bg-muted">
          {image ? (
            <OptimizedImage
              src={image}
              alt={event.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
          )}

          {(status || variant === "featured") && (
            <div className="absolute left-3 top-3 flex gap-2">
              {variant === "featured" && (
                <span className="rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                  Spotlight
                </span>
              )}
              {status && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
                    status.tone === "success" && "bg-emerald-700 text-white",
                    status.tone === "primary" && "bg-primary text-primary-foreground",
                    status.tone === "muted" && "bg-card text-muted-foreground",
                  )}
                >
                  {status.text}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-4">
          <h3 className="line-clamp-1 font-semibold tracking-tight text-foreground group-hover:text-primary">
            {event.name}
          </h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {[when, event.location_name].filter(Boolean).join(" · ")}
          </p>
          {event.organizer_name ? (
            <p className="mt-auto line-clamp-1 pt-1 text-xs text-muted-foreground">
              By {event.organizer_name}
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}
