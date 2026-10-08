/**
 * Durable Parchi-channel cookie — set client-side when the visitor arrives from
 * the Parchi app. Survives login (unlike ik_from_parchi attribution cookie).
 */
export const PARCHI_CHANNEL_COOKIE = "ik_parchi_channel";

export function readParchiChannelCookie(
  cookieHeader: string | null | undefined,
): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === PARCHI_CHANNEL_COOKIE) {
      const value = rest.join("=");
      try {
        return decodeURIComponent(value) === "1";
      } catch {
        return value === "1";
      }
    }
  }
  return false;
}
