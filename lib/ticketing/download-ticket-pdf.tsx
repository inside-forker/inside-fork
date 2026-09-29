"use client";

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import type { PublicPass } from "@/types/ticketing.types";
import { TICKETS_PER_PAGE } from "@/lib/ticketing/ticket-sheet-html";

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

type DrawnTicket = {
  code: string;
  qrSrc: string;
  eventName: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  address: string | null;
  organizer: string | null;
  ticketType: string | null;
  guestName: string | null;
  cnicLast4: string | null;
  laneLabel: string | null;
  bookingReference: string | null;
  index: number;
  total: number;
};

const TIME_ZONE = "Asia/Karachi";
const BRAND_RED: [number, number, number] = [244, 35, 84];
const INK: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const LABEL: [number, number, number] = [156, 163, 175];
const RULE: [number, number, number] = [233, 234, 236];
const BORDER: [number, number, number] = [217, 218, 221];
const DASH: [number, number, number] = [209, 213, 219];

const PAGE_W = 210;
const PAD_X = 12;
const PAD_Y = 10;
const TICKET_H = 64;
const CUT_H = 7;
const STUB_W = 48;
const RADIUS = 3;

async function qrCodeDataUrl(value: string, size = 512): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;";
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

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${window.location.origin}/logo-black.png`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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

function clip(value: string | null | undefined, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}...`;
}

/** Helvetica/WinAnsi can't paint bullets/ellipsis; keep glyphs PDF-safe. */
function pdfSafe(value: string): string {
  return value
    .replace(/\u2022|\u00B7|•/g, "*")
    .replace(/\u2026|…/g, "...")
    .replace(/[\u2013\u2014\u2212]/g, "-");
}

