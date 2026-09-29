"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Ticket,
  QrCode,
  Calendar,
  MapPin,
  ChevronLeft,
  Download,
  Share2,
  Printer,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { PublicPass } from "@/types/ticketing.types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { TicketPdfEvent } from "@/lib/ticketing/download-ticket-pdf";

async function saveTicketsPdf(
  event: TicketPdfEvent,
  passes: PublicPass[],
  orderPasses: PublicPass[],
  filename: string,
) {
  const { downloadTicketsPdf } = await import(
    "@/lib/ticketing/download-ticket-pdf"
  );
  await downloadTicketsPdf({ event, passes, orderPasses, filename });
}

interface FullScreenPassesProps {
  isOpen: boolean;
  onClose: () => void;
  passes: PublicPass[];
  bookingReference: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
  eventEndTime?: string;
  address?: string;
  organizer?: string;
}

function safeDateString(val?: string | null, formatStr = "EEE, MMM d, yyyy"): string {
  if (!val) return "";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return format(d, formatStr);
  } catch {
    return String(val);
  }
}

// Individual Pass Card Component
function PassCard({
  pass,
  index,
  onViewQR,
  onDownloadPdf,
}: {
  pass: PublicPass;
  index: number;
  onViewQR: () => void;
  onDownloadPdf: () => void;
}) {
  const statusLabel = (pass.status ?? "")
    .toString()
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
  const isCheckedIn = statusLabel === "checked in";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 backdrop-blur overflow-hidden shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Pass #{index + 1}
          </span>
          {pass.gate_label && (
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30">
              Enter: {pass.gate_label}
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

      <button
        type="button"
        onClick={pass.code ? onViewQR : undefined}
        disabled={!pass.code}
        className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
      >
        {pass.code ? (
          <div className="relative shrink-0 p-2 bg-white rounded-lg shadow-md">
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
          <p className="font-mono text-sm font-semibold text-foreground">
            {pass.code || "Payment required"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {pass.code
              ? pass.gate_label
                ? `Enter at ${pass.gate_label} · Tap to view ticket`
                : "Tap to view full ticket & download PDF →"
              : "Complete payment to view ticket code"}
          </p>
        </div>
      </button>

      {pass.code && (
        <div className="px-4 pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDownloadPdf}
            className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF ticket
          </Button>
        </div>
      )}

      {pass.issued_at && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-4 pb-3 pt-2 border-t border-border/30">
          <span>Issued {safeDateString(pass.issued_at, "dd MMM yyyy")}</span>
          <span className="font-mono">
            {safeDateString(pass.issued_at, "h:mm a")}
          </span>
        </div>
      )}
    </motion.div>
  );
}

import { OfficialTicketCard } from "./OfficialTicketCard";

// Full Ticket View Component (inline, replaces QR view)
function FullTicketView({
  pass,
  eventName,
  eventDate,
  eventTime,
  venueName,
  pdfEvent,
  orderPasses,
  onBack,
}: {
  pass: PublicPass;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
  pdfEvent: TicketPdfEvent;
  orderPasses: PublicPass[];
  onBack: () => void;
}) {
  const ticketRef = React.useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = React.useState(false);

  const passesList = orderPasses && orderPasses.length > 0 ? orderPasses : [pass];
  const ticketIndex = passesList.findIndex((p) => p.id === pass.id) + 1 || 1;
  const ticketTotal = Math.max(passesList.length, 1);

  const handleDownload = async () => {
    if (!pass.code) {
      alert("This pass doesn't have a ticket code yet.");
      return;
    }

    setDownloading(true);
    try {
      await saveTicketsPdf(
        pdfEvent,
        [pass],
        orderPasses,
        `ticket-${pass.code || pass.id}`,
      );
    } catch (error) {
      console.error("Error saving ticket PDF:", error);
      alert("Couldn't create the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    await handleDownload();
  };

  const handleShare = async () => {
    if (!ticketRef.current) return;
    const ticketElement = ticketRef.current.querySelector(".official-ticket-card") as HTMLElement;
    if (!ticketElement) return;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(ticketElement, {
          scale: 2.5,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const file = new File([blob], `ticket-${pass.code || pass.id}.png`, { type: "image/png" });

          const shareData: ShareData = {
            title: `Ticket: ${pass.code || `#${pass.id}`}`,
            text: eventName ? `My ticket for ${eventName}` : `Ticket: #${pass.id}`,
          };

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            shareData.files = [file];
          }

          await navigator.share(shareData);
        }, "image/png");
      } catch (error) {
        console.error("Error sharing ticket:", error);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col h-full"
    >
      {/* Back Button Header */}
      <div className="flex-shrink-0 p-4 border-b border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to passes
        </Button>
      </div>

      {/* Ticket Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
        <div ref={ticketRef} className="w-full flex justify-center">
          <OfficialTicketCard
            pass={pass}
            eventName={eventName || pdfEvent.name || "Event"}
            eventDate={eventDate || pdfEvent.startTime}
            eventTime={eventTime}
            eventEndTime={pdfEvent.endTime}
            venueName={venueName || pdfEvent.venueName}
            address={pdfEvent.address}
            organizer={pdfEvent.organizer}
            ticketType={pass.ticket_type_name || pdfEvent.ticketType}
            bookingReference={pdfEvent.bookingReference}
            index={ticketIndex}
            total={ticketTotal}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 p-4 border-t border-border/30 bg-background/50 backdrop-blur-sm">
        <div className="flex gap-3 max-w-xl mx-auto">
          <Button
            size="sm"
            className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/25"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="w-4 h-4" />
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2 border-border/60"
            onClick={handlePrint}
            disabled={downloading}
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-border/60"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          )}
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-3">
          This ticket is non-transferable. Present a valid ID at check-in.
        </p>
      </div>
    </motion.div>
  );
}

export function FullScreenPasses({
  isOpen,
  onClose,
  passes,
  bookingReference,
  eventName,
  eventDate,
  eventTime,
  venueName,
  eventEndTime,
  address,
  organizer,
}: FullScreenPassesProps) {
  const [selectedPass, setSelectedPass] = useState<PublicPass | null>(null);
  const [mounted, setMounted] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const pdfEvent: TicketPdfEvent = {
    name: eventName || "Event",
    startTime: eventDate || null,
    endTime: eventEndTime ?? null,
    venueName: venueName ?? null,
    address: address ?? null,
    organizer: organizer ?? null,
    bookingReference,
  };
  const issuedCount = passes.filter((p) => p.code).length;

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      await saveTicketsPdf(pdfEvent, passes, passes, `tickets-${bookingReference}`);
    } catch (error) {
      console.error("Error saving tickets PDF:", error);
      alert("Couldn't create the PDF. Please try again.");
    } finally {
      setDownloadingAll(false);
    }
  };

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setSelectedPass(null); // Reset selection when closing
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Don't render on server or before mount
  if (!mounted) return null;

  // Use portal to render at document body level to escape stacking context
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col bg-background overflow-hidden"
        >
          {/* Header - Matches FullScreenNav/FullScreenMenu */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Ticket className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Your Passes
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Booking #{bookingReference}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-primary/10 h-10 w-10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedPass ? (
                /* Full Ticket View - Inline, not modal */
                <FullTicketView
                  key="ticket-view"
                  pass={selectedPass}
                  eventName={eventName}
                  eventDate={eventDate}
                  eventTime={eventTime}
                  venueName={venueName}
                  pdfEvent={pdfEvent}
                  orderPasses={passes}
                  onBack={() => setSelectedPass(null)}
                />
              ) : (
                /* Passes List */
                <motion.div
                  key="passes-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  {/* Event Info */}
                  {(eventName || eventDate || venueName) && (
                    <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border/20 bg-background/30">
                      <div className="space-y-2">
                        {eventName && (
                          <h3 className="text-base sm:text-lg font-semibold text-foreground">
                            {eventName}
                          </h3>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                          {eventDate && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {eventDate}
                            </span>
                          )}
                          {venueName && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {venueName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passes Count Badge */}
                  <div className="flex-shrink-0 px-4 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 w-fit">
                      <QrCode className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {(passes || []).length}{" "}
                        {(passes || []).length === 1 ? "Pass" : "Passes"}
                      </span>
                    </div>
                    {issuedCount > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleDownloadAll}
                        disabled={downloadingAll}
                        className="gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {downloadingAll ? "Preparing PDF…" : "Download all (PDF)"}
                      </Button>
                    )}
                  </div>

                  {/* Scrollable Passes List */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
                    {(passes || []).length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {(passes || []).map((pass, index) => (
                          <PassCard
                            key={pass.id}
                            pass={pass}
                            index={index}
                            onViewQR={() => setSelectedPass(pass)}
                            onDownloadPdf={() => setSelectedPass(pass)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center p-4">
                        <div className="mb-4 rounded-2xl bg-muted/50 p-4 border border-border/30">
                          <Ticket className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">
                          No Passes Available
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs">
                          Your ticket passes will appear here once your payment
                          is confirmed.
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Safe Area for Mobile */}
          <div className="flex-shrink-0 h-6 sm:h-8" />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
