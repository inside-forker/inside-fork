import { randomBytes } from "crypto";

/** Short-lived human-readable redemption code (e.g. RD-A7K2MQ9P). */
export function generateRedemptionCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return `RD-${out}`;
}

export const REDEMPTION_CODE_TTL_MS = 15 * 60 * 1000;
