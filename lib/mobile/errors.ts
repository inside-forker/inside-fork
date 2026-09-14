/**
 * Typed error for the mobile API (`/api/mobile/v1`). Thrown anywhere inside a
 * handler and translated into the standard error envelope by `mobileRoute`.
 */
export class MobileApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;
  /** Optional extra payload surfaced under `meta` (e.g. `{ retryAfter }`). */
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 400,
    field?: string,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MobileApiError";
    this.code = code;
    this.status = status;
    this.field = field;
    this.meta = meta;
  }
}

/** Shorthands for the error shapes used across the mobile surface. */
export const MobileErrors = {
  notAuthenticated: () =>
    new MobileApiError("not_authenticated", "Authentication required.", 401),
  forbidden: (message = "Forbidden.") =>
    new MobileApiError("forbidden", message, 403),
  notFound: (message = "Not found.") =>
    new MobileApiError("not_found", message, 404),
  badRequest: (message: string, field?: string) =>
    new MobileApiError("validation_error", message, 400, field),
  rateLimited: (retryAfter: number) =>
    new MobileApiError(
      "rate_limited",
      "Too many requests. Please try again later.",
      429,
      undefined,
      { retryAfter },
    ),
};
