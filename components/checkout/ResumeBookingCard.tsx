"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ResumableBookingDTO } from "@/types/checkout-resume.types";

/**
 * The "you have an unfinished payment" prompt, shown before the cart so the
 * user can pick up where they left off instead of re-selecting every ticket.
 *
 * Every amount rendered here comes from the server. Nothing is recomputed from
 * a local fee config: `bookings.total_amount` was frozen when the booking was
 * created and is exactly what the gateway will charge, so a locally-derived
 * total would show the user a number they are not charged.
 */

function formatPkr(value: number): string {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

function formatEventDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-PK", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** mm:ss, counting down locally from the server's `seconds_remaining`. */
function useCountdown(initialSeconds: number): number {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  return seconds;
}

export function ResumeBookingCard({
  booking,
  onResume,
  onDismiss,
  dismissLabel = "Start a new cart",
  isResuming = false,
  error = null,
}: {
  booking: ResumableBookingDTO;
  onResume: () => void;
  onDismiss: () => void;
  dismissLabel?: string;
  isResuming?: boolean;
  error?: string | null;
}) {
  const remaining = useCountdown(booking.seconds_remaining);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const unavailable = booking.availability !== "ok";
  const lapsed = remaining <= 0;
  const canResume = !unavailable && !lapsed && !isResuming;

  const eventWhen = formatEventDate(booking.event.start_time);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg p-0 sm:p-4"
      >
        <Card className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">

          <CardContent className="px-5 pb-6 pt-8 sm:px-8 sm:pt-10 sm:pb-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-amber-700" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Finish your booking?
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[90%] mx-auto">
                  Your tickets are still held. Pick up where you left off, or start
                  over with a new cart.
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted p-4 sm:p-5">
              <div className="relative z-10 space-y-4">
                {/* Event */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-base sm:text-lg leading-snug text-foreground">
                    {booking.event.name}
                  </h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {eventWhen && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {eventWhen}
                      </span>
                    )}
                    {booking.event.location_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {booking.event.location_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ticket lines */}
                <div className="space-y-2 border-t border-border/50 pt-3">
                  {booking.items.map((item) => (
                    <div
                      key={item.ticket_type_id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <Ticket className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          <span className="font-semibold">{item.quantity}×</span>{" "}
                          {item.ticket_name}
                        </span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground">
                        {formatPkr(item.line_total)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Amounts - server-supplied, never recomputed */}
                <div className="space-y-1.5 border-t border-border/50 pt-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatPkr(booking.subtotal)}</span>
                  </div>
                  {booking.fees > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fees</span>
                      <span className="tabular-nums">{formatPkr(booking.fees)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 text-base font-bold">
                    <span>Total</span>
                    <span className="tabular-nums text-primary">
                      {formatPkr(booking.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Footer: countdown + reference */}
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <div
                    className={`flex items-center gap-2 text-xs font-medium ${
                      lapsed
                        ? "text-muted-foreground"
                        : "text-amber-600 dark:text-amber-500"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {lapsed
                      ? "Hold expired"
                      : `Held for ${mins}:${String(secs).padStart(2, "0")}`}
                  </div>
                  {booking.booking_reference && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {booking.booking_reference}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(unavailable || lapsed || error) && (
              <p className="text-center text-sm text-destructive">
                {error ??
                  (booking.availability === "sold_out"
                    ? "These tickets are no longer available."
                    : booking.availability === "sale_closed"
                      ? "Ticket sales for this event have closed."
                      : "This booking has expired. Please pick your tickets again.")}
              </p>
            )}

            {/* Actions - equal weight, the user chooses */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                disabled={!canResume}
                className="flex-1 h-11 rounded-xl text-base bg-primary hover:bg-primary/90 text-primary-foreground active:opacity-80 disabled:opacity-50"
                onClick={onResume}
              >
                {isResuming ? "Resuming..." : "Resume Payment"}
                {!isResuming && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 text-base"
                onClick={onDismiss}
              >
                {dismissLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
