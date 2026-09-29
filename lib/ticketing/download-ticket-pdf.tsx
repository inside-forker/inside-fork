"use client";

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import type { PublicPass } from "@/types/ticketing.types";
import {
  buildTicketPagesHtml,
  TICKET_SHEET_STYLES,
  type TicketSheetItem,
} from "@/lib/ticketing/ticket-sheet-html";

export type TicketPdfEvent = {
  name: string;
  startTime: string | null;
  endTime?: string | null;
  venueName?: string | null;
  address?: string | null;
  organizer?: string | null;
  bookingReference?: string | null;
  /** Used when a pass carries no `ticket_type_name` of its own. */
  ticketType?: string | null;
};

const A4_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 296;

async function qrCodeDataUrl(value: string, size = 512): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;";
  document.body.appendChild(host);

  const root = createRoot(host);
  root.render(
    createElement(QRCodeCanvas, {
      value,
      size,
      level: "H",
      marginSize: 1,
      bgColor: "#FFFFFF",
      fgColor: "#000000",
    }),
  );

  // QRCodeCanvas draws in an effect, so poll until the canvas has dark modules
  // rather than trusting a fixed frame count (a cold first render misses it).
  // setTimeout, not rAF: rAF stalls in a background tab.
  let dataUrl = "";
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 30));
      const canvas = host.querySelector("canvas");
      if (canvas && hasDarkPixels(canvas)) {
        dataUrl = canvas.toDataURL("image/png");
        break;
      }
    }
  } finally {
    root.unmount();
    document.body.removeChild(host);
  }
  if (!dataUrl) throw new Error("Couldn't draw the ticket QR code.");
  return dataUrl;
}

function hasDarkPixels(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || canvas.width === 0) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 128) return true;
  }
  return false;
}

function waitForImages(root: HTMLElement): Promise<unknown[]> {
  return Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.decode().catch(() => undefined),
    ),
  );
}

/**
 * Downloads an A4 PDF with four fixed-height tickets per page. `passes` are the
 * ones printed; `orderPasses` (default: `passes`) numbers them "Ticket n of N"
 * against the whole booking. Passes without a code are skipped.
 */
export async function downloadTicketsPdf({
  event,
  passes,
  orderPasses = passes,
  filename,
}: {
  event: TicketPdfEvent;
  passes: PublicPass[];
  orderPasses?: PublicPass[];
  filename: string;
}): Promise<void> {
  const issued = passes.filter((p) => p.code);
  if (issued.length === 0) {
    throw new Error("These tickets don't have codes yet.");
  }

  const items: TicketSheetItem[] = [];
  for (const pass of issued) {
    items.push({
      code: pass.code as string,
      qrSrc: await qrCodeDataUrl(pass.code as string),
      eventName: event.name,
      startTime: event.startTime,
      endTime: event.endTime ?? null,
      venueName: event.venueName ?? null,
      address: event.address ?? null,
      organizer: event.organizer ?? null,
      ticketType: pass.ticket_type_name || event.ticketType || null,
      guestName: pass.guest_name ?? null,
      cnicLast4: pass.cnic_last4 ?? null,
      laneLabel: pass.gate_label ?? null,
      bookingReference: event.bookingReference ?? null,
      index: orderPasses.findIndex((p) => p.id === pass.id) + 1 || 1,
      total: Math.max(orderPasses.length, 1),
    });
  }

  const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
  host.innerHTML = `<style>${TICKET_SHEET_STYLES}</style><div class="iks-root">${buildTicketPagesHtml(
    items,
    `${window.location.origin}/logo-black.png`,
  ).join("")}</div>`;
  document.body.appendChild(host);

  try {
    try {
      await document.fonts?.ready;
    } catch {
      // ignore
    }
    await waitForImages(host);

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pages = Array.from(host.querySelectorAll<HTMLElement>(".iks-page"));

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 2.5,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        0,
        A4_WIDTH_MM,
        PAGE_HEIGHT_MM,
        undefined,
        "FAST",
      );
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}
