/**
 * Event datetimes are stored as timestamptz; product local is Asia/Karachi.
 * Always format in that zone so SSR (UTC servers) and browsers agree.
 */

export const EVENT_TIME_ZONE = "Asia/Karachi";

const dateLong = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: EVENT_TIME_ZONE,
});

const dateShort = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: EVENT_TIME_ZONE,
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: EVENT_TIME_ZONE,
});

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Friday, October 23, 2026" */
export function formatEventDateLong(iso: string): string {
  const d = parse(iso);
  return d ? dateLong.format(d) : "";
}

/** "Fri, Oct 23, 2026" */
export function formatEventDateShort(iso: string): string {
  const d = parse(iso);
  return d ? dateShort.format(d) : "";
}

/** "5:00 PM" */
export function formatEventTime(iso: string): string {
  const d = parse(iso);
  return d ? timeFmt.format(d) : "";
}

const tileParts = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  weekday: "short",
  timeZone: EVENT_TIME_ZONE,
});

/** Calendar-tile pieces in Karachi time: { month: "NOV", day: "15", weekday: "Sat" }. */
export function formatEventDateTile(iso: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const d = parse(iso);
  if (!d) return { month: "", day: "", weekday: "" };
  const parts = tileParts.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { month: get("month").toUpperCase(), day: get("day"), weekday: get("weekday") };
}

const dayParts = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  weekday: "long",
  hour: "numeric",
  hourCycle: "h23",
  timeZone: EVENT_TIME_ZONE,
});

const clockFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: EVENT_TIME_ZONE,
});

interface KarachiDay {
  /** Days since the epoch, for comparing calendar days. */
  index: number;
  day: string;
  month: string;
  weekday: string;
  hour: number;
}

function karachiDay(d: Date): KarachiDay {
  const parts = dayParts.formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const year = Number(get("year"));
  const monthIndex = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(get("month"));
  const day = get("day");
  return {
    index: Math.round(Date.UTC(year, monthIndex, Number(day)) / 86_400_000),
    day,
    month: get("month"),
    weekday: get("weekday"),
    hour: Number(get("hour")),
  };
}

/** "5:00 PM" (no leading zero). */
export function formatEventClock(iso: string): string {
  const d = parse(iso);
  return d ? clockFmt.format(d) : "";
}

/** "28 Nov" */
export function formatEventDayMonth(iso: string): string {
  const d = parse(iso);
  if (!d) return "";
  const k = karachiDay(d);
  return `${k.day} ${k.month}`;
}

/** "Saturday, 21 Nov · 5:00 PM" */
export function formatEventWhen(iso: string): string {
  const d = parse(iso);
  if (!d) return "";
  const k = karachiDay(d);
  return `${k.weekday}, ${k.day} ${k.month} · ${clockFmt.format(d)}`;
}

export interface EventFacts {
  /** "28 Nov", "28 – 29 Nov" or "30 Nov – 2 Dec". */
  date: string;
  /** "Saturday" or "Sat – Sun". */
  dateSub: string;
  /** "4:00 PM" */
  time: string;
  /** "to 12:00 AM", or "" without an end time. */
  timeSub: string;
  /** "Sat, 28 Nov · 4:00 PM" (or the date range on multi-day events). */
  summary: string;
}

/**
 * The Date / Time strip under the event title, in Karachi time. An event that
 * ends before 6 AM the next morning still counts as one night out.
 */
export function formatEventFacts(startIso: string, endIso: string): EventFacts {
  const start = parse(startIso);
  if (!start) return { date: "", dateSub: "", time: "", timeSub: "", summary: "" };
  const end = parse(endIso);
  const s = karachiDay(start);
  const time = clockFmt.format(start);
  const timeSub = end ? `to ${clockFmt.format(end)}` : "";

  const e = end ? karachiDay(end) : null;
  const spanDays = e ? e.index - s.index : 0;
  const multiDay = e != null && (spanDays > 1 || (spanDays === 1 && e.hour >= 6));

  if (!multiDay || !e) {
    const date = `${s.day} ${s.month}`;
    return {
      date,
      dateSub: s.weekday,
      time,
      timeSub,
      summary: `${s.weekday.slice(0, 3)}, ${date} · ${time}`,
    };
  }

  const date =
    s.month === e.month ? `${s.day} – ${e.day} ${e.month}` : `${s.day} ${s.month} – ${e.day} ${e.month}`;
  return {
    date,
    dateSub: `${s.weekday.slice(0, 3)} – ${e.weekday.slice(0, 3)}`,
    time,
    timeSub,
    summary: `${date} · ${time}`,
  };
}

/**
 * <input type="datetime-local"> values carry no zone. Treat them as Karachi
 * wall clock (PKT is fixed +05:00, no DST) instead of browser/server local.
 */
const KARACHI_OFFSET = "+05:00";
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Stored ISO → "2026-10-24T17:00" (Karachi wall clock) for datetime-local. */
export function toKarachiInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parse(iso);
  return d ? new Date(d.getTime() + KARACHI_OFFSET_MS).toISOString().slice(0, 16) : "";
}

/** datetime-local value (Karachi wall clock) → UTC ISO string for the API. */
export function fromKarachiInput(value: string | null | undefined): string {
  if (!value) return "";
  // Already zoned (e.g. a stored ISO passed straight through) — keep as is.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const d = parse(value);
    return d ? d.toISOString() : "";
  }
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const d = parse(`${withSeconds}${KARACHI_OFFSET}`);
  return d ? d.toISOString() : "";
}
