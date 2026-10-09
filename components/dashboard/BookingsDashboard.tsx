"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format, isAfter } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Ticket, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingPassList } from "@/components/events/BookingPassList";
import { BookingPdfTicketList } from "@/components/events/BookingPdfTicketList";
import { PublicPass, PublicPdfTicket } from "@/types/ticketing.types";

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
  pdfTickets: PublicPdfTicket[];
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

function safeFormatDate(
  val?: string | Date | null,
  pattern = "EEE, dd MMM yyyy · h:mm a",
  fallback = "—"
): string {
  if (!val) return fallback;
  try {
    const d = typeof val === "string" ? new Date(val) : val;
    if (isNaN(d.getTime())) return fallback;
    return format(d, pattern);
  } catch {
    return fallback;
  }
}

const TICKET_STUB_WIDTH = 124;
const NOTCH_R = 8;
// Half-circle cutouts at the top and bottom of the perforation, like the app ticket.
// Each half of the card gets one opaque layer with a single hole, so the layers never overlap.
const NOTCH_LAYER = (y: "0" | "100%") =>
  `radial-gradient(circle ${NOTCH_R}px at calc(100% - ${TICKET_STUB_WIDTH}px) ${y}, #0000 97%, #000) 0 ${y === "0" ? "0" : "100%"} / 100% 51% no-repeat`;
const NOTCH_MASK = `${NOTCH_LAYER("0")}, ${NOTCH_LAYER("100%")}`;
const TICKET_NOTCH_STYLE = {
  mask: NOTCH_MASK,
  WebkitMask: NOTCH_MASK,
} as React.CSSProperties;

function getDarkBadgeClass(label: string) {
  switch (label) {
    case "Paid":
      return "border-emerald-400/30 bg-emerald-400/15 text-emerald-300";
    case "Refunded":
    case "Awaiting":
      return "border-amber-400/30 bg-amber-400/15 text-amber-300";
    case "Failed":
      return "border-red-400/30 bg-red-400/15 text-red-300";
    default:
      return "border-slate-400/30 bg-slate-400/15 text-slate-300";
  }
}

