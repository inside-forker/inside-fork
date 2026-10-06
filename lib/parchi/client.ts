/**
 * Server-only HTTP client for Parchi's partner API (`/v1/partners/...`:
 * verification requests + discount redemptions). The partner key must never reach a
 * browser or app bundle - only import this from API routes / lib code.
 *
 * Env:
 *   PARCHI_API_BASE_URL  e.g. https://api.parchipakistan.com (no trailing /v1)
 *   PARCHI_PARTNER_KEY   raw partner key issued by Parchi
 */

export type ParchiStatus = "pending" | "approved" | "rejected" | "expired";

export interface ParchiRequestData {
  requestId: string;
  status: ParchiStatus;
  externalReference: string;
  eventLabel: string | null;
  expiresAt: string;
  createdAt: string;
  approvedAt: string | null;
  partnerName: string;
  matchCode: string | null;
  verifyDeepLink: string;
  verifyWebLink: string;
}

/** A non-2xx (or unreachable) Parchi response. `status` 0 = network/timeout. */
export class ParchiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(`Parchi API responded ${status}`);
    this.name = "ParchiHttpError";
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const TIMEOUT_MS = 8000;

function config() {
  const baseUrl = process.env.PARCHI_API_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.PARCHI_PARTNER_KEY;
  if (!baseUrl || !key) {
    throw new Error("PARCHI_API_BASE_URL / PARCHI_PARTNER_KEY not configured");
  }
  return { baseUrl, key };
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = Number(res.headers.get("retry-after"));
  return Number.isFinite(raw) && raw > 0 ? Math.ceil(raw) : undefined;
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const { baseUrl, key } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/partners${path}`, {
      method,
      headers: { "X-Partner-Key": key, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ParchiHttpError(0);
  }
  if (!res.ok) throw new ParchiHttpError(res.status, parseRetryAfter(res));
  const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return json?.data;
}

async function send(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ParchiRequestData> {
  const data = (await request(
    method,
    `/verification-requests${path}`,
    body,
  )) as ParchiRequestData | undefined;
  if (!data || typeof data.requestId !== "string" || !isUuid(data.requestId)) {
    throw new ParchiHttpError(502);
  }
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs `fn`, retrying 5xx / network failures with 1s, 2s backoff (max 3
 * tries). Only for Parchi POSTs that are idempotent on their side. 4xx is
 * never retried.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof ParchiHttpError && (err.status === 0 || err.status >= 500);
      if (!retryable) throw err;
    }
  }
  throw lastError;
}

/**
 * POST a verification request. Idempotent on (student, externalReference)
 * while pending, so retries are safe.
 */
export async function createParchiRequest(input: {
  parchiId: string;
  externalReference: string;
  eventLabel?: string;
}): Promise<ParchiRequestData> {
  return withRetry(() => send("POST", "", input));
}

/**
 * POST /discount-redemptions - tells Parchi a paid order used the discount.
 * Idempotent on verificationRequestId / externalReference (a repeat returns
 * 200 with the original row), so retries and re-reports are safe.
 */
export async function recordParchiRedemption(input: {
  verificationRequestId: string;
  externalReference: string;
  parchiId: string;
  discountAmountPkr: number;
  orderTotalPkr?: number;
  currency?: string;
  eventLabel?: string;
  paidAt?: string;
}): Promise<{ redemptionId: string }> {
  const data = (await withRetry(() =>
    request("POST", "/discount-redemptions", input),
  )) as { redemptionId?: string } | undefined;
  if (!data?.redemptionId) throw new ParchiHttpError(502);
  return { redemptionId: data.redemptionId };
}

/** GET a request's current status. Not retried - callers poll anyway. */
export async function getParchiRequest(
  requestId: string,
): Promise<ParchiRequestData> {
  if (!isUuid(requestId)) throw new ParchiHttpError(404);
  return send("GET", `/${requestId}`);
}
