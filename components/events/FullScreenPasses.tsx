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

interface FullScreenPassesProps {
  isOpen: boolean;
  onClose: () => void;
  passes: PublicPass[];
  bookingReference: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
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
          <span>Issued {new Date(pass.issued_at).toLocaleDateString()}</span>
          <span className="font-mono">
            {new Date(pass.issued_at).toLocaleTimeString()}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// Full Ticket View Component (inline, replaces QR view)
function FullTicketView({
  pass,
  eventName,
  eventDate,
  eventTime,
  venueName,
  onBack,
}: {
  pass: PublicPass;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  venueName?: string;
  onBack: () => void;
}) {
  const ticketRef = React.useRef<HTMLDivElement>(null);

  const formattedDate = React.useMemo(() => {
    if (!eventDate) return "Date not specified";
    try {
      return format(new Date(eventDate), "EEEE, MMMM d, yyyy");
    } catch {
      return eventDate;
    }
  }, [eventDate]);

  const formattedTime = React.useMemo(() => {
    if (!eventTime) {
      if (!eventDate) return null;
      try {
        const date = new Date(eventDate);
        if (date.getHours() !== 0 || date.getMinutes() !== 0) {
          return format(date, "h:mm a");
        }
      } catch {
        // Ignore
      }
      return null;
    }
    try {
      return format(new Date(eventTime), "h:mm a");
    } catch {
      return eventTime;
    }
  }, [eventTime, eventDate]);

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    const ticketElement = (ticketRef.current.querySelector(".ticket") ||
      ticketRef.current.querySelector(".mobile-ticket")) as HTMLElement | null;
    if (!ticketElement) return;

    try {
      const { downloadTicketPdfFromElement } = await import(
        "@/lib/ticketing/download-ticket-pdf"
      );
      await downloadTicketPdfFromElement(
        ticketElement,
        `ticket-${pass.code || pass.id}`,
      );
    } catch (error) {
      console.error("Error saving ticket PDF:", error);
      alert("Couldn't create the PDF. Please try again.");
    }
  };