function fitText(
  pdf: jsPDF,
  text: string,
  maxWidthMm: number,
): string {
  const safe = pdfSafe(text);
  if (!safe) return "";
  if (pdf.getTextWidth(safe) <= maxWidthMm) return safe;
  let out = safe;
  while (out.length > 1 && pdf.getTextWidth(`${out}...`) > maxWidthMm) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}...`;
}

function drawDashedLine(
  pdf: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash = 1.2,
  gap = 1.1,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let pos = 0;
  let draw = true;
  while (pos < len) {
    const seg = Math.min(draw ? dash : gap, len - pos);
    const nx = x1 + ux * (pos + seg);
    const ny = y1 + uy * (pos + seg);
    if (draw) {
      pdf.line(x1 + ux * pos, y1 + uy * pos, nx, ny);
    }
    pos += seg;
    draw = !draw;
  }
}

function drawField(
  pdf: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  maxWidth: number,
  sub = "",
) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.setTextColor(...LABEL);
  pdf.text(label.toUpperCase(), x, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...INK);
  pdf.text(fitText(pdf, value || "—", maxWidth), x, y + 4.2);

  if (sub) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(fitText(pdf, sub, maxWidth), x, y + 8.2);
  }
}

function drawTicket(
  pdf: jsPDF,
  ticket: DrawnTicket,
  x: number,
  y: number,
  w: number,
  h: number,
  logoSrc: string | null,
) {
  const stubX = x + w - STUB_W;
  const mainW = stubX - x;

  pdf.setDrawColor(...BORDER);
  pdf.setFillColor(255, 255, 255);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, w, h, RADIUS, RADIUS, "FD");

  // Stub separator
  pdf.setDrawColor(...DASH);
  pdf.setLineWidth(0.4);
  drawDashedLine(pdf, stubX, y + 4, stubX, y + h - 4);

  // —— Main ——
  const mx = x + 6;
  const contentRight = stubX - 5;
  const mainInnerW = contentRight - mx;

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...INK);
  const titleMax = ticket.laneLabel ? mainInnerW - 30 : mainInnerW;
  pdf.text(fitText(pdf, ticket.eventName || "Event", titleMax), mx, y + 8);

  if (ticket.organizer) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(
      fitText(pdf, `by ${ticket.organizer}`, titleMax),
      mx,
      y + 12.2,
    );
  }

  // Entry lane badge
  if (ticket.laneLabel) {
    const badgeW = 28;
    const badgeH = 11;
    const bx = contentRight - badgeW;
    const by = y + 3.8;
    pdf.setDrawColor(...BRAND_RED);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(bx, by, badgeW, badgeH, 2, 2, "D");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.5);
    pdf.setTextColor(...BRAND_RED);
    pdf.text("ENTRY LANE", bx + badgeW / 2, by + 3.6, { align: "center" });
    pdf.setFontSize(11);
    pdf.text(fitText(pdf, ticket.laneLabel, badgeW - 4), bx + badgeW / 2, by + 8.4, {
      align: "center",
    });
  }

  // Header rule
  const ruleY = y + 16.5;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.3);
  pdf.line(mx, ruleY, contentRight, ruleY);

  // Fields
  const start = formatTime(ticket.startTime);
  const end = formatTime(ticket.endTime);
  const sameDay =
    start && end && formatDate(ticket.startTime) === formatDate(ticket.endTime);
  const time = sameDay ? `${start} - ${end}` : start;
  const date = formatDate(ticket.startTime);
  const venue = ticket.venueName || ticket.address || "";
  const address =
    ticket.venueName && ticket.address && ticket.address !== ticket.venueName
      ? ticket.address
      : "";
  const cnic = ticket.cnicLast4
    ? `CNIC ************-${ticket.cnicLast4}`
    : "";

  // Match sample proportions: DATE | TIME (wider) | TICKET; VENUE spans first two.
  const col1 = mx;
  const col2 = mx + mainInnerW * 0.3;
  const col3 = mx + mainInnerW * 0.62;
  const row1Y = ruleY + 5.5;
  const row2Y = row1Y + 14;

  drawField(pdf, col1, row1Y, "Date", date, col2 - col1 - 3);
  drawField(pdf, col2, row1Y, "Time", time, col3 - col2 - 3);
  drawField(
    pdf,
    col3,
    row1Y,
    "Ticket",
    ticket.ticketType || "General Admission",
    contentRight - col3,
  );
  drawField(
    pdf,
    col1,
    row2Y,
    "Venue",
    venue,
    col3 - col1 - 3,
    address,
  );
  drawField(
    pdf,
    col3,
    row2Y,
    "Attendee",
    ticket.guestName || "",
    contentRight - col3,
    cnic,
  );

  // Footer
  const footY = y + h - 4.5;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.3);
  pdf.line(mx, footY - 3.2, contentRight, footY - 3.2);

  const booking = ticket.bookingReference
    ? `Booking ${clip(ticket.bookingReference, 24)} · `
    : "";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(5.5);
  pdf.setTextColor(...LABEL);
  pdf.text(
    `${booking}One entry per ticket · Non-transferable · Carry a valid ID`,
    mx,
    footY,
  );
  pdf.text("insidekarachi.com", contentRight, footY, { align: "right" });

  // —— Stub ——
  const stubCx = stubX + STUB_W / 2;
  if (logoSrc) {
    const logoW = 28;
    const logoH = logoW * (340 / 1235); // logo-black.png aspect
    pdf.addImage(logoSrc, "PNG", stubCx - logoW / 2, y + 3.2, logoW, logoH);
  } else {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.5);
    pdf.setTextColor(...BRAND_RED);
    pdf.text("INSIDE", stubCx, y + 6, { align: "center" });
    pdf.setTextColor(...INK);
    pdf.setFontSize(11);
    pdf.text("karachi", stubCx, y + 10.5, { align: "center" });
    pdf.setFillColor(...BRAND_RED);
    pdf.circle(stubCx + 8.2, y + 7.2, 0.55, "F");
  }

  const qrSize = 30;
  const qrY = y + 13.5;
  pdf.addImage(ticket.qrSrc, "PNG", stubCx - qrSize / 2, qrY, qrSize, qrSize);

  pdf.setFont("courier", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...INK);
  pdf.text(ticket.code, stubCx, qrY + qrSize + 4.2, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6);
  pdf.setTextColor(...MUTED);
  pdf.text(
    `TICKET ${ticket.index} OF ${ticket.total}`,
    stubCx,
    qrY + qrSize + 8.2,
    { align: "center" },
  );
}

/**
 * Downloads an A4 PDF with four fixed-height tickets per page. Drawn with
 * vector text (jsPDF Helvetica) so glyphs stay crisp — html2canvas raster
 * capture clipped letters on macOS. Layout matches the boarding-pass sample.
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

  const logoSrc = await loadLogoDataUrl();
  const tickets: DrawnTicket[] = [];
  for (const pass of issued) {
    tickets.push({
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

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const ticketW = PAGE_W - PAD_X * 2;

  for (let i = 0; i < tickets.length; i++) {
    const slot = i % TICKETS_PER_PAGE;
    if (i > 0 && slot === 0) pdf.addPage("a4", "portrait");

    const y = PAD_Y + slot * (TICKET_H + CUT_H);
    if (slot > 0) {
      // Cut guide between tickets
      pdf.setDrawColor(...DASH);
      pdf.setLineWidth(0.3);
      const cutY = y - CUT_H / 2;
      drawDashedLine(pdf, PAD_X, cutY, PAD_X + ticketW, cutY);
    }

    drawTicket(pdf, tickets[i], PAD_X, y, ticketW, TICKET_H, logoSrc);
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
