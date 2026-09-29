"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPass } from "@/types/ticketing.types";
import { OfficialTicketCard } from "./OfficialTicketCard";

interface PrintableTicketProps {
  pass: PublicPass;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  venueName?: string;
  ticketType?: string;
  eventEndTime?: string;
  address?: string;
  organizer?: string;
  bookingReference?: string;
  /** Every pass in the booking, so the PDF can number this one "n of N". */
  orderPasses?: PublicPass[];
  /** When true, trigger a PDF download once the ticket is mounted. */
  autoDownloadPdf?: boolean;
  onClose: () => void;
}

export function PrintableTicket({
  pass,
  eventName,
  eventDate,
  eventTime,
  venueName,
  ticketType,
  eventEndTime,
  address,
  organizer,
  bookingReference,
  orderPasses,
  autoDownloadPdf = false,
  onClose,
}: PrintableTicketProps) {
  const ticketRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const autoDownloadFired = React.useRef(false);

  const passesList = orderPasses && orderPasses.length > 0 ? orderPasses : [pass];
  const ticketIndex = passesList.findIndex((p) => p.id === pass.id) + 1 || 1;
  const ticketTotal = Math.max(passesList.length, 1);

  React.useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const downloadPdf = React.useCallback(async () => {
    setDownloading(true);
    try {
      const { downloadTicketsPdf } = await import(
        "@/lib/ticketing/download-ticket-pdf"
      );
      await downloadTicketsPdf({
        event: {
          name: eventName,
          startTime: eventDate || null,
          endTime: eventEndTime ?? null,
          venueName: venueName ?? null,
          address: address ?? null,
          organizer: organizer ?? null,
          bookingReference: bookingReference ?? null,
          ticketType: ticketType ?? null,
        },
        passes: [pass],
        orderPasses: passesList,
        filename: `ticket-${pass.code || pass.id}`,
      });
    } finally {
      setDownloading(false);
    }
  }, [
    address,
    bookingReference,
    eventDate,
    eventEndTime,
    eventName,
    passesList,
    organizer,
    pass,
    ticketType,
    venueName,
  ]);

  React.useEffect(() => {
    if (!mounted || !autoDownloadPdf || autoDownloadFired.current) return;
    if (!pass.code) return;

    const timer = window.setTimeout(async () => {
      autoDownloadFired.current = true;
      try {
        await downloadPdf();
      } catch (error) {
        console.error("Error auto-downloading ticket PDF:", error);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [mounted, autoDownloadPdf, pass.code, downloadPdf]);

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      await downloadPdf();
    } catch (error) {
      console.error("Error printing ticket PDF:", error);
      alert("Couldn't prepare the ticket. Please try again.");
    }
  };

  const handleSaveTicket = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!pass.code) {
      alert("This pass doesn't have a ticket code yet.");
      return;
    }

    try {
      await downloadPdf();
    } catch (error) {
      console.error("Error saving ticket PDF:", error);
      alert("Couldn't create the PDF. Please try again.");
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

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
          const file = new File(
            [blob],
            `ticket-${pass.code || pass.id}.png`,
            { type: "image/png" }
          );

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

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onClose();
  };

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] isolate"
      style={{ pointerEvents: "auto" }}
    >
      {/* Full screen backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={handleClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Modal content container */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
        <div
          className="relative w-full max-w-3xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Card Container */}
          <div className="flex flex-col max-h-[92vh] bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary mb-0.5">
                  Inside Karachi • Official Pass
                </p>
                <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-[280px] sm:max-w-md">
                  {eventName}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ticket Content */}
            <div
              className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 flex items-center justify-center"
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              <div ref={ticketRef} className="w-full flex justify-center">
                <OfficialTicketCard
                  pass={pass}
                  eventName={eventName}
                  eventDate={eventDate}
                  eventTime={eventTime}
                  eventEndTime={eventEndTime}
                  venueName={venueName}
                  address={address}
                  organizer={organizer}
                  ticketType={ticketType}
                  bookingReference={bookingReference}
                  index={ticketIndex}
                  total={ticketTotal}
                />
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div
              className="flex-none flex items-center justify-center gap-3 px-6 py-4 border-t border-white/10 bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                onClick={handleSaveTicket}
                disabled={downloading}
                className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/25"
              >
                <Download className="w-4 h-4" />
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={downloading}
                className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