function DateTile({ date, highlight, onDark }: { date: Date | null; highlight?: boolean; onDark?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-xl",
        highlight ? "bg-primary text-primary-foreground" : onDark ? "bg-white/15 text-white" : "bg-muted text-foreground"
      )}
      aria-hidden
    >
      {date ? (
        <>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.08em]",
              highlight ? "text-primary-foreground/80" : onDark ? "text-white/80" : "text-primary"
            )}
          >
            {format(date, "MMM")}
          </span>
          <span className="text-xl font-bold leading-none">{format(date, "d")}</span>
        </>
      ) : (
        <Ticket className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

export function BookingsDashboard({ bookings }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<DashboardBooking | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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
      passes += booking.passes.length + (booking.pdfTickets?.length ?? 0);

      let eventStart: Date | null = null;
      if (booking.event?.start_time) {
        try {
          const d = new Date(booking.event.start_time);
          if (!isNaN(d.getTime())) eventStart = d;
        } catch {
          eventStart = null;
        }
      }

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
      let eventStart: Date | null = null;
      if (booking.event?.start_time) {
        try {
          const d = new Date(booking.event.start_time);
          if (!isNaN(d.getTime())) eventStart = d;
        } catch {
          eventStart = null;
        }
      }
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
      <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Ticket className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          No bookings yet
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Find your next night out in Karachi and get tickets in a few taps.
        </p>
        <Button asChild className="mt-5 rounded-xl font-semibold active:opacity-80">
          <Link href="/events">Discover events</Link>
        </Button>
      </div>
    );
  }

  const stats = [
    {
      label: "Upcoming",
      value: summary.upcoming,
      footnote: summary.awaiting ? `${summary.awaiting} awaiting payment` : "All confirmed",
    },
    { label: "Tickets", value: summary.passes, footnote: "Secured" },
    { label: "Past", value: summary.past, footnote: "Events attended" },
    {
      label: "Spent",
      value: summary.totalPaid ? summary.totalPaid.toLocaleString() : "0",
      footnote: "PKR, paid bookings",
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          Your tickets
        </span>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          My bookings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Track upcoming events and open your tickets in a tap.
        </p>

        {nextEvent && nextStart && (
          <Link
            href={nextEvent.slug ? `/events/${nextEvent.slug}` : "/events"}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 active:opacity-80"
          >
            <DateTile date={nextStart} highlight />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
                Up next
              </p>
              <p className="line-clamp-1 font-semibold tracking-tight text-foreground">
                {nextEvent.name}
              </p>
              <p className="line-clamp-1 text-sm text-muted-foreground">
                {safeFormatDate(nextStart, "EEE d MMM · h:mm a")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {card.footnote}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 scrollbar-hide touch-pan-x sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "flex-shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors active:opacity-80",
              filter === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {paginatedBookings.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {paginatedBookings.map((booking, index) => {
            const badge = getStatusBadge(booking.payment_status);
            const start = booking.event?.start_time
              ? new Date(booking.event.start_time)
              : null;
            const validStart = start && !isNaN(start.getTime()) ? start : null;
            const isPast = validStart ? !isAfter(validStart, new Date()) : false;
            const ticketCount =
              booking.passes.length + (booking.pdfTickets?.length ?? 0);
            const isAwaiting =
              booking.payment_status === "awaiting_payment" ||
              booking.payment_status === "pending";
            const canViewTickets = booking.payment_status === "paid" && ticketCount > 0;
            const meta = [
              safeFormatDate(booking.event?.start_time, "EEE d MMM · h:mm a", ""),
              booking.event?.venue_name,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <motion.article
                key={booking.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
                style={TICKET_NOTCH_STYLE}
                className={cn(
                  "relative flex min-h-[168px] overflow-hidden rounded-2xl bg-[#161B26] text-white",
                  isPast && "opacity-90"
                )}
              >
                {/* Main section */}
                <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
                  {booking.event?.cover_image && (
                    <div className="absolute inset-0" aria-hidden>
                      <OptimizedImage
                        src={booking.event.cover_image}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-[rgba(10,14,23,0.78)]" />
                    </div>
                  )}
                  <div className="relative space-y-1">
                    {meta && (
                      <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">
                        {safeFormatDate(booking.event?.start_time, "EEE d MMM · h:mm a", "")}
                      </p>
                    )}
                    <h3 className="line-clamp-2 font-bold leading-snug tracking-tight text-white">
                      {booking.event?.name ?? "Private experience"}
                    </h3>
                    <p className="line-clamp-1 text-sm text-white/70">
                      {booking.event?.venue_name || "Karachi"}
                    </p>
                  </div>
                  <div className="relative space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Ticket className="h-3.5 w-3.5" aria-hidden />
                      {ticketCount > 0
                        ? `${ticketCount} ticket${ticketCount === 1 ? "" : "s"}`
                        : "No tickets yet"}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/55">
                      <span className="line-clamp-1 min-w-0">
                        #{booking.booking_reference ?? booking.id}
                      </span>
                      {booking.event?.slug && (
                        <Link
                          href={`/events/${booking.event.slug}`}
                          className="flex-shrink-0 font-semibold text-white/85 underline-offset-2 hover:underline active:opacity-70"
                        >
                          View event
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Perforation */}
                <div
                  className="pointer-events-none absolute bottom-5 top-5 border-l-[1.5px] border-dashed border-white/25"
                  style={{ right: TICKET_STUB_WIDTH }}
                  aria-hidden
                />

                {/* Stub */}
                <div
                  className="flex flex-shrink-0 flex-col items-center justify-between gap-3 bg-[#121620] p-3"
                  style={{ width: TICKET_STUB_WIDTH }}
                >
                  <span
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                      getDarkBadgeClass(badge.label)
                    )}
                  >
                    {badge.label}
                  </span>
                  <div className="text-center">
                    <p className="text-[10px] text-white/55">Total</p>
                    <p className="font-bold tabular-nums">
                      {getAmountLabel(booking.total_amount)}
                    </p>
                  </div>
                  {isAwaiting ? (
                    <Button
                      asChild
                      size="sm"
                      className="w-full rounded-lg text-xs font-bold active:opacity-80"
                    >
                      <Link href={`/checkout/payment?bookingId=${booking.id}`}>
                        Retry payment
                      </Link>
                    </Button>
                  ) : canViewTickets ? (
                    <Button
                      size="sm"
                      className="w-full rounded-lg text-xs font-bold active:opacity-80"
                      onClick={() => setSelected(booking)}
                    >
                      <Ticket className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Button>
                  ) : (
                    <span className="h-8" aria-hidden />
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setCurrentPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 300, behavior: "smooth" });
            }}
            disabled={currentPage === 1}
            className="h-9 w-9 rounded-full"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5rem] text-center text-sm font-medium text-foreground">
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
            className="h-9 w-9 rounded-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Passes Modal (Responsive for both mobile and desktop) */}
      <AnimatePresence>
        {selected && (
          <Dialog open onOpenChange={() => setSelected(null)}>
            <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto border border-border/60 bg-background p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="text-xl sm:text-2xl font-semibold">
                  Booking {selected.booking_reference ?? selected.id}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                  Your tickets
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="rounded-2xl border border-border/50 bg-background/70 px-4 py-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {safeFormatDate(
                      selected.event?.start_time,
                      "EEE, dd MMM yyyy · h:mm a",
                      "Event details unavailable"
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Booked on{" "}
                    {safeFormatDate(
                      selected.created_at,
                      "dd MMM yyyy, h:mm a"
                    )}
                  </span>
                </div>
                {(selected.pdfTickets?.length ?? 0) > 0 && (
                  <BookingPdfTicketList
                    tickets={selected.pdfTickets}
                    variant="dashboard"
                  />
                )}
                {selected.passes.length > 0 && (
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
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
