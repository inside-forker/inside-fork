import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { query } from "@/lib/db";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import {
  createParchiRequest,
  getParchiRequest,
  isUuid,
  ParchiHttpError,
  type ParchiRequestData,
  type ParchiStatus,
} from "./client";
import { computeParchiDiscount, type ParchiOffer } from "./discount";

export type { ParchiOffer };

/**
 * Parchi student discount - shared by the web (`/api/parchi/*`) and mobile
 * (`/api/mobile/v1/parchi/*`) routes. Each route only handles auth and maps
 * `ParchiServiceError` to its own error envelope.
 *
 * The discount itself is a `coupons` row with `requires_parchi = true`; the
 * booking RPCs redeem it via `claim_parchi_discount` (see
 * sql/migrations/20260930_parchi_student_verification.sql), which is the only
 * authoritative check. Everything here is UX + talking to Parchi.
 */

/** Shopper-safe error: `message` never contains raw Parchi text. */
export class ParchiServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ParchiServiceError";
  }
}

const UNAVAILABLE = () =>
  new ParchiServiceError(
    "parchi_unavailable",
    "Parchi verification is unavailable right now. Please try again later.",
    502,
  );

export interface ParchiVerificationView {
  id: string;
  status: ParchiStatus;
  /** Show large: "Tap {match_code} in your Parchi app". Null once not pending. */
  match_code: string | null;
  /** QR payload (https link, never the parchi:// scheme). */
  verify_web_link: string;
  expires_at: string;
  approved_at: string | null;
  /** True once a booking has consumed this approval. */
  used: boolean;
}

type VerificationRow = {
  request_id: string;
  event_id: string | number;
  parchi_id: string;
  external_reference: string;
  status: ParchiStatus;
  match_code: string | null;
  verify_web_link: string;
  expires_at: Date | string;
  approved_at: Date | string | null;
  booking_id: string | number | null;
};

function toView(row: VerificationRow): ParchiVerificationView {
  return {
    id: row.request_id,
    status: row.status,
    match_code: row.status === "pending" ? row.match_code : null,
    verify_web_link: row.verify_web_link,
    expires_at: new Date(row.expires_at).toISOString(),
    approved_at: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    used: row.booking_id != null,
  };
}

// Keep in step with claim_parchi_discount's 1-hour approval window (a little
// shorter, so we never hand back an approval the RPC is about to refuse).
const APPROVAL_REUSE_MS = 50 * 60 * 1000;

// ---------------------------------------------------------------------------
// Rate limit: our own cap on starting verifications, so shoppers can't probe
// Parchi IDs through us (Parchi also limits failed lookups per partner key).
// ---------------------------------------------------------------------------
let limiter: Ratelimit | null = null;
let limiterInitialized = false;

function getLimiter(): Ratelimit | null {
  if (limiterInitialized) return limiter;
  const configured =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("Parchi rate limiter requires Upstash env in production");
  }
  limiterInitialized = true;
  if (!configured) return null;
  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(6, "10 m"),
    prefix: "@upstash/ratelimit/parchi-start",
  });
  return limiter;
}

async function enforceStartLimit(userId: string): Promise<void> {
  const rl = getLimiter();
  if (!rl) return;
  const result = await rl.limit(`parchi:${userId}`);
  if (!result.success) {
    throw new ParchiServiceError(
      "rate_limited",
      "Too many verification attempts. Please try again in a few minutes.",
      429,
      Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    );
  }
}

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

/** The Parchi discount that applies to this event right now, if any. */
export async function getParchiOffer(
  eventId: number,
): Promise<ParchiOffer | null> {
  const { rows } = await query(
    `SELECT discount_type, discount_value, max_discount_amount
     FROM coupons
     WHERE requires_parchi = true
       AND is_active = true
       AND (event_id IS NULL OR event_id = $1)
       AND (starts_at IS NULL OR starts_at <= NOW())
       AND (ends_at IS NULL OR ends_at >= NOW())
       AND (usage_limit IS NULL OR usage_count < usage_limit)
     ORDER BY event_id NULLS LAST, id
     LIMIT 1`,
    [eventId],
  );
  const row = rows[0];
  if (!row) return null;
  // numeric columns come back from pg as strings.
  return {
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    max_discount_amount:
      row.max_discount_amount != null ? Number(row.max_discount_amount) : null,
  };
}

