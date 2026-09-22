"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import {
  Download,
  Printer,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  X,
  Share2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPass } from "@/types/ticketing.types";

interface PrintableTicketProps {
  pass: PublicPass;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  venueName?: string;
  ticketType?: string;
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
  autoDownloadPdf = false,
  onClose,
}: PrintableTicketProps) {
  const ticketRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const autoDownloadFired = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  React.useEffect(() => {
    if (!mounted || !autoDownloadPdf || autoDownloadFired.current) return;
    if (!pass.code) return;

    const timer = window.setTimeout(async () => {
      const ticketElement = ticketRef.current?.querySelector(
        ".ticket",
      ) as HTMLElement | null;
      if (!ticketElement) return;
      autoDownloadFired.current = true;
      try {
        const { downloadTicketPdfFromElement } = await import(
          "@/lib/ticketing/download-ticket-pdf"
        );
        await downloadTicketPdfFromElement(
          ticketElement,
          `ticket-${pass.code || pass.id}`,
        );
      } catch (error) {
        console.error("Error auto-downloading ticket PDF:", error);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [mounted, autoDownloadPdf, pass.code, pass.id]);

  const handlePrint = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const printContent = ticketRef.current;
    if (!printContent) return;

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
            .ticket {
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
             /* Reverted to clean boarding pass style */
            @page {
              size: auto;
              margin: 0mm; /* Removes browser headers and footers */
            }
            @media print { 
              body { padding: 40px; background: none; } 
              .ticket { box-shadow: none; border: 1px solid #000; }
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

  const handleSaveTicket = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!ticketRef.current) return;
    const ticketElement = ticketRef.current.querySelector(".ticket") as HTMLElement;
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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!ticketRef.current) return;
    const ticketElement = ticketRef.current.querySelector(".ticket") as HTMLElement;
    if (!ticketElement) return;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
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
        }, 'image/png');

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

  const formattedDate = React.useMemo(() => {
    try {
      return format(new Date(eventDate), "EEEE, MMMM d, yyyy");
    } catch {
      return eventDate;
    }
  }, [eventDate]);

  const formattedTime = React.useMemo(() => {
    if (!eventTime) {
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

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] isolate"
      style={{ pointerEvents: "auto" }}
    >
      {/* Full screen backdrop - blocks all clicks to elements behind */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
        style={{ pointerEvents: "auto" }}
      />

      {/* Modal content container */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-3xl pointer-events-auto mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Card Container */}
          <div className="flex flex-col max-h-[90vh] bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex-none flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary mb-1">
                  Inside Karachi
                </p>
                <h3 className="text-lg font-bold text-white truncate max-w-[320px]">
                  {eventName}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            {/* Ticket Content */}
            <div
              className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-8 scrollbar-hide"
              onWheel={(e) => e.stopPropagation()} // Stop parent modals from hijacking scroll
              onTouchMove={(e) => e.stopPropagation()} // Stop touch propagation too
            >
              <div ref={ticketRef}>
                <div className="ticket relative bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-2xl max-w-3xl mx-auto">
                  {/* Header */}
                  <div className="ticket-header relative z-10 bg-gradient-to-r from-primary to-[#c91140] text-white px-8 py-4 flex justify-between items-center">
                    <div className="brand-container flex items-center">
                      <img
                        src="/assets/logo-white.png"
                        alt="Inside Karachi"
                        className="h-8 w-auto object-contain"
                      />
                    </div>
                    <div className="ticket-type bg-white/20 backdrop-blur-sm border border-white/30 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                      Event Ticket
                    </div>
                  </div>

                  {/* Body */}
                  <div className="ticket-body relative flex flex-col sm:flex-row bg-white">
                    {/* Main Content */}
                    <div className="ticket-main flex-1 p-6 sm:p-7">
                      <h2 className="event-name text-xl sm:text-2xl font-bold text-gray-900 mb-5 leading-snug">
                        {eventName}
                      </h2>

                      <div className="details-grid grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="detail-row flex items-center gap-3">
                          <div className="detail-icon w-9 h-9 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-700" />
                          </div>
                          <div className="detail-content">
                            <div className="detail-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                              Date
                            </div>
                            <div className="detail-value text-sm text-gray-900 font-semibold">
                              {formattedDate}
                            </div>
                          </div>
                        </div>

                        {formattedTime && (
                          <div className="detail-row flex items-center gap-3">
                            <div className="detail-icon w-9 h-9 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600">
                              <Clock className="w-4 h-4 text-gray-700" />
                            </div>
                            <div className="detail-content">
                              <div className="detail-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                Time
                              </div>
                              <div className="detail-value text-sm text-gray-900 font-semibold">
                                {formattedTime}
                              </div>
                            </div>
                          </div>
                        )}

                        {venueName && (
                          <div className="detail-row flex items-center gap-3">
                            <div className="detail-icon w-9 h-9 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600">
                              <MapPin className="w-4 h-4 text-gray-700" />
                            </div>
                            <div className="detail-content">
                              <div className="detail-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                Venue
                              </div>
                              <div className="detail-value text-sm text-gray-900 font-semibold">
                                {venueName}
                              </div>
                            </div>
                          </div>
                        )}

                        {ticketType && (
                          <div className="detail-row flex items-center gap-3">
                            <div className="detail-icon w-9 h-9 bg-gray-100/90 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600">
                              <Ticket className="w-4 h-4 text-gray-700" />
                            </div>
                            <div className="detail-content">
                              <div className="detail-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                Ticket Type
                              </div>
                              <div className="detail-value text-sm text-gray-900 font-semibold">
                                {ticketType}
                              </div>
                            </div>
                          </div>
                        )}

                        {pass.gate_label && (
                          <div className="detail-row flex items-center gap-3">
                            <div className="detail-icon w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Ticket className="w-4 h-4 text-primary" />
                            </div>
                            <div className="detail-content">
                              <div className="detail-label text-[10px] uppercase tracking-wider text-primary font-bold mb-0.5">
                                Gate / Entrance
                              </div>
                              <div className="detail-value text-sm text-primary font-bold">
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
                              <div className="guest-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                Attendee
                              </div>
                              <div className="guest-name text-base sm:text-lg font-bold text-gray-900">
                                {pass.guest_name}
                              </div>
                            </div>
                          )}
                          {pass.cnic_last4 && (
                            <div>
                              <div className="guest-label text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">
                                CNIC
                              </div>
                              <div className="text-sm font-mono font-medium text-gray-700">
                                *****-*******-{pass.cnic_last4}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Perforation Line for Desktop */}
                    <div className="hidden sm:flex relative items-stretch">
                      <div className="w-[1px] border-r-2 border-dashed border-gray-200 my-4" />
                    </div>

                    {/* Perforation Line for Mobile */}
                    <div className="sm:hidden relative flex items-center justify-between w-full h-[1px]">
                      <div className="w-full border-t-2 border-dashed border-gray-200 mx-4" />
                    </div>

                    {/* QR Code Section */}
                    <div className="ticket-qr relative w-full sm:w-64 p-6 flex flex-col items-center justify-center bg-gray-50/70 border-l border-gray-100/50">
                      {pass.code ? (
                        <>
                          <div className="qr-code bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                            <QRCodeSVG
                              id={`printable-qr-${pass.id}`}
                              value={pass.code}
                              size={140}
                              level="H"
                              bgColor="#FFFFFF"
                              fgColor="#000000"
                            />
                          </div>
                          <div className="ticket-code mt-3 font-mono text-base font-bold tracking-wider text-gray-900">
                            {pass.code}
                          </div>
                          <div className="scan-text mt-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider text-center">
                            Scan at Entry
                          </div>
                        </>
                      ) : (
                        <div className="py-4 text-center">
                          <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm font-medium text-muted-foreground">Payment required</p>
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

            {/* Modal Footer with Actions */}
            <div
              className="flex-none flex items-center justify-center gap-3 px-6 py-4 border-t border-white/10 bg-black/20"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveTicket}
                className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
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
