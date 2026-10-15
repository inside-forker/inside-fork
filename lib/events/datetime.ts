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
