"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";
import { PublicPass } from "@/types/ticketing.types";

import { cn } from "@/lib/utils";
import { PrintableTicket } from "./PrintableTicket";

interface Props {
  passes: PublicPass[];
  variant?: "default" | "dashboard";
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
  ticketType?: string;
}

// Ticket card component with QR code
function TicketCard({
  pass,
  index,
  variant,
  eventName: _eventName,
  onViewQR,
}: {
  pass: PublicPass;
  index: number;
  variant: "default" | "dashboard";
  eventName?: string;
  onViewQR: () => void;
}) {
  const statusLabel = (pass.status ?? "")
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();

  const isCheckedIn = statusLabel === "checked in";

  const itemClassName =
    variant === "dashboard"
      ? "relative rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur overflow-hidden shadow-lg shadow-primary/5 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
      : "relative rounded-xl border border-neutral-700/40 bg-neutral-800/90 overflow-hidden";

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={itemClassName}
    >
      {/* Ticket Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3",
          variant === "dashboard"
            ? "bg-gradient-to-r from-primary/10 to-transparent border-b border-border/40"
            : "bg-neutral-700/50 border-b border-neutral-600/40"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-bold uppercase tracking-[0.2em]",
              variant === "dashboard" ? "text-primary" : "text-white/80"
            )}
          >
            Pass #{index + 1}
          </span>
          {pass.gate_label && (
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider",
                variant === "dashboard"
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-white/10 text-white border border-white/20"
              )}
            >
              🚪 {pass.gate_label}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider",
            isCheckedIn
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-primary/20 text-primary border border-primary/30"
          )}
        >
          {isCheckedIn && <CheckCircle2 className="w-3 h-3" />}
          {statusLabel || "issued"}
        </div>
      </div>

      {/* Ticket Body */}
      <div className="p-4 space-y-4">
        {/* QR Code Preview (Thumbnail) */}
        <button
          onClick={pass.code ? onViewQR : undefined}
          disabled={!pass.code}
          className="group w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-border/30 hover:border-primary/40 transition-all cursor-pointer"
        >
          {pass.code ? (
            <div className="relative shrink-0 p-2 bg-white rounded-lg">
              <QRCodeSVG
                value={pass.code}
                size={56}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            </div>
          ) : (
            <div className="relative shrink-0 p-2 bg-muted rounded-lg w-[72px] h-[72px] flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 text-left">
            <p
              className={cn(
                "font-mono text-sm font-semibold",
                variant === "dashboard" ? "text-foreground" : "text-white"
              )}
            >
              {pass.code || "Payment required"}
            </p>
            <p
              className={cn(
                "text-xs mt-1",
                variant === "dashboard"
                  ? "text-muted-foreground"
                  : "text-white/50"
              )}
            >
              {pass.code ? "Tap to view full QR code" : "Complete payment to view ticket code"}
            </p>
          </div>
          <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </button>

        {/* Ticket Info */}
        {variant === "dashboard" && pass.issued_at && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30">
            <span>Issued {new Date(pass.issued_at).toLocaleDateString()}</span>
            <span className="font-mono">
              {new Date(pass.issued_at).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Decorative perforation line */}
      <div className="absolute left-0 right-0 top-14 flex items-center pointer-events-none">
        <div className="w-2 h-4 bg-background rounded-r-full -ml-1" />
        <div className="flex-1 border-t-2 border-dashed border-border/30" />
        <div className="w-2 h-4 bg-background rounded-l-full -mr-1" />
      </div>
    </motion.li>
  );
}



export function BookingPassList({
  passes,
  variant = "default",
  eventName,
  eventDate,
  eventTime,
  venueName,
  ticketType,
}: Props) {
  const [selectedPass, setSelectedPass] = React.useState<PublicPass | null>(
    null
  );

  if (!passes.length) return null;

  const listClassName =
    variant === "dashboard"
      ? "grid gap-4 md:grid-cols-2"
      : "grid gap-3 sm:grid-cols-2 md:grid-cols-3";

  const headingClassName =
    variant === "dashboard"
      ? "text-sm font-semibold tracking-[0.3em] uppercase text-muted-foreground"
      : "text-sm font-medium tracking-wide text-white/70";

  return (
    <>
      <div className={variant === "dashboard" ? "space-y-4" : "space-y-3 mt-4"}>
        <h4 className={headingClassName}>Your Tickets</h4>
        <ul className={listClassName}>
          {passes.map((p, index) => (
            <TicketCard
              key={p.id}
              pass={p}
              index={index}
              variant={variant}
              eventName={eventName}
              onViewQR={() => setSelectedPass(p)}
            />
          ))}
        </ul>
      </div>

      {/* Printable Ticket Modal (Direct View) */}
      {selectedPass && (
        <PrintableTicket
          pass={selectedPass}
          eventName={eventName || "Event"}
          eventDate={eventDate || new Date().toISOString()}
          eventTime={eventTime}
          venueName={venueName}
          ticketType={ticketType}
          onClose={() => setSelectedPass(null)}
        />
      )}
    </>
  );
}