  const handlePrint = async () => {
    if (!ticketRef.current) return;
    const printContent = ticketRef.current;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the ticket.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Inside Karachi - Event Ticket</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              padding: 40px 20px;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              min-height: 100vh;
            }
            .mobile-ticket {
              max-width: 850px;
              width: 100%;
              border: 2px solid #000;
              border-radius: 20px;
              overflow: hidden;
              background: white;
            }
            .ticket-header {
              background: linear-gradient(135deg, #ff184d 0%, #c91140 100%);
              color: white;
              padding: 24px 32px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .brand-container { display: flex; flex-direction: column; }
            .brand-sub { font-size: 10px; text-transform: uppercase; letter-spacing: 3px; opacity: 0.9; margin-bottom: 2px; }
            .brand { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
            .ticket-type { background: rgba(255,255,255,0.25); padding: 8px 16px; border-radius: 8px; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
            .ticket-body { display: flex; flex-direction: row; }
            .ticket-main { flex: 1; padding: 32px; border-right: 2px dashed #ddd; }
            .ticket-qr { width: 220px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fafafa; }
            .event-name { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 24px; line-height: 1.2; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; }
            .detail-row { display: flex; align-items: center; gap: 12px; }
            .detail-icon { width: 32px; height: 32px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
            .detail-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; margin-bottom: 2px; }
            .detail-value { font-size: 14px; color: #111; font-weight: 600; }
            .guest-section { margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; }
            .guest-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; margin-bottom: 4px; }
            .guest-name { font-size: 18px; font-weight: 800; color: #111; }
            .qr-code { background: white; padding: 12px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
            .ticket-code { margin-top: 12px; font-family: monospace; font-size: 14px; font-weight: 800; letter-spacing: 3px; color: #333; }
            .scan-text { margin-top: 6px; font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1.5px; }
            .ticket-footer { background: #f8f8f8; padding: 14px 24px; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #eee; }
            @page {
              size: auto;
              margin: 0mm;
            }
            @media print { 
              body { padding: 40px; background: none; } 
              .mobile-ticket { box-shadow: none; border: 1px solid #000; }
            }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleShare = async () => {
    if (!ticketRef.current) return;
    const ticketElement = ticketRef.current.querySelector(".mobile-ticket") as HTMLElement;
    if (!ticketElement) return;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(ticketElement, {
          scale: 2,
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div ref={ticketRef}>
          <div className="ticket relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-2xl max-w-xl mx-auto">
            {/* Header */}
            <div className="ticket-header relative z-10 bg-gradient-to-r from-primary to-[#c91140] text-white px-6 py-4 flex justify-between items-center">
              <div className="brand-container flex items-center">
                <img
                  src="/assets/logo-white.png"
                  alt="Inside Karachi"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <div className="ticket-type bg-white/20 backdrop-blur-sm border border-white/30 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                Event Ticket
              </div>
            </div>

            {/* Body */}
            <div className="ticket-body relative flex flex-col bg-white">
              {/* Main Content */}
              <div className="ticket-main p-6">
                <h2 className="event-name text-xl font-black text-gray-900 mb-4 leading-tight tracking-tight">
                  {eventName || "Event"}
                </h2>

                <div className="details-grid space-y-3.5">
                  {formattedDate && (
                    <div className="detail-row flex items-center gap-3">
                      <div className="detail-icon w-8 h-8 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-gray-700" />
                      </div>
                      <div className="detail-content">
                        <div className="detail-label text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                          Date
                        </div>
                        <div className="detail-value text-sm text-gray-900 font-bold">
                          {formattedDate}
                        </div>
                      </div>
                    </div>
                  )}

                  {formattedTime && (
                    <div className="detail-row flex items-center gap-3">
                      <div className="detail-icon w-8 h-8 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="detail-content">
                        <div className="detail-label text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                          Time
                        </div>
                        <div className="detail-value text-sm text-gray-900 font-bold">
                          {formattedTime}
                        </div>
                      </div>
                    </div>
                  )}

                  {venueName && (
                    <div className="detail-row flex items-center gap-3">
                      <div className="detail-icon w-8 h-8 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-4 h-4 text-gray-700" />
                      </div>
                      <div className="detail-content">
                        <div className="detail-label text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                          Venue
                        </div>
                        <div className="detail-value text-sm text-gray-900 font-bold">
                          {venueName}
                        </div>
                      </div>
                    </div>
                  )}

                  {pass.gate_label && (
                    <div className="detail-row flex items-center gap-3">
                      <div className="detail-icon w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-4 h-4 text-primary" />
                      </div>
                      <div className="detail-content">
                        <div className="detail-label text-[9px] uppercase tracking-wider text-primary font-black mb-0.5">
                          Gate / Entrance
                        </div>
                        <div className="detail-value text-sm text-primary font-black tracking-wide">
                          {pass.gate_label}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attendee Info */}
                {(pass.guest_name || pass.cnic_last4) && (
                  <div className="guest-section mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    {pass.guest_name && (
                      <div>
                        <div className="guest-label text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                          Attendee
                        </div>
                        <div className="guest-name text-base font-black text-gray-900">
                          {pass.guest_name}
                        </div>
                      </div>
                    )}
                    {pass.cnic_last4 && (
                      <div>
                        <div className="guest-label text-[9px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                          CNIC
                        </div>
                        <div className="text-sm font-mono font-bold text-gray-800">
                          *****-*******-{pass.cnic_last4}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Perforation Line & Notches */}
              <div className="relative flex items-center justify-between w-full h-[1px]">
                {/* Left Notch */}
                <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-neutral-900 z-20" />
                {/* Horizontal Dashed Line */}
                <div className="w-full border-t-2 border-dashed border-gray-300 mx-3" />
                {/* Right Notch */}
                <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-neutral-900 z-20" />
              </div>

              {/* QR Code Section */}
              <div className="ticket-qr p-6 flex flex-col items-center justify-center bg-gray-50/70">
                {pass.code ? (
                  <>
                    <div className="qr-code bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                      <QRCodeSVG
                        id={`mobile-qr-${pass.id}`}
                        value={pass.code}
                        size={150}
                        level="H"
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                      />
                    </div>
                    <div className="ticket-code mt-3 font-mono text-sm font-black tracking-widest text-gray-900">
                      {pass.code}
                    </div>
                    <div className="scan-text mt-1 text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center">
                      Scan at Entry
                    </div>
                  </>
                ) : (
                  <div className="py-4 text-center">
                    <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Complete payment to view ticket code</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="ticket-footer bg-gray-50/90 px-6 py-3 text-center border-t border-gray-200">
              <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                This ticket is non-transferable. Present a valid ID at check-in.
                <br />© {new Date().getFullYear()} Inside Karachi • insidekarachi.com
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 p-4 border-t border-border/30">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
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
}: FullScreenPassesProps) {
  const [selectedPass, setSelectedPass] = useState<PublicPass | null>(null);
  const [mounted, setMounted] = useState(false);

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
                  <div className="flex-shrink-0 px-4 sm:px-6 pt-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 w-fit">
                      <QrCode className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {passes.length}{" "}
                        {passes.length === 1 ? "Pass" : "Passes"}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Passes List */}
                  <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
                    {passes.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {passes.map((pass, index) => (
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
