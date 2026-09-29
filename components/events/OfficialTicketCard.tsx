"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { PublicPass } from "@/types/ticketing.types";
import { Lock } from "lucide-react";
import { format } from "date-fns";

const TIME_ZONE = "Asia/Karachi";

function formatPart(iso: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString("en-GB", { ...options, timeZone: TIME_ZONE });
  } catch {
    return date.toLocaleString("en-GB", options);
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatPart(iso, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatPart(iso, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/\s?([ap])\.?m\.?$/i, (_, p: string) => ` ${p.toUpperCase()}M`);
}

export interface OfficialTicketCardProps {
  pass: PublicPass;
  eventName: string;
  eventDate?: string | null;
  eventTime?: string | null;
  eventEndTime?: string | null;
  venueName?: string | null;
  address?: string | null;
  organizer?: string | null;
  ticketType?: string | null;
  bookingReference?: string | null;
  index?: number;
  total?: number;
  className?: string;
}

export const OfficialTicketCard = React.forwardRef<
  HTMLDivElement,
  OfficialTicketCardProps
>(function OfficialTicketCard(
  {
    pass,
    eventName,
    eventDate,
    eventTime,
    eventEndTime,
    venueName,
    address,
    organizer,
    ticketType,
    bookingReference,
    index = 1,
    total = 1,
    className = "",
  },
  ref,
) {
  const startIso = eventDate || eventTime || null;
  const endIso = eventEndTime || null;

  const startFormattedTime = React.useMemo(() => {
    if (eventTime) return formatTime(eventTime);
    if (eventDate) return formatTime(eventDate);
    return "";
  }, [eventTime, eventDate]);

  const endFormattedTime = React.useMemo(() => {
    if (endIso) return formatTime(endIso);
    return "";
  }, [endIso]);

  const sameDay =
    startIso &&
    endIso &&
    formatDate(startIso) === formatDate(endIso);

  const displayTime =
    startFormattedTime && endFormattedTime && sameDay
      ? `${startFormattedTime} – ${endFormattedTime}`
      : startFormattedTime;

  const displayDate = formatDate(startIso) || (eventDate ? format(new Date(eventDate), "EEE, d MMM yyyy") : "—");
  const displayType = pass.ticket_type_name || ticketType || "General Admission";
  const displayVenue = venueName || address || "—";
  const displayAddress =
    venueName && address && address !== venueName ? address : "";
  const displayLane = pass.gate_label || null;
  const displayAttendee = pass.guest_name || "—";
  const displayCnic = pass.cnic_last4
    ? `CNIC •••••-•••••••-${pass.cnic_last4}`
    : "";

  return (
    <div
      ref={ref}
      className={`official-ticket-card w-full max-w-3xl bg-white text-zinc-900 rounded-2xl border border-zinc-200/90 shadow-xl overflow-hidden flex flex-col md:flex-row select-none ${className}`}
      style={{
        fontFamily:
          '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Left / Main Section */}
      <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col justify-between">
        {/* Header: Title + Organizer + Lane */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight leading-tight line-clamp-2">
                {eventName || "Event"}
              </h2>
              {organizer && (
                <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 truncate font-medium">
                  by {organizer}
                </p>
              )}
            </div>

            {displayLane && (
              <div className="flex-none px-3.5 py-1.5 rounded-lg border-2 border-[#F42354] bg-[#F42354]/5 text-center min-w-[90px]">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#F42354] leading-none mb-0.5">
                  Entry Lane
                </div>
                <div className="text-base sm:text-lg font-black text-[#F42354] leading-none">
                  {displayLane}
                </div>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="mt-5 pt-4 border-t border-zinc-200/80 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-4">
            {/* Date */}
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                Date
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {displayDate}
              </div>
            </div>

            {/* Time */}
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                Time
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {displayTime || "—"}
              </div>
            </div>

            {/* Ticket Type */}
            <div className="min-w-0 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                Ticket
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {displayType}
              </div>
            </div>

            {/* Venue */}
            <div className="min-w-0 col-span-2 sm:col-span-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                Venue
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {displayVenue}
              </div>
              {displayAddress && (
                <div className="text-xs text-zinc-500 truncate mt-0.5">
                  {displayAddress}
                </div>
              )}
            </div>

            {/* Attendee */}
            <div className="min-w-0 col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
                Attendee
              </div>
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {displayAttendee}
              </div>
              {displayCnic && (
                <div className="text-xs text-zinc-500 font-mono truncate mt-0.5">
                  {displayCnic}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 text-[10px] text-zinc-400">
          <span className="truncate">
            {bookingReference ? `Booking ${bookingReference} · ` : ""}
            One entry per ticket · Non-transferable · Carry a valid ID
          </span>
          <span className="flex-none font-medium text-zinc-400">
            insidekarachi.com
          </span>
        </div>
      </div>

      {/* Right / Ticket Stub */}
      <div className="w-full md:w-56 flex-none bg-zinc-50/60 border-t md:border-t-0 md:border-l border-dashed border-zinc-300 p-5 flex flex-col items-center justify-between text-center">
        {/* Logo */}
        <div className="w-full flex justify-center pt-1">
          <img
            src="/logo-black.png"
            alt="Inside Karachi"
            className="h-7 w-auto object-contain"
          />
        </div>

        {/* QR Code */}
        <div className="my-3 flex flex-col items-center">
          {pass.code ? (
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-zinc-200/80">
              <QRCodeSVG
                value={pass.code}
                size={120}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
          ) : (
            <div className="w-28 h-28 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
              <Lock className="w-8 h-8" />
            </div>
          )}

          {/* Ticket Code */}
          <div className="mt-2.5 font-mono text-sm font-black text-zinc-900 tracking-wider">
            {pass.code || "PENDING"}
          </div>

          {/* Ticket Count */}
          <div className="mt-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Ticket {index} of {total}
          </div>
        </div>

        <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold pb-1">
          Scan at Gate
        </div>
      </div>
    </div>
  );
});
