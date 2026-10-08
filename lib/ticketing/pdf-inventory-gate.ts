import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export const PDF_INVENTORY_UNLOCK_COOKIE = "ik_pdf_inv_unlock";
const UNLOCK_TTL_SECONDS = 60 * 60 * 4; // 4 hours

/** Only this account can see the Ticket PDF inventory page / APIs. */
export const PDF_INVENTORY_ALLOWED_EMAIL = "testadminzaki@gmail.com";

export class PdfInventoryGateError extends Error {
  constructor(
    readonly code:
      | "passcode_required"
      | "passcode_not_configured"
      | "invalid_passcode"
      | "not_found",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfInventoryGateError";
  }
}

export function isPdfInventoryEmailAllowed(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PDF_INVENTORY_ALLOWED_EMAIL;
}

/** Throw a not_found-shaped error so APIs can respond 404 (route "doesn't exist"). */
export function requirePdfInventoryEmailAllowed(
  email: string | null | undefined,
): void {
  if (!isPdfInventoryEmailAllowed(email)) {
    throw new PdfInventoryGateError("not_found", "Not found", 404);
  }
}

function signingSecret(): string {
  return (
    process.env.JWT_SECRET ||
    process.env.TICKET_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  );
}

export function isPdfInventoryPasscodeConfigured(): boolean {
  return Boolean(process.env.TICKET_PDF_INVENTORY_PASSCODE?.trim());
}

/**
 * Timing-safe passcode check. Hashes both sides so length differences
 * don't short-circuit into an easy oracle.
 */
export function verifyPdfInventoryPasscode(input: string): boolean {
  const expected = process.env.TICKET_PDF_INVENTORY_PASSCODE?.trim() ?? "";
  if (!expected) return false;

  const a = crypto
    .createHash("sha256")
    .update(String(input ?? ""), "utf8")
    .digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

function signPayload(payload: string): string {
  const secret = signingSecret();
  if (!secret) {
    throw new PdfInventoryGateError(
      "passcode_not_configured",
      "Unlock signing secret is not configured.",
      503,
    );
  }
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createUnlockCookieValue(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
  const payload = `${userId}|${exp}`;
  const sig = signPayload(payload);
  return `${payload}|${sig}`;
}

export function verifyUnlockCookieValue(
  value: string | undefined | null,
  userId: string,
): boolean {
  if (!value || !userId) return false;
  const parts = value.split("|");
  if (parts.length !== 3) return false;
  const [cookieUserId, expRaw, sig] = parts;
  if (cookieUserId !== userId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const payload = `${cookieUserId}|${expRaw}`;
  let expected: string;
  try {
    expected = signPayload(payload);
  } catch {
    return false;
  }

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function applyUnlockCookie(
  response: NextResponse,
  userId: string,
): void {
  response.cookies.set(
    PDF_INVENTORY_UNLOCK_COOKIE,
    createUnlockCookieValue(userId),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: UNLOCK_TTL_SECONDS,
    },
  );
}

export function clearUnlockCookie(response: NextResponse): void {
  response.cookies.set(PDF_INVENTORY_UNLOCK_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function requirePdfInventoryUnlock(
  request: NextRequest,
  userId: string,
): void {
  if (!isPdfInventoryPasscodeConfigured()) {
    throw new PdfInventoryGateError(
      "passcode_not_configured",
      "Ticket PDF inventory passcode is not configured.",
      503,
    );
  }
  const value = request.cookies.get(PDF_INVENTORY_UNLOCK_COOKIE)?.value;
  if (!verifyUnlockCookieValue(value, userId)) {
    throw new PdfInventoryGateError(
      "passcode_required",
      "Passcode required to access ticket PDF inventory.",
      403,
    );
  }
}

export async function hasPdfInventoryUnlockFromCookies(
  userId: string,
): Promise<boolean> {
  if (!isPdfInventoryPasscodeConfigured()) return false;
  const store = await cookies();
  const value = store.get(PDF_INVENTORY_UNLOCK_COOKIE)?.value;
  return verifyUnlockCookieValue(value, userId);
}

/** Simple per-process rate limit for unlock attempts (fallback when Upstash absent). */
const unlockAttempts = new Map<string, { count: number; resetAt: number }>();

export function consumeUnlockAttempt(
  key: string,
  limit = 8,
  windowMs = 10 * 60 * 1000,
): boolean {
  const now = Date.now();
  const entry = unlockAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    unlockAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
