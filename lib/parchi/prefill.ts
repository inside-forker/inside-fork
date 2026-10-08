/**
 * The Parchi app's "Get tickets" link lands on the event page with
 * `?ref=parchi_app` and usually `?parchiId=XXX`.
 *
 * - `parchiId` is remembered so checkout can pre-fill the Parchi ID box.
 * - A durable "Parchi channel" flag survives login so we never show Inside's
 *   automatic Prismfest slash / auto-discount to Parchi-app visitors.
 *
 * Client-only; storage can be unavailable, so never throws.
 */
import { useEffect, useState } from "react";
import { PARCHI_CHANNEL_COOKIE } from "@/lib/parchi/channel";

const KEY = "ik:parchi-id";
const CHANNEL_KEY = "ik:parchi-channel";
const LOCAL_TTL_MS = 24 * 60 * 60 * 1000;
// Read server-side on the next sign-up / sign-in (lib/parchi/attribution.ts).
const ARRIVAL_COOKIE = "ik_from_parchi";
const ARRIVAL_MAX_AGE_S = 30 * 24 * 60 * 60;

export { PARCHI_CHANNEL_COOKIE };

function readBrowserCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return rest.join("=");
      }
    }
  }
  return null;
}

/** Mark this browser as a Parchi-app visitor for pricing/branding. */
export function markParchiChannel(): void {
  try {
    sessionStorage.setItem(CHANNEL_KEY, "1");
  } catch {
    // fall through
  }
  try {
    localStorage.setItem(
      CHANNEL_KEY,
      JSON.stringify({ at: Date.now() }),
    );
  } catch {
    // blocked storage
  }
  document.cookie = `${PARCHI_CHANNEL_COOKIE}=1; Max-Age=${ARRIVAL_MAX_AGE_S}; Path=/; SameSite=None; Secure`;
}

export function recallParchiChannel(): boolean {
  try {
    if (sessionStorage.getItem(CHANNEL_KEY) === "1") return true;
  } catch {
    // fall through
  }
  try {
    const saved = JSON.parse(localStorage.getItem(CHANNEL_KEY) ?? "null") as {
      at?: number;
    } | null;
    if (saved?.at && Date.now() - saved.at < LOCAL_TTL_MS) return true;
  } catch {
    // unreadable
  }
  return readBrowserCookie(PARCHI_CHANNEL_COOKIE) === "1";
}

/** Wipe sticky Parchi channel (storage + cookie) for IK / local testing. */
export function clearParchiChannel(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CHANNEL_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(CHANNEL_KEY);
  } catch {
    // ignore
  }
  // Clear both cookie variants (localhost Lax vs production Secure).
  document.cookie = `${PARCHI_CHANNEL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.cookie = `${PARCHI_CHANNEL_COOKIE}=; Max-Age=0; Path=/; SameSite=None; Secure`;
}

/**
 * Call on event pages: if the URL says we came from Parchi, persist channel
 * (+ optional Parchi ID). `?ref=inside` / `?ref=clear` clears sticky channel.
 * Safe to call repeatedly.
 */
export function captureParchiArrivalFromUrl(
  search: string | URLSearchParams = typeof window !== "undefined"
    ? window.location.search
    : "",
): void {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const ref = (params.get("ref") ?? "").trim().toLowerCase();
  if (ref === "inside" || ref === "ik" || ref === "clear") {
    clearParchiChannel();
    return;
  }
  const parchiId = params.get("parchiId");
  if (ref === "parchi_app" || ref === "parchi" || (parchiId && /^[A-Za-z0-9]{1,10}$/.test(parchiId.trim()))) {
    markParchiChannel();
  }
  if (parchiId) rememberParchiId(parchiId);
}

export function rememberParchiId(raw: string | null): void {
  const id = raw?.trim() ?? "";
  if (!/^[A-Za-z0-9]{1,10}$/.test(id)) return;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // Private mode / blocked storage - fall through to localStorage.
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    // Blocked storage - the student just types it.
  }
  // "Came from Parchi" marker for the next sign-up / sign-in. SameSite=None
  // so Apple's cross-site form_post callback still carries it.
  document.cookie = `${ARRIVAL_COOKIE}=${encodeURIComponent(id)}; Max-Age=${ARRIVAL_MAX_AGE_S}; Path=/; SameSite=None; Secure`;
  // Having a Parchi ID in the link also implies the Parchi channel.
  markParchiChannel();
}

export function recallParchiId(): string {
  try {
    const id = sessionStorage.getItem(KEY);
    if (id) return id;
  } catch {
    // Fall through to localStorage.
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      id?: string;
      at?: number;
    } | null;
    if (saved?.id && saved.at && Date.now() - saved.at < LOCAL_TTL_MS) {
      return saved.id;
    }
  } catch {
    // Unreadable - treat as not remembered.
  }
  return "";
}

/**
 * True when this visitor came from the Parchi app (`ref=parchi_app` and/or
 * `parchiId`). Survives login so Parchi visitors never get Inside's auto slash.
 */
export function useArrivedFromParchi(): boolean {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    captureParchiArrivalFromUrl();
    setArrived(recallParchiChannel());
  }, []);
  // Re-read when the tab becomes visible again (e.g. after clearing via
  // another tab / ?ref=inside navigation in the same session).
  useEffect(() => {
    const sync = () => setArrived(recallParchiChannel());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);
  return arrived;
}
