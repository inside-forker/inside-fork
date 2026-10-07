/**
 * The Parchi app's "Get tickets" link lands on the event page with
 * `?parchiId=XXX`. We remember it so checkout can pre-fill the Parchi ID box.
 * Only a convenience: the student still approves in the Parchi app.
 *
 * Kept in sessionStorage (this tab) and, for a day, in localStorage: some
 * in-app browsers drop the tab's sessionStorage between the event page and
 * checkout. Client-only; storage can be unavailable, so never throws.
 */
import { useEffect, useState } from "react";

const KEY = "ik:parchi-id";
const LOCAL_TTL_MS = 24 * 60 * 60 * 1000;
// Read server-side on the next sign-up / sign-in (lib/parchi/attribution.ts).
const ARRIVAL_COOKIE = "ik_from_parchi";
const ARRIVAL_MAX_AGE_S = 30 * 24 * 60 * 60;

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
 * True when this visitor came from the Parchi app (a `?parchiId=` now, or
 * earlier in this tab). Used to preview the Parchi price on the event page -
 * the discount itself still needs approval in the Parchi app at checkout.
 */
export function useArrivedFromParchi(): boolean {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    rememberParchiId(new URLSearchParams(window.location.search).get("parchiId"));
    setArrived(recallParchiId() !== "");
  }, []);
  return arrived;
}
