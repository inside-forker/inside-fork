/** Checkout formatters - same as the app's (src/components/checkout/checkoutConfig.ts). */

export function formatPkr(value: number): string {
  return `PKR ${Math.round(value).toLocaleString()}`;
}

/** "42101-1234567-1", built up as the buyer types. */
export function formatCnic(raw: string): string {
  let val = raw.replace(/\D/g, "");
  if (val.length > 13) val = val.slice(0, 13);
  if (val.length > 12) {
    val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12);
  } else if (val.length > 5) {
    val = val.slice(0, 5) + "-" + val.slice(5);
  }
  return val;
}

/** "0300-1234567", built up as the buyer types. */
export function formatPhone(raw: string): string {
  let val = raw.replace(/\D/g, "");
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 4) val = val.slice(0, 4) + "-" + val.slice(4);
  return val;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** "FRI 23 OCT · 11:00 AM" in Karachi time, for the ticket's poster band. */
export function formatEventWhen(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Karachi",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi",
  }).format(date);
  return `${day} · ${time}`.toUpperCase();
}
