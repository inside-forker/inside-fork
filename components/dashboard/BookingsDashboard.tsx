"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format, isAfter } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ExternalLink, MapPin, Ticket, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PremiumHeading, PremiumText } from "@/components/brand/Typography";
import { BookingPassList } from "@/components/events/BookingPassList";
import { FullScreenPasses } from "@/components/events/FullScreenPasses";
import { PublicPass } from "@/types/ticketing.types";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

interface BookingEventSummary {
  id: number;
  name: string;
  slug: string;
  start_time: string;
  end_time: string | null;
  venue_name?: string | null;
  address?: string | null;
  organizer_name?: string | null;
  cover_image?: string | null;
}

export interface DashboardBooking {
  id: number;
  booking_reference: string | null;
  payment_status: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  passes: PublicPass[];
  event: BookingEventSummary | null;
}

interface Props {
  bookings: DashboardBooking[];
}

type FilterKey = "all" | "upcoming" | "awaiting" | "past";

interface BookingSummary {
  total: number;
  awaiting: number;
  upcoming: number;
  past: number;
  passes: number;
  totalPaid: number;
  nextBooking: DashboardBooking | null;
  nextStart: Date | null;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "awaiting", label: "Awaiting Payment" },
  { key: "past", label: "Past" },
];

function getStatusBadge(status: string | null) {
  const normalized = (status || "").toLowerCase();
  switch (normalized) {
    case "paid":
      return {
        label: "Paid",
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40",
      };
    case "failed":
      return {
        label: "Failed",
        className: "bg-red-500/10 text-red-700 border-red-500/20 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40",
      };
    case "refunded":
      return {
        label: "Refunded",
        className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
      };
    case "expired":
      return {
        label: "Expired",
        className: "bg-stone-500/10 text-stone-700 border-stone-500/20 dark:bg-stone-500/20 dark:text-stone-300 dark:border-stone-500/40",
      };
    case "awaiting_payment":
    case "pending":
      return {
        label: "Awaiting",
        className: "bg-primary/10 text-primary-700 border-primary/20 dark:text-primary-200 dark:border-primary/40",
      };
    default:
      return {
        label: "Processing",
        className: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-500/30",
      };
  }
}

function getAmountLabel(amount: number) {
  if (amount === 0) return "FREE";
  return `PKR ${amount.toLocaleString()}`;
}

