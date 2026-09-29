// Mirrored in insidekhi-reactnative/src/utils/ticketSheetHtml.ts — keep the two in sync.

export type TicketSheetItem = {
  code: string;
  qrSrc: string;
  eventName: string;
  startTime: string | null;
  endTime?: string | null;
  venueName?: string | null;
  address?: string | null;
  organizer?: string | null;
  ticketType?: string | null;
  guestName?: string | null;
  cnicLast4?: string | null;
  laneLabel?: string | null;
  bookingReference?: string | null;
  index: number;
  total: number;
};

export const TICKETS_PER_PAGE = 4;

const TIME_ZONE = "Asia/Karachi";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Heights are fixed, so long strings are cut here rather than left to CSS
// ellipsis/line-clamp, which html2canvas does not paint.
function clip(value: string | null | undefined, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return escapeHtml(text);
  return `${escapeHtml(text.slice(0, max - 1).trimEnd())}…`;
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

function field(label: string, value: string, sub = "", span = false): string {
  return `<div class="iks-f${span ? " iks-span" : ""}"><div class="iks-l">${label}</div><div class="iks-v">${
    value || "—"
  }</div>${sub ? `<div class="iks-sub">${sub}</div>` : ""}</div>`;
}

function ticketHtml(t: TicketSheetItem, logoSrc: string): string {
  const start = formatTime(t.startTime);
  const end = formatTime(t.endTime);
  const sameDay =
    start && end && formatDate(t.startTime) === formatDate(t.endTime);
  const time = sameDay ? `${start} – ${end}` : start;
  const venue = clip(t.venueName || t.address, 42);
  const address =
    t.venueName && t.address && t.address !== t.venueName
      ? clip(t.address, 56)
      : "";
  const cnic = t.cnicLast4
    ? `CNIC •••••-•••••••-${escapeHtml(t.cnicLast4)}`
    : "";
  const booking = t.bookingReference
    ? `Booking ${clip(t.bookingReference, 24)} · `
    : "";

  return `
<div class="iks-ticket">
  <div class="iks-main">
    <div class="iks-head">
      <div class="iks-title">
        <div class="iks-event">${clip(t.eventName || "Event", 72)}</div>
        ${t.organizer ? `<div class="iks-org">by ${clip(t.organizer, 50)}</div>` : ""}
      </div>
      ${
        t.laneLabel
          ? `<div class="iks-lane"><div class="iks-l">Entry lane</div><div class="iks-lv">${clip(t.laneLabel, 14)}</div></div>`
          : ""
      }
    </div>
    <div class="iks-grid">
      ${field("Date", escapeHtml(formatDate(t.startTime)))}
      ${field("Time", escapeHtml(time))}
      ${field("Ticket", clip(t.ticketType || "General Admission", 24))}
      ${field("Venue", venue, address, true)}
      ${field("Attendee", clip(t.guestName, 20), cnic)}
    </div>
    <div class="iks-foot">
      <span>${booking}One entry per ticket · Non-transferable · Carry a valid ID</span>
      <span>insidekarachi.com</span>
    </div>
  </div>
  <div class="iks-stub">
    <img class="iks-logo" src="${logoSrc}" alt="Inside Karachi" />
    <img class="iks-qr" src="${escapeHtml(t.qrSrc)}" alt="QR" />
    <div class="iks-code">${escapeHtml(t.code)}</div>
    <div class="iks-count">Ticket ${t.index} of ${t.total}</div>
  </div>
</div>`;
}

// Every rule is scoped under .iks-root so the sheet can be mounted inside a live
// web page for html2canvas without leaking into (or inheriting from) site CSS.
export const TICKET_SHEET_STYLES = `
.iks-root, .iks-root * { box-sizing: border-box; margin: 0; padding: 0; border: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.iks-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111827; background: #FFFFFF; line-height: 1.25; text-align: left; }
.iks-page { width: 210mm; height: 296mm; padding: 10mm 12mm; display: flex; flex-direction: column; overflow: hidden; background: #FFFFFF; page-break-after: always; break-after: page; }
.iks-page:last-child { page-break-after: auto; break-after: auto; }
.iks-cut { height: 7mm; flex: none; display: flex; align-items: center; }
.iks-cut > div { flex: 1; border-top: 0.3mm dashed #D1D5DB; }
.iks-ticket { height: 64mm; flex: none; display: flex; border: 0.3mm solid #D9DADD; border-radius: 3mm; overflow: hidden; background: #FFFFFF; }
.iks-main { flex: 1; min-width: 0; padding: 4.5mm 5mm 3.5mm 6mm; display: flex; flex-direction: column; }
.iks-head { display: flex; align-items: flex-start; gap: 4mm; height: 17mm; flex: none; }
.iks-title { flex: 1; min-width: 0; }
.iks-event { font-size: 13pt; font-weight: 800; line-height: 1.18; letter-spacing: -0.2pt; color: #111827; max-height: 10.9mm; overflow: hidden; }
.iks-org { margin-top: 0.6mm; font-size: 7.5pt; color: #6B7280; white-space: nowrap; overflow: hidden; }
.iks-lane { flex: none; min-width: 26mm; padding: 1.6mm 3mm; border: 0.4mm solid #F42354; border-radius: 2mm; text-align: center; }
.iks-lane .iks-l { color: #F42354; }
.iks-lv { font-size: 14pt; font-weight: 800; color: #F42354; line-height: 1.1; white-space: nowrap; }
.iks-grid { flex: 1; display: grid; grid-template-columns: 1fr 1.1fr 1.3fr; grid-auto-rows: min-content; column-gap: 5mm; row-gap: 3mm; padding-top: 3mm; border-top: 0.3mm solid #E9EAEC; }
.iks-f { min-width: 0; }
.iks-span { grid-column: span 2; }
.iks-l { font-size: 6pt; font-weight: 700; letter-spacing: 0.9pt; text-transform: uppercase; color: #9CA3AF; margin-bottom: 0.7mm; }
.iks-v { font-size: 10pt; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; }
.iks-sub { font-size: 7.5pt; color: #6B7280; margin-top: 0.4mm; white-space: nowrap; overflow: hidden; }
.iks-foot { display: flex; justify-content: space-between; gap: 3mm; font-size: 6pt; color: #9CA3AF; white-space: nowrap; overflow: hidden; }
.iks-stub { width: 48mm; flex: none; border-left: 0.4mm dashed #D1D5DB; padding: 4mm 3mm 3mm; display: flex; flex-direction: column; align-items: center; }
.iks-logo { width: 30mm; height: auto; display: block; }
.iks-qr { width: 32mm; height: 32mm; margin-top: 2.6mm; display: block; image-rendering: pixelated; }
.iks-code { margin-top: 1.4mm; font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 8.5pt; font-weight: 800; letter-spacing: 0.6pt; color: #111827; white-space: nowrap; }
.iks-count { margin-top: 0.6mm; font-size: 6.5pt; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.6pt; }
`;

/** One `.iks-page` element per A4 sheet; each holds up to TICKETS_PER_PAGE fixed-height tickets. */
export function buildTicketPagesHtml(
  tickets: TicketSheetItem[],
  logoSrc: string,
): string[] {
  const pages: string[] = [];
  for (let i = 0; i < tickets.length; i += TICKETS_PER_PAGE) {
    const slots = tickets
      .slice(i, i + TICKETS_PER_PAGE)
      .map((t) => ticketHtml(t, logoSrc))
      .join(`<div class="iks-cut"><div></div></div>`);
    pages.push(`<div class="iks-page">${slots}</div>`);
  }
  return pages;
}

export function buildTicketSheetDocument(
  tickets: TicketSheetItem[],
  logoSrc: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>@page { size: A4; margin: 0; } html, body { margin: 0; padding: 0; background: #FFFFFF; }${TICKET_SHEET_STYLES}</style>
</head>
<body><div class="iks-root">${buildTicketPagesHtml(tickets, logoSrc).join("")}</div></body>
</html>`;
}
