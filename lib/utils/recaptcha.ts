// reCAPTCHA v3 verification. Fail-closed in production; missing tokens allowed in dev.
// Site key is public — prefer NEXT_PUBLIC_*, fall back to RECAPTCHA_V3_SITE_KEY for
// runtime injection when the public var was not present at client-bundle build time.

const GOOGLE_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export const RECAPTCHA_MIN_SCORE = 0.45;

/** Public v3 site key from env (safe to expose to the browser). */
export function getRecaptchaSiteKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY?.trim() ||
    process.env.RECAPTCHA_V3_SITE_KEY?.trim() ||
    "";
  return key || undefined;
}

export type RecaptchaFailureReason =
  | "missing_token"
  | "missing_secret"
  | "verify_failed"
  | "low_score"
  | "verify_error";

export type RecaptchaVerifyResult =
  | { ok: true; score: number | null; action: string | null }
  | {
      ok: false;
      reason: RecaptchaFailureReason;
      status: number;
      errorCodes?: string[];
      score?: number | null;
      message: string;
    };

interface GoogleSiteverifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

interface VerifyOptions {
  /** The token from `grecaptcha.execute` on the client. */
  token: string | undefined | null;
  /** Logical action label used both client- and server-side for log correlation. */
  action: string;
  /** Override the minimum acceptable v3 score (0.0-1.0). */
  minScore?: number;
}

/**
 * In production, callers should treat any non-`ok` result as a hard failure
 * and return the included `status` and `message` to the client. In
 * development, callers may choose to log and continue.
 */
export async function verifyRecaptcha(
  opts: VerifyOptions,
): Promise<RecaptchaVerifyResult> {
  const isDev = process.env.NODE_ENV === "development";
  const minScore = opts.minScore ?? RECAPTCHA_MIN_SCORE;
  const token = (opts.token || "").trim();

  if (!token) {
    // Clients cannot mint tokens without a site key. If it is missing from env,
    // requiring a token bricks every form (signup, contact, newsletter, …).
    if (!getRecaptchaSiteKey()) {
      console.error(
        `[reCAPTCHA] site key not configured; allowing request without token (action=${opts.action})`,
      );
      return { ok: true, score: null, action: null };
    }
    if (isDev) {
      console.warn(
        `[reCAPTCHA] missing token for action=${opts.action} (allowed in development)`,
      );
      return { ok: true, score: null, action: null };
    }
    return {
      ok: false,
      reason: "missing_token",
      status: 400,
      message: "reCAPTCHA token missing",
    };
  }

  const secret = process.env.RECAPTCHA_V3_SECRET_KEY;
  if (!secret) {
    console.error(
      `[reCAPTCHA] RECAPTCHA_V3_SECRET_KEY is not configured (action=${opts.action})`,
    );
    if (isDev) {
      return { ok: true, score: null, action: null };
    }
    return {
      ok: false,
      reason: "missing_secret",
      status: 500,
      message: "reCAPTCHA is not configured",
    };
  }

  let data: GoogleSiteverifyResponse;
  try {
    const res = await fetch(GOOGLE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    data = (await res.json()) as GoogleSiteverifyResponse;
  } catch (err) {
    console.error(
      `[reCAPTCHA] siteverify network error (action=${opts.action})`,
      err,
    );
    if (isDev) {
      return { ok: true, score: null, action: null };
    }
    return {
      ok: false,
      reason: "verify_error",
      status: 502,
      message: "reCAPTCHA verification temporarily unavailable",
    };
  }

  const score = typeof data.score === "number" ? data.score : null;
  const errorCodes = Array.isArray(data["error-codes"])
    ? data["error-codes"]
    : undefined;

  if (!data.success) {
    console.warn(
      `[reCAPTCHA] verify failed action=${opts.action} score=${score ?? "n/a"} errorCodes=${(errorCodes || []).join(",") || "none"} hostname=${data.hostname ?? "n/a"}`,
    );
    if (isDev) {
      return { ok: true, score, action: data.action ?? null };
    }
    return {
      ok: false,
      reason: "verify_failed",
      status: 400,
      errorCodes,
      score,
      message: "Failed reCAPTCHA verification",
    };
  }

  if (score !== null && score < minScore) {
    console.warn(
      `[reCAPTCHA] low score action=${opts.action} score=${score} minScore=${minScore} hostname=${data.hostname ?? "n/a"}`,
    );
    if (isDev) {
      return { ok: true, score, action: data.action ?? null };
    }
    return {
      ok: false,
      reason: "low_score",
      status: 400,
      score,
      message: "Failed reCAPTCHA verification",
    };
  }

  // Success. Log at debug level for trace correlation.
  if (isDev) {
    console.info(
      `[reCAPTCHA] ok action=${opts.action} score=${score ?? "n/a"}`,
    );
  }
  return { ok: true, score, action: data.action ?? null };
}