// ---------------------------------------------------------------------------
// Start / resend
// ---------------------------------------------------------------------------

function parchiErrorOnCreate(err: unknown, route: string): ParchiServiceError {
  if (err instanceof ParchiHttpError) {
    switch (err.status) {
      case 400:
        return new ParchiServiceError(
          "parchi_id_invalid",
          "Please check your Parchi ID and try again.",
          400,
        );
      case 403:
        return new ParchiServiceError(
          "parchi_not_eligible",
          "This Parchi account can't be used for student verification.",
          403,
        );
      case 404:
        return new ParchiServiceError(
          "parchi_id_not_found",
          "We couldn't find that Parchi ID. Please check it and try again.",
          404,
        );
      case 429:
        return new ParchiServiceError(
          "rate_limited",
          "Too many verification attempts. Please wait a moment and try again.",
          429,
          err.retryAfter ?? 30,
        );
    }
  }
  // 401 (bad/revoked key), 5xx after retries, network, or misconfig: our
  // problem, not the shopper's - alert and show a generic message.
  captureRouteError(err, { route, method: "POST", extra: { parchi: "create" } });
  return UNAVAILABLE();
}

function eventLabel(name: string, startTime: Date | string | null): string {
  const date = startTime
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Karachi",
      }).format(new Date(startTime))
    : null;
  const label = date ? `${name} - ${date}` : name;
  return label.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 255);
}

/**
 * Starts (or resends) a Parchi verification for this user + event. Returns an
 * existing fresh approval instead of bothering the student again.
 */
