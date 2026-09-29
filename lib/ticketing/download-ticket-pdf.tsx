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

async function qrCodeDataUrl(value: string, size = 200): Promise<string> {
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

function buildTicketHtml(input: TicketPdfInput, qrDataUrl: string): string {
  const typeLabel = escapeHtml(input.ticketType || "Standard Pass");
  const eventName = escapeHtml(input.eventName || "Event");
  const eventDate = escapeHtml(input.eventDate || "");
  const eventTime = input.eventTime ? escapeHtml(input.eventTime) : "";
  const venue = input.venueName ? escapeHtml(input.venueName) : "Karachi";
  const venueAddress = input.venueAddress ? escapeHtml(input.venueAddress) : "";
  const organizer = input.organizerName ? escapeHtml(input.organizerName) : "Inside Karachi";
  const guest = escapeHtml(input.guestName || "Guest");
  const cnicRaw = input.cnicLast4 ? escapeHtml(input.cnicLast4) : "";
  const cnicFormatted = cnicRaw ? (cnicRaw.length <= 4 ? `··········${cnicRaw}` : cnicRaw) : "";
  const gate = escapeHtml(input.gateLabel || "Lane 1");
  const code = escapeHtml(input.code);
  const bookingCode = escapeHtml(input.bookingCode || `IKB-${code.replace(/[^a-zA-Z0-9]/g, "")}`);
  const ticketIndex = input.ticketIndex || 1;
  const totalTickets = input.totalTickets || 1;

  return `
<div class="ik-ticket-card" style="width:740px;background:#ffffff;border:1px solid #cbd5e1;border-radius:12px;padding:22px 24px 16px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;box-sizing:border-box;">
  
  <!-- Top Header Row -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px;">
    <div style="flex:1;min-width:0;">
      <div style="font-size:16px;font-weight:800;color:#000000;line-height:1.25;letter-spacing:-0.01em;">${eventName}</div>
      <div style="font-size:11px;color:#64748b;font-weight:500;margin-top:2px;">by ${organizer}</div>
    </div>
    <div style="border:1.5px solid #F42354;border-radius:8px;padding:4px 14px;text-align:center;min-width:82px;flex-shrink:0;background:#ffffff;">
      <div style="font-size:7.5px;font-weight:800;color:#F42354;letter-spacing:0.1em;text-transform:uppercase;">ENTRY LANE</div>
      <div style="font-size:13.5px;font-weight:800;color:#F42354;line-height:1.15;margin-top:1px;">${gate}</div>
    </div>
  </div>

  <!-- Header Divider -->
  <div style="border-top:1px solid #e2e8f0;margin-bottom:16px;"></div>

  <!-- Main Content + QR Area -->
  <div style="display:flex;gap:20px;align-items:flex-start;justify-content:space-between;">
    
    <!-- Left Details -->
    <div style="flex:1;min-width:0;">
      
      <!-- Row 1: DATE, TIME, TICKET -->
      <div style="display:grid;grid-template-columns:1.2fr 1.2fr 1fr;gap:14px;margin-bottom:16px;">
        <div>
          <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">DATE</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;">${eventDate}</div>
        </div>
        <div>
          <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">TIME</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;">${eventTime || "Doors Open 7:00 PM"}</div>
        </div>
        <div>
          <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">TICKET</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;">${typeLabel}</div>
        </div>
      </div>

      <!-- Row 2: VENUE, ATTENDEE -->
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:14px;">
        <div>
          <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">VENUE</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;">${venue}</div>
          ${venueAddress ? `<div style="font-size:9.5px;color:#64748b;margin-top:2px;line-height:1.25;">${venueAddress}</div>` : ""}
        </div>
        <div>
          <div style="font-size:8px;font-weight:700;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">ATTENDEE</div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;">${guest}</div>
          ${cnicFormatted ? `<div style="font-size:9.5px;color:#64748b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px;">CNIC ${cnicFormatted}</div>` : ""}
        </div>
      </div>

    </div>

    <!-- Right QR Section -->
    <div style="border-left:1px solid #e2e8f0;padding-left:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:130px;flex-shrink:0;">
      
      <!-- Inside Karachi Logo -->
      <div style="text-align:center;margin-bottom:6px;line-height:1;">
        <span style="font-size:7.5px;font-weight:800;color:#F42354;letter-spacing:0.18em;text-transform:uppercase;display:block;margin-bottom:2px;">INSIDE</span>
        <span style="font-size:16px;font-weight:900;color:#000000;letter-spacing:-0.03em;">karach<span style="color:#F42354;">i</span></span>
      </div>

      <!-- Sharp QR Code -->
      <div style="background:#ffffff;padding:2px;border-radius:4px;">
        <img src="${qrDataUrl}" width="96" height="96" alt="QR" style="display:block;" />
      </div>

      <!-- Monospace Ticket Code -->
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;font-weight:800;letter-spacing:0.06em;color:#0f172a;margin-top:6px;">${code}</div>
      
      <!-- Ticket Index / Total -->
      <div style="font-size:8px;font-weight:700;letter-spacing:0.06em;color:#64748b;text-transform:uppercase;margin-top:2px;">TICKET ${ticketIndex} OF ${totalTickets}</div>

    </div>

  </div>

  <!-- Bottom Footer Line -->
  <div style="border-top:1px solid #e2e8f0;margin-top:16px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-size:7.5px;color:#94a3b8;">
    <div>Booking ${bookingCode} · One entry per ticket · Non-transferable · Carry a valid ID</div>
    <div>insidekarachi.com</div>
  </div>

</div>`;
}

/**
 * Build a ticket PDF that matches the clean white boarding pass style.
 */
export async function downloadTicketPdf(input: TicketPdfInput): Promise<void> {
  if (!input.code) {
    throw new Error("Ticket code is required to download a PDF.");
  }

  const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);

  const qrDataUrl = await qrCodeDataUrl(input.code, 220);
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:740px;background:#ffffff;pointer-events:none;";
  host.innerHTML = buildTicketHtml(input, qrDataUrl);
  document.body.appendChild(host);

  const ticketEl = host.querySelector(".ik-ticket-card") as HTMLElement;
  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore
      }
    }

    const images = Array.from(ticketEl.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );

    const canvas = await html2canvas(ticketEl, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 740,
    });

    const imgData = canvas.toDataURL("image/png");

    // Standard A4 portrait in pt (595.28 x 841.89)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = 595.28;
    const margin = 36;
    const cardWidth = pageWidth - margin * 2;
    const cardHeight = (canvas.height / canvas.width) * cardWidth;

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, 595.28, 841.89, "F");

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      margin + 4,
      cardWidth,
      cardHeight,
      undefined,
      "NONE",
    );

    const filename = input.filename || `ticket-${input.code}`;
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
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
