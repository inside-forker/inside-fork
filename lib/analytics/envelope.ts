/**
 * Web analytics envelope helpers (Phase 1 CORE).
 * Mirrors RN deviceIdStore + analyticsSessionStore: stable install device id
 * and 30-minute inactivity session rotation via localStorage.
 */

const DEVICE_STORAGE_KEY = "inside_analytics_device_id";
const SESSION_STORAGE_KEY = "inside_analytics_session";
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

function generateId(prefix = ""): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const chars = Array.from({ length: 32 }, hex);
  chars[12] = "4";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const s = chars.join("");
  const uuid = `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  return prefix ? `${prefix}${uuid.replace(/-/g, "")}` : uuid;
}

/** Stable browser install id (not an advertising ID). */
export function getWebDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && existing.length > 0 && existing.length <= 256) {
      return existing;
    }
    const next = generateId("dev_");
    window.localStorage.setItem(DEVICE_STORAGE_KEY, next);
    return next;
  } catch {
    return generateId("dev_");
  }
}

type SessionBlob = {
  sessionId: string;
  lastActivityAt: number;
};

/**
 * Groups web analytics events into a visit. Rotates after 30 minutes of
 * inactivity (same convention as mobile).
 */
export function getOrRotateWebSessionId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const now = Date.now();

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionBlob;
      if (
        parsed?.sessionId &&
        typeof parsed.lastActivityAt === "number" &&
        now - parsed.lastActivityAt <= INACTIVITY_TIMEOUT_MS
      ) {
        const refreshed: SessionBlob = {
          sessionId: parsed.sessionId,
          lastActivityAt: now,
        };
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(refreshed));
        return parsed.sessionId;
      }
    }

    const next: SessionBlob = {
      sessionId: generateId(),
      lastActivityAt: now,
    };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
    return next.sessionId;
  } catch {
    return generateId();
  }
}
