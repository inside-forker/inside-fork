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

/** Hero-style { date, time } range in Karachi time. */
export function formatEventDateTimeRange(
  startIso: string,
  endIso: string,
): { date: string; time: string } {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || !end) return { date: "", time: "" };

  const startDay = dateShort.format(start);
  const endDay = dateShort.format(end);
  const sameDay = startDay === endDay;

  return {
    date: sameDay ? startDay : `${startDay} - ${endDay}`,
    time: `${timeFmt.format(start)} - ${timeFmt.format(end)}`,
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
