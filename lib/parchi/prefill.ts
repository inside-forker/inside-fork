/**
 * The Parchi app's "Get tickets" link lands on the event page with
 * `?parchiId=XXX`. We remember it for this tab so checkout can pre-fill the
 * Parchi ID box. Only a convenience: the student still approves in the
 * Parchi app. Client-only; storage can be unavailable, so never throws.
 */
import { useEffect, useState } from "react";

const KEY = "ik:parchi-id";

export function rememberParchiId(raw: string | null): void {
  const id = raw?.trim() ?? "";
  if (!/^[A-Za-z0-9]{1,10}$/.test(id)) return;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // Private mode / blocked storage - the student just types it.
  }
}

export function recallParchiId(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
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
