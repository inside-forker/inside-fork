/**
 * Server-only HTTP client for Parchi's partner verification API
 * (`/v1/partners/verification-requests`). The partner key must never reach a
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

async function send(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ParchiRequestData> {
  const { baseUrl, key } = config();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/partners/verification-requests${path}`, {
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

  const json = (await res.json().catch(() => null)) as {
    data?: ParchiRequestData;
  } | null;
  const data = json?.data;
  if (!data || typeof data.requestId !== "string" || !isUuid(data.requestId)) {
    throw new ParchiHttpError(502);
  }
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST a verification request. Retries 5xx / network failures with 1s, 2s
 * backoff (max 3 tries) - safe because Parchi is idempotent on
 * (student, externalReference) while pending. 4xx is never retried.
 */
export async function createParchiRequest(input: {
  parchiId: string;
  externalReference: string;
  eventLabel?: string;
}): Promise<ParchiRequestData> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      return await send("POST", "", input);
    } catch (err) {
      lastError = err;
      const retryable =
        err instanceof ParchiHttpError && (err.status === 0 || err.status >= 500);
      if (!retryable) throw err;
    }
  }
  throw lastError;
}

/** GET a request's current status. Not retried - callers poll anyway. */
export async function getParchiRequest(
  requestId: string,
): Promise<ParchiRequestData> {
  if (!isUuid(requestId)) throw new ParchiHttpError(404);
  return send("GET", `/${requestId}`);
}
