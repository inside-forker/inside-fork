"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBookingRealtimeStatus } from "@/hooks/useBookingRealtimeStatus";
import { BookingPassList } from "@/components/events/BookingPassList";

export function BookingPassReturnContent() {
  const params = useSearchParams();
  const bookingId = params.get("booking_id");
  const idNum = bookingId ? parseInt(bookingId, 10) : null;
  const { paymentStatus, passes, bookingReference } =
    useBookingRealtimeStatus(idNum);

  const terminal = ["paid", "failed", "refunded", "expired"].includes(
    (paymentStatus || "").toLowerCase(),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Booking</span>
            <span className="font-mono text-xs text-foreground">
              {bookingReference || idNum}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                paymentStatus === "paid"
                  ? "bg-emerald-700/10 text-emerald-700"
                  : paymentStatus === "failed"
                    ? "bg-red-600/10 text-red-700"
                    : paymentStatus === "expired"
                      ? "bg-amber-500/10 text-amber-800"
                      : "bg-muted text-muted-foreground animate-pulse"
              }`}
            >
              {paymentStatus || "processing"}
            </span>
          </div>
          {terminal && paymentStatus === "paid" && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-relaxed">
              <p className="text-emerald-700">
                Payment confirmed. Your passes are below.
              </p>
              <Link
                href="/dashboard/bookings"
                className="text-primary hover:text-primary/80 font-medium tracking-wide"
              >
                View all bookings
              </Link>
            </div>
          )}
        </div>
      </div>
      {passes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            Passes
          </h3>
          <BookingPassList passes={passes} />
        </div>
      )}
      {terminal && passes.length === 0 && paymentStatus === "paid" && (
        <div className="text-xs text-muted-foreground">Issuing passes…</div>
      )}
      {!terminal && (
        <div className="text-xs text-muted-foreground">
          Waiting for provider confirmation…
        </div>
      )}
    </div>
  );
}