export async function startParchiVerification(input: {
  userId: string;
  eventId: number;
  parchiId: string;
  route: string;
}): Promise<ParchiVerificationView> {
  const parchiId = input.parchiId.trim();
  if (!/^[A-Za-z0-9]{1,10}$/.test(parchiId)) {
    throw new ParchiServiceError(
      "parchi_id_invalid",
      "Parchi ID should be up to 10 letters or numbers.",
      400,
    );
  }

  const { rows: eventRows } = await query(
    `SELECT name, start_time FROM events WHERE id = $1`,
    [input.eventId],
  );
  const event = eventRows[0];
  if (!event) {
    throw new ParchiServiceError("not_found", "Event not found.", 404);
  }
  if (!(await getParchiOffer(input.eventId))) {
    throw new ParchiServiceError(
      "parchi_not_offered",
      "The Parchi student discount isn't available for this event.",
      400,
    );
  }

  const { rows: prevRows } = await query(
    `SELECT * FROM parchi_verifications
     WHERE user_id = $1 AND event_id = $2 AND parchi_id = $3 AND booking_id IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.userId, input.eventId, parchiId],
  );
  const prev = prevRows[0] as VerificationRow | undefined;

  if (
    prev?.status === "approved" &&
    prev.approved_at &&
    Date.now() - new Date(prev.approved_at).getTime() < APPROVAL_REUSE_MS
  ) {
    return toView(prev);
  }

  await enforceStartLimit(input.userId);

  // Reusing the reference while pending returns the same Parchi request
  // (safe retry); after expiry it's how "Resend" opens a fresh one. A
  // rejection gets a new reference.
  const externalReference =
    prev && (prev.status === "pending" || prev.status === "expired")
      ? prev.external_reference
      : `ik_chk_${crypto.randomUUID()}`;

  let data: ParchiRequestData;
  try {
    data = await createParchiRequest({
      parchiId,
      externalReference,
      eventLabel: eventLabel(event.name, event.start_time),
    });
  } catch (err) {
    throw parchiErrorOnCreate(err, input.route);
  }

  const { rows } = await query(
    `INSERT INTO parchi_verifications
       (request_id, user_id, event_id, parchi_id, external_reference, status,
        match_code, verify_web_link, expires_at, approved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (request_id) DO UPDATE SET
       status = EXCLUDED.status,
       match_code = EXCLUDED.match_code,
       expires_at = EXCLUDED.expires_at,
       approved_at = EXCLUDED.approved_at,
       updated_at = now()
     WHERE parchi_verifications.user_id = EXCLUDED.user_id
     RETURNING *`,
    [
      data.requestId,
      input.userId,
      input.eventId,
      parchiId,
      externalReference,
      data.status,
      data.matchCode,
      data.verifyWebLink,
      data.expiresAt,
      data.status === "approved" ? (data.approvedAt ?? new Date().toISOString()) : null,
    ],
  );
  if (!rows[0]) throw UNAVAILABLE();
  return toView(rows[0] as VerificationRow);
}

// ---------------------------------------------------------------------------
// Poll
// ---------------------------------------------------------------------------

/**
 * Current status for the shopper's own request. Terminal statuses are served
 * from our DB; pending ones are refreshed from Parchi. A transient Parchi
 * failure returns the last known state so the client just keeps polling.
 */
export async function refreshParchiVerification(input: {
  userId: string;
  requestId: string;
  route: string;
}): Promise<ParchiVerificationView> {
  const notFound = new ParchiServiceError(
    "not_found",
    "Verification not found.",
    404,
  );
  if (!isUuid(input.requestId)) throw notFound;

  const { rows } = await query(
    `SELECT * FROM parchi_verifications WHERE request_id = $1 AND user_id = $2`,
    [input.requestId, input.userId],
  );
  const row = rows[0] as VerificationRow | undefined;
  if (!row) throw notFound;
  if (row.status !== "pending") return toView(row);

  let data: ParchiRequestData;
  try {
    data = await getParchiRequest(row.request_id);
  } catch (err) {
    const transient =
      err instanceof ParchiHttpError &&
      (err.status === 0 || err.status === 429 || err.status >= 500);
    if (!transient) {
      captureRouteError(err, { route: input.route, method: "GET", extra: { parchi: "status" } });
    }
    return toView(row);
  }

  const { rows: updated } = await query(
    `UPDATE parchi_verifications SET
       status = $2,
       match_code = $3,
       expires_at = $4,
       approved_at = COALESCE(approved_at, $5),
       updated_at = now()
     WHERE request_id = $1
     RETURNING *`,
    [
      row.request_id,
      data.status,
      data.status === "pending" ? data.matchCode : null,
      data.expiresAt,
      data.status === "approved" ? (data.approvedAt ?? new Date().toISOString()) : null,
    ],
  );
  return toView(updated[0] as VerificationRow);
}

// ---------------------------------------------------------------------------
// Checkout (web) - non-authoritative preview
// ---------------------------------------------------------------------------

/**
 * The web booking RPC takes a fee-inclusive total from the API layer, so the
 * route needs the discount before calling it. The RPC re-derives it under
 * row locks and rejects a mismatch; this is only for computing fees.
 */
export async function previewParchiDiscount(input: {
  userId: string;
  eventId: number;
  requestId: string;
  subtotal: number;
}): Promise<number> {
  const invalid = new ParchiServiceError(
    "parchi_invalid",
    "Your Parchi verification is no longer valid. Please verify again.",
    400,
  );
  if (!isUuid(input.requestId)) throw invalid;
  const { rows } = await query(
    `SELECT status, event_id, booking_id FROM parchi_verifications
     WHERE request_id = $1 AND user_id = $2`,
    [input.requestId, input.userId],
  );
  const row = rows[0];
  if (
    !row ||
    row.status !== "approved" ||
    Number(row.event_id) !== input.eventId ||
    row.booking_id != null
  ) {
    throw invalid;
  }
  const offer = await getParchiOffer(input.eventId);
  if (!offer) {
    throw new ParchiServiceError(
      "parchi_not_offered",
      "The Parchi student discount isn't available for this event.",
      400,
    );
  }
  return computeParchiDiscount(offer, input.subtotal);
}