export function BookingsDashboard({ bookings }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<DashboardBooking | null>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Lock body scroll when fullscreen passes is open on mobile
  useEffect(() => {
    if (selected && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected, isMobile]);

  const summary = useMemo<BookingSummary>(() => {
    const now = new Date();
    let awaiting = 0;
    let upcoming = 0;
    let passes = 0;
    let totalPaid = 0;
    let nextBooking: DashboardBooking | null = null;
    let nextStart: Date | null = null;

    bookings.forEach((booking) => {
      const paymentStatus = (booking.payment_status || "").toLowerCase();
      const isAwaiting =
        paymentStatus === "awaiting_payment" || paymentStatus === "pending";
      if (isAwaiting) awaiting += 1;
      if (paymentStatus === "paid") totalPaid += booking.total_amount;
      passes += booking.passes.length;

      const eventStart = booking.event?.start_time
        ? new Date(booking.event.start_time)
        : null;
      if (eventStart && isAfter(eventStart, now)) {
        upcoming += 1;
        if (!nextStart || eventStart < nextStart) {
          nextStart = eventStart;
          nextBooking = booking;
        }
      }
    });

    const past = bookings.length - upcoming;

    return {
      total: bookings.length,
      awaiting,
      upcoming,
      past,
      passes,
      totalPaid,
      nextBooking,
      nextStart,
    };
  }, [bookings]);

  const nextEvent = summary.nextBooking?.event ?? null;
  const nextStart = summary.nextStart;

  const filteredBookings = useMemo(() => {
    if (filter === "all") return bookings;
    const now = new Date();
    return bookings.filter((booking) => {
      const isAwaiting =
        (booking.payment_status || "").toLowerCase() === "awaiting_payment" ||
        (booking.payment_status || "").toLowerCase() === "pending";
      if (filter === "awaiting") {
        return isAwaiting;
      }
      const eventStart = booking.event?.start_time
        ? new Date(booking.event.start_time)
        : null;
      if (!eventStart) return filter === "past";
      const isUpcoming = isAfter(eventStart, now);
      return filter === "upcoming" ? isUpcoming && !isAwaiting : !isUpcoming;
    });
  }, [bookings, filter]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (!bookings.length) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/70 backdrop-blur-xl p-8 text-center shadow-premium-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--primary-rgb),0.12),transparent_60%)]" />
        <div className="relative z-10 space-y-3">
          <PremiumText className="text-lg font-semibold">
            You haven’t made any bookings yet
          </PremiumText>
          <PremiumText variant="caption" muted>
            Discover curated events around Karachi and secure your spot with a
            premium, cashless checkout experience.
          </PremiumText>
          <div className="pt-2">
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link href="/events">
                Discover events
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-border/60 bg-white/60 dark:bg-transparent bg-gradient-to-br from-primary/10 via-white/50 to-white dark:from-primary/15 dark:via-background dark:to-background backdrop-blur-2xl shadow-xl shadow-primary/5 dark:shadow-premium-lg">
        <div className="absolute -top-32 -right-28 h-64 w-64 rounded-full bg-primary/10 dark:bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-8 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-10">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/20 border border-primary/30">
                <Ticket className="h-6 w-6 text-primary" />
              </div>
              <PremiumHeading
                level={2}
                className="text-2xl sm:text-3xl md:text-4xl font-bold"
              >
                Your premium bookings
              </PremiumHeading>
            </div>
            <PremiumText muted>
              Track upcoming events, access your digital passes instantly, and
              manage every reservation.
            </PremiumText>
            {nextEvent && nextStart && (
              <div className="inline-flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary-foreground/90 shadow-primary/20">
                <Calendar className="h-4 w-4" />
                <span>
                  Next: {nextEvent.name} on{" "}
                  {format(nextStart, "dd MMM, h:mm a")}
                </span>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="text-xs text-primary-foreground"
                >
                  <Link
                    href={
                      nextEvent.slug ? `/events/${nextEvent.slug}` : "/events"
                    }
                  >
                    View details <ExternalLink className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            {[
              {
                label: "Total bookings",
                value: summary.total,
                footnote: `${summary.past} past`,
              },
              {
                label: "Upcoming",
                value: summary.upcoming,
                footnote: summary.awaiting
                  ? `${summary.awaiting} awaiting payment`
                  : "All confirmed",
              },
              {
                label: "Passes secured",
                value: summary.passes,
                footnote: summary.totalPaid
                  ? `PKR ${summary.totalPaid.toLocaleString()} spent`
                  : "",
              },
              {
                label: "Awaiting",
                value: summary.awaiting,
                footnote: summary.awaiting
                  ? "Complete checkout to lock your seats"
                  : "All sessions settled",
              },
            ].map((card, idx) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.05, duration: 0.4 }}
                className="rounded-2xl border border-border/40 bg-background/80 px-4 py-3 text-sm shadow-sm backdrop-blur"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-2xl font-semibold text-foreground">
                  {card.value}
                </p>
                {card.footnote && (
                  <p className="text-[11px] text-muted-foreground/80">
                    {card.footnote}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap scrollbar-hide touch-pan-x">
        {FILTERS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? "default" : "ghost"}
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full px-5 whitespace-nowrap flex-shrink-0 transition-all",
              filter === item.key
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                : "hover:bg-primary/5 hover:text-primary bg-background/50 backdrop-blur border border-transparent hover:border-primary/10"
            )}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-5">
        {paginatedBookings.map((booking, index) => {
          const badge = getStatusBadge(booking.payment_status);
          const eventStart = booking.event?.start_time
            ? format(
              new Date(booking.event.start_time),
              "EEE, dd MMM yyyy · h:mm a"
            )
            : "—";
          const eventEnd = booking.event?.end_time
            ? format(new Date(booking.event.end_time), "h:mm a")
            : null;
          return (
            <motion.article
              key={booking.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.05,
                duration: 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-border/60 bg-white dark:bg-background/80 backdrop-blur-xl shadow-lg dark:shadow-premium-lg"
            >
              <div className="absolute inset-0 opacity-40 dark:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary-rgb),0.16),transparent_58%)]" />
              <div className="relative z-10 p-5 sm:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.35em] text-primary/70 font-medium">
                      <span>Booking</span>
                      <span className="opacity-60">
                        #{booking.booking_reference ?? booking.id}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-2xl font-semibold font-display text-foreground">
                        {booking.event?.name ?? "Private experience"}
                      </h3>
                      <Badge className={cn("border", badge.className)}>
                        {badge.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {eventStart}
                        {eventEnd && (
                          <span className="opacity-60">– {eventEnd}</span>
                        )}
                      </span>
                      {booking.event?.venue_name && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {booking.event.venue_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 text-sm">
                    <div className="rounded-2xl border border-border/50 bg-background/60 px-4 py-2">
                      <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                        Total paid
                      </span>
                      <div className="text-lg font-semibold text-foreground">
                        {getAmountLabel(booking.total_amount)}
                      </div>
                    </div>
                    <PremiumText variant="caption" muted className="text-xs">
                      Booked on{" "}
                      {format(
                        new Date(booking.created_at),
                        "dd MMM yyyy, h:mm a"
                      )}
                    </PremiumText>
                    <div className="flex flex-wrap gap-2">
                      {/* Show Retry Payment button for awaiting_payment/pending status */}
                      {(booking.payment_status === "awaiting_payment" ||
                        booking.payment_status === "pending") && (
                          <Button
                            size="sm"
                            asChild
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Link
                              href={`/checkout/payment?bookingId=${booking.id}`}
                            >
                              Retry Payment
                            </Link>
                          </Button>
                        )}
                      {booking.event?.slug && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="flex-1 sm:flex-none backdrop-blur border-primary/20 hover:bg-primary/5 hover:text-primary"
                        >
                          <Link href={`/events/${booking.event.slug}`}>
                            View event
                            <ExternalLink className="ml-2 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      {booking.payment_status === "paid" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none backdrop-blur border-primary/20 hover:bg-primary/5 hover:text-primary"
                          onClick={() => setSelected(booking)}
                        >
                          <Ticket className="mr-2 h-3.5 w-3.5" />
                          View passes
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {booking.passes.length > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary-100">
                    <Ticket className="h-4 w-4 flex-shrink-0" />
                    <span className="text-foreground/80 font-medium">
                      {booking.passes.length} digital pass
                      {booking.passes.length === 1 ? "" : "es"} secured for this
                      booking.
                    </span>
                  </div>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            disabled={currentPage === 1}
            className="h-9 w-9 rounded-full border-black/10 dark:border-border/60 bg-white dark:bg-background/50 backdrop-blur shadow-sm hover:bg-gray-50 dark:hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[5rem] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setCurrentPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            disabled={currentPage === totalPages}
            className="h-9 w-9 rounded-full border-black/10 dark:border-border/60 bg-white dark:bg-background/50 backdrop-blur shadow-sm hover:bg-gray-50 dark:hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Mobile: FullScreen Passes Drawer */}
      {isMobile && selected && (
        <FullScreenPasses
          isOpen={true}
          onClose={() => setSelected(null)}
          passes={selected.passes}
          bookingReference={selected.booking_reference ?? String(selected.id)}
          eventName={selected.event?.name}
          eventDate={selected.event?.start_time}
          eventTime={selected.event?.start_time}
          venueName={selected.event?.venue_name ?? undefined}
          eventEndTime={selected.event?.end_time ?? undefined}
          address={selected.event?.address ?? undefined}
          organizer={selected.event?.organizer_name ?? undefined}
        />
      )}

      {/* Desktop: Dialog Modal */}
      <AnimatePresence>
        {selected && !isMobile && (
          <Dialog open onOpenChange={() => setSelected(null)}>
            <DialogContent className="max-w-3xl border border-border/60 bg-background/95 backdrop-blur-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold font-display">
                  Booking {selected.booking_reference ?? selected.id}
                </DialogTitle>
                <DialogDescription className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
                  Digital access passes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {selected.event?.start_time
                      ? format(
                        new Date(selected.event.start_time),
                        "EEE, dd MMM yyyy · h:mm a"
                      )
                      : "Event details unavailable"}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Booked on{" "}
                    {format(
                      new Date(selected.created_at),
                      "dd MMM yyyy, h:mm a"
                    )}
                  </span>
                </div>
                <BookingPassList
                  passes={selected.passes}
                  variant="dashboard"
                  eventName={selected.event?.name}
                  eventDate={selected.event?.start_time}
                  venueName={selected.event?.venue_name ?? undefined}
                  eventEndTime={selected.event?.end_time ?? undefined}
                  address={selected.event?.address ?? undefined}
                  organizer={selected.event?.organizer_name ?? undefined}
                  bookingReference={selected.booking_reference ?? undefined}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
