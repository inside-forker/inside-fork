"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { PublicPass } from "@/types/ticketing.types";
import { Lock } from "lucide-react";

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

function Field({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">
        {label}
      </div>
      <div className="text-sm font-semibold text-zinc-900 break-words leading-snug">
        {value || "—"}
      </div>
      {sub ? (
        <div className="text-xs text-zinc-500 mt-0.5 break-words leading-snug">
          {sub}
        </div>
      ) : null}
    </div>
  );
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
    Boolean(startIso && endIso) &&
    formatDate(startIso) === formatDate(endIso);

  const displayTime =
    startFormattedTime && endFormattedTime && sameDay
      ? `${startFormattedTime} – ${endFormattedTime}`
      : startFormattedTime;

  const displayDate = formatDate(startIso) || "—";
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
      className={`official-ticket-card w-full max-w-3xl bg-white text-zinc-900 rounded-2xl border border-zinc-200/90 shadow-xl overflow-hidden select-none ${className}`}
      style={{
        fontFamily:
          'Arial, Helvetica, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/*
        CSS grid (not flex-row + w-full stub): a stub with width:100% in a
        row flex crushes the main pane to ~0px, so DATE/TIME/TICKET paint on
        top of each other and values truncate to "F..".
      */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_13.5rem]">
        {/* Main */}
        <div className="min-w-0 p-5 sm:p-6 flex flex-col gap-4 border-b md:border-b-0 md:border-r border-dashed border-zinc-300">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 tracking-tight leading-snug">
                {eventName || "Event"}
              </h2>
              {organizer ? (
                <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 font-medium">
                  by {organizer}
                </p>
              ) : null}
            </div>

            {displayLane ? (
              <div className="shrink-0 px-3 py-1.5 rounded-lg border-2 border-[#F42354] bg-[#F42354]/5 text-center min-w-[5.5rem]">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#F42354] leading-none mb-0.5">
                  Entry Lane
                </div>
                <div className="text-base font-black text-[#F42354] leading-none">
                  {displayLane}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-3 border-t border-zinc-200/80 grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
            <Field label="Date" value={displayDate} />
            <Field label="Time" value={displayTime || "—"} />
            <Field
              label="Ticket"
              value={displayType}
              className="col-span-2 sm:col-span-1"
            />
            <Field
              label="Venue"
              value={displayVenue}
              sub={displayAddress}
              className="col-span-2"
            />
            <Field
              label="Attendee"
              value={displayAttendee}
              sub={displayCnic}
              className="col-span-2 sm:col-span-1"
            />
          </div>

          <div className="mt-auto pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-zinc-400">
            <span>
              {bookingReference ? `Booking ${bookingReference} · ` : ""}
              One entry per ticket · Non-transferable · Carry a valid ID
            </span>
            <span className="font-medium">insidekarachi.com</span>
          </div>
        </div>

        {/* Stub */}
        <div className="bg-zinc-50/70 p-5 flex flex-col items-center justify-between text-center gap-3 min-h-[14rem] md:min-h-0">
          <img
            src="/logo-black.png"
            alt="Inside Karachi"
            className="h-7 w-auto object-contain"
          />

          <div className="flex flex-col items-center">
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
              <div className="w-[120px] h-[120px] bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                <Lock className="w-8 h-8" />
              </div>
            )}

            <div className="mt-2.5 font-mono text-sm font-black text-zinc-900 tracking-wider">
              {pass.code || "PENDING"}
            </div>
            <div className="mt-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Ticket {index} of {total}
            </div>
          </div>

          <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-semibold">
            Scan at Gate
          </div>
        </div>
      </div>
    </div>
  );
});
