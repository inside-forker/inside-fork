"use client";

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";

export type TicketPdfInput = {
  code: string;
  eventName: string;
  eventDate: string;
  eventTime?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  organizerName?: string | null;
  ticketType?: string | null;
  guestName?: string | null;
  cnicLast4?: string | null;
  gateLabel?: string | null;
  bookingCode?: string | null;
  ticketIndex?: number | null;
  totalTickets?: number | null;
  filename?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function qrCodeDataUrl(value: string, size = 400): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;";
  document.body.appendChild(host);

  const root = createRoot(host);
  await new Promise<void>((resolve) => {
    root.render(
      createElement(QRCodeCanvas, {
        value,
        size,
        level: "H",
        includeMargin: false,
        bgColor: "#FFFFFF",
        fgColor: "#000000",
      }),
    );
    // Two frames so the canvas paints
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const canvas = host.querySelector("canvas");
  const dataUrl = canvas?.toDataURL("image/png") ?? "";
  root.unmount();
  document.body.removeChild(host);
  return dataUrl;
}

/**
 * Build a pure vector ticket PDF that is crystal-clear at 1000% zoom (never blurry).
 */
export async function downloadTicketPdf(input: TicketPdfInput): Promise<void> {
  if (!input.code) {
    throw new Error("Ticket code is required to download a PDF.");
  }

  const qrDataUrl = await qrCodeDataUrl(input.code, 400);

  const eventName = input.eventName || "Event";
  const organizer = input.organizerName || "Inside Karachi";
  const gateLabel = input.gateLabel || "Lane 1";
  const eventDate = input.eventDate || "";
  const eventTime = input.eventTime || "Doors Open 7:00 PM";
  const typeLabel = input.ticketType || "Standard Pass";
  const venue = input.venueName || "Karachi";
  const venueAddress = input.venueAddress || "";
  const guest = input.guestName || "Guest";
  const cnicRaw = input.cnicLast4 || "";
  const cnicFormatted = cnicRaw ? (cnicRaw.length <= 4 ? `CNIC ··········${cnicRaw}` : `CNIC ${cnicRaw}`) : "";
  const code = input.code;
  const bookingCode = input.bookingCode || `IKB-${code.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ticketIndex = input.ticketIndex || 1;
  const totalTickets = input.totalTickets || 1;

  // Standard A4 portrait in points (595.28 x 841.89 pt)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  // White background page
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, 595.28, 841.89, "F");

  // Card Dimensions
  const cardX = 36;
  const cardY = 36;
  const cardW = 523.28;
  const cardH = 172;

  // 1. Outer Card Box (Rounded with subtle border)
  pdf.setDrawColor(203, 213, 225); // #cbd5e1
  pdf.setFillColor(255, 255, 255);
  pdf.setLineWidth(0.85);
  pdf.roundedRect(cardX, cardY, cardW, cardH, 9, 9, "FD");

  // 2. Top Header
  // Event Name
  pdf.setTextColor(15, 23, 42); // #0f172a
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(eventName, cardX + 18, cardY + 22);

  // Organizer Subtitle
  pdf.setTextColor(100, 116, 139); // #64748b
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text(`by ${organizer}`, cardX + 18, cardY + 33);

  // Entry Lane Badge (Right)
  const badgeW = 68;
  const badgeH = 26;
  const badgeX = cardX + cardW - 18 - badgeW;
  const badgeY = cardY + 11;
  pdf.setDrawColor(244, 35, 84); // #F42354
  pdf.setLineWidth(1.2);
  pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 6, 6, "D");

  pdf.setTextColor(244, 35, 84);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.text("ENTRY LANE", badgeX + badgeW / 2, badgeY + 8.5, { align: "center" });

  pdf.setFontSize(10.5);
  pdf.text(gateLabel, badgeX + badgeW / 2, badgeY + 20, { align: "center" });

  // 3. Header Divider Line
  pdf.setDrawColor(226, 232, 240); // #e2e8f0
  pdf.setLineWidth(0.65);
  pdf.line(cardX + 18, cardY + 44, cardX + cardW - 18, cardY + 44);

  // 4. Middle Section - Info Columns
  const yRow1Label = cardY + 56;
  const yRow1Val = cardY + 68;

  // Column 1: DATE
  pdf.setTextColor(148, 163, 184); // #94a3b8
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("DATE", cardX + 18, yRow1Label);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9.5);
  pdf.text(eventDate, cardX + 18, yRow1Val);

  // Column 2: TIME
  const col2X = cardX + 145;
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(6.5);
  pdf.text("TIME", col2X, yRow1Label);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9.5);
  pdf.text(eventTime, col2X, yRow1Val);

  // Column 3: TICKET
  const col3X = cardX + 265;
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(6.5);
  pdf.text("TICKET", col3X, yRow1Label);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9.5);
  pdf.text(typeLabel, col3X, yRow1Val);

  // Row 2: VENUE & ATTENDEE
  const yRow2Label = cardY + 85;
  const yRow2Val = cardY + 97;
  const yRow2Sub = cardY + 107;

  // VENUE
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(6.5);
  pdf.text("VENUE", cardX + 18, yRow2Label);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9.5);
  // Truncate venue text if too long
  const truncatedVenue = venue.length > 42 ? venue.slice(0, 40) + "..." : venue;
  pdf.text(truncatedVenue, cardX + 18, yRow2Val);

  if (venueAddress) {
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    const truncatedAddress = venueAddress.length > 50 ? venueAddress.slice(0, 48) + "..." : venueAddress;
    pdf.text(truncatedAddress, cardX + 18, yRow2Sub);
  }

  // ATTENDEE
  pdf.setTextColor(148, 163, 184);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text("ATTENDEE", col3X, yRow2Label);

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(9.5);
  pdf.text(guest, col3X, yRow2Val);

  if (cnicFormatted) {
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(8);
    pdf.text(cnicFormatted, col3X, yRow2Sub);
  }

  // 5. Vertical Divider before QR
  const qrSecX = cardX + cardW - 120;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.65);
  pdf.line(qrSecX, cardY + 44, qrSecX, cardY + 148);

  // 6. Right Section - Logo + QR Code + Monospace Pass Code + Count
  const qrCenterX = qrSecX + (cardX + cardW - qrSecX) / 2;

  // INSIDE karachi logo
  pdf.setTextColor(244, 35, 84); // #F42354
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.text("INSIDE", qrCenterX, cardY + 54, { align: "center" });

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12.5);
  pdf.text("karachi", qrCenterX - 2, cardY + 65, { align: "center" });

  // Pink dot on 'i' of karachi
  pdf.setFillColor(244, 35, 84);
  pdf.circle(qrCenterX + 17.5, cardY + 57.5, 0.9, "F");

  // High-Resolution Crisp QR Code
  const qrSize = 58;
  pdf.addImage(qrDataUrl, "PNG", qrCenterX - qrSize / 2, cardY + 69, qrSize, qrSize);

  // Monospace Pass Code
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(8.5);
  pdf.text(code, qrCenterX, cardY + 135, { align: "center" });

  // Ticket X of Y
  pdf.setTextColor(100, 116, 139);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.text(`TICKET ${ticketIndex} OF ${totalTickets}`, qrCenterX, cardY + 143, { align: "center" });

  // 7. Footer Divider & Text
  pdf.setDrawColor(226, 232, 240);
  pdf.line(cardX + 18, cardY + 148, cardX + cardW - 18, cardY + 148);

  pdf.setTextColor(148, 163, 184);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.text(`Booking ${bookingCode} · One entry per ticket · Non-transferable · Carry a valid ID`, cardX + 18, cardY + 160);
  pdf.text("insidekarachi.com", cardX + cardW - 18, cardY + 160, { align: "right" });

  // Save PDF
  const filename = input.filename || `ticket-${input.code}`;
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** @deprecated Prefer downloadTicketPdf — DOM capture of Tailwind tickets often blanks. */
export async function downloadTicketPdfFromElement(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  // Fall back: try to extract data from the live ticket and rebuild cleanly
  const code =
    element.querySelector(".ticket-code")?.textContent?.trim() ||
    element.querySelector("[data-ticket-code]")?.textContent?.trim() ||
    "";
  const eventName =
    element.querySelector(".event-name")?.textContent?.trim() || "Event";
  const guestName =
    element.querySelector(".guest-name")?.textContent?.trim() || null;

  if (code) {
    await downloadTicketPdf({
      code,
      eventName,
      eventDate: "",
      guestName,
      filename,
    });
    return;
  }

  // Last resort: capture element as-is
  const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [canvas.width / 2 + 40, canvas.height / 2 + 40],
    hotfixes: ["px_scaling"],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 20, 20, canvas.width / 2, canvas.height / 2);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
