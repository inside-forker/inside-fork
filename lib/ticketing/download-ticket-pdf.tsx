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
  ticketType?: string | null;
  guestName?: string | null;
  cnicLast4?: string | null;
  gateLabel?: string | null;
  filename?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function qrCodeDataUrl(value: string, size = 180): Promise<string> {
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
        includeMargin: true,
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
  const typeLabel = escapeHtml(input.ticketType || "Event Ticket");
  const eventName = escapeHtml(input.eventName || "Event");
  const eventDate = escapeHtml(input.eventDate || "");
  const eventTime = input.eventTime ? escapeHtml(input.eventTime) : "";
  const venue = input.venueName ? escapeHtml(input.venueName) : "";
  const guest = input.guestName ? escapeHtml(input.guestName) : "";
  const cnic = input.cnicLast4 ? escapeHtml(input.cnicLast4) : "";
  const gate = input.gateLabel ? escapeHtml(input.gateLabel) : "";
  const code = escapeHtml(input.code);
  const year = new Date().getFullYear();

  return `
<div class="ik-ticket" style="width:800px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
  <div style="background:linear-gradient(135deg,#F42354 0%,#c91140 100%);color:#ffffff;padding:18px 28px;display:flex;align-items:center;justify-content:center;min-height:64px;">
    <div style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.35);padding:8px 16px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
      ${typeLabel}
    </div>
  </div>

  <div style="display:flex;background:#ffffff;">
    <div style="flex:1;padding:28px;">
      <div style="font-size:24px;font-weight:800;line-height:1.25;margin-bottom:22px;color:#111827;">${eventName}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px 24px;">
        <div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Date</div>
          <div style="font-size:14px;font-weight:600;color:#111827;">${eventDate}</div>
        </div>
        ${
          eventTime
            ? `<div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Time</div>
          <div style="font-size:14px;font-weight:600;color:#111827;">${eventTime}</div>
        </div>`
            : ""
        }
        ${
          venue
            ? `<div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Venue</div>
          <div style="font-size:14px;font-weight:600;color:#111827;">${venue}</div>
        </div>`
            : ""
        }
        ${
          input.ticketType
            ? `<div>
          <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Ticket Type</div>
          <div style="font-size:14px;font-weight:600;color:#111827;">${typeLabel}</div>
        </div>`
            : ""
        }
        ${
          gate
            ? `<div style="grid-column:1 / -1;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F42354;margin-bottom:4px;">Enter At</div>
          <div style="font-size:16px;font-weight:800;color:#F42354;">${gate}</div>
        </div>`
            : ""
        }
      </div>

      ${
        guest || cnic
          ? `<div style="margin-top:22px;padding-top:18px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          ${
            guest
              ? `<div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Attendee</div>
            <div style="font-size:16px;font-weight:800;color:#111827;">${guest}</div>
          </div>`
              : ""
          }
          ${
            cnic
              ? `<div>
            <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">CNIC</div>
            <div style="font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;color:#374151;">*****-*******-${cnic}</div>
          </div>`
              : ""
          }
        </div>`
          : ""
      }
    </div>

    <div style="width:240px;padding:24px;background:#f9fafb;border-left:2px dashed #e5e7eb;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div style="background:#ffffff;padding:12px;border-radius:16px;border:1px solid #f3f4f6;">
        <img src="${qrDataUrl}" width="160" height="160" alt="QR" style="display:block;" />
      </div>
      <div style="margin-top:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;font-weight:800;letter-spacing:0.06em;color:#111827;">${code}</div>
      <div style="margin-top:4px;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">Scan at Entry</div>
    </div>
  </div>

  <div style="background:#f9fafb;padding:12px 24px;text-align:center;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280;line-height:1.5;">
    This ticket is non-transferable. Present a valid ID at check-in.<br/>
    © ${year} Inside Karachi · insidekarachi.com
  </div>
</div>`;
}

/**
 * Build a ticket PDF that matches the on-screen preview (red header + type pill + QR).
 * Uses a self-contained HTML card with hex colors so capture isn't blanked by Tailwind/oklch.
 */
export async function downloadTicketPdf(input: TicketPdfInput): Promise<void> {
  if (!input.code) {
    throw new Error("Ticket code is required to download a PDF.");
  }

  const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);

  const qrDataUrl = await qrCodeDataUrl(input.code, 180);
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;background:#ffffff;pointer-events:none;";
  host.innerHTML = buildTicketHtml(input, qrDataUrl);
  document.body.appendChild(host);

  const ticketEl = host.querySelector(".ik-ticket") as HTMLElement;
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
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      width: 800,
    });

    const imgData = canvas.toDataURL("image/png");
    const padding = 20;
    const pdfWidth = canvas.width / 2 + padding * 2;
    const pdfHeight = canvas.height / 2 + padding * 2;

    const pdf = new jsPDF({
      orientation: pdfWidth >= pdfHeight ? "landscape" : "portrait",
      unit: "px",
      format: [pdfWidth, pdfHeight],
      hotfixes: ["px_scaling"],
    });

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pdfWidth, pdfHeight, "F");
    pdf.addImage(
      imgData,
      "PNG",
      padding,
      padding,
      canvas.width / 2,
      canvas.height / 2,
      undefined,
      "FAST",
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
