/**
 * The Parchi app's "Get tickets" link lands on the event page with
 * `?parchiId=XXX`. We remember it for this tab so checkout can pre-fill the
 * Parchi ID box. Only a convenience: the student still approves in the
 * Parchi app. Client-only; storage can be unavailable, so never throws.
 */
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
