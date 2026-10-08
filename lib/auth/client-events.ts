/** Fired after login/signup/logout so chrome can re-read the session. */
export const AUTH_CHANGED_EVENT = "insidekhi:auth-changed";

export function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
