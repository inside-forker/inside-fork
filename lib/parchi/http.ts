import { NextResponse } from "next/server";
import { MobileApiError } from "@/lib/mobile/errors";
import { ParchiServiceError } from "./service";

/** Maps a ParchiServiceError into the mobile API's error envelope. */
export function toMobileApiError(err: unknown): unknown {
  if (!(err instanceof ParchiServiceError)) return err;
  return new MobileApiError(
    err.code,
    err.message,
    err.status,
    undefined,
    err.retryAfter ? { retryAfter: err.retryAfter } : undefined,
  );
}

/** Web routes' `{ error, error_code }` shape for a thrown Parchi error. */
export function parchiWebErrorResponse(
  err: unknown,
  route: string,
): NextResponse {
  if (err instanceof ParchiServiceError) {
    return NextResponse.json(
      { error: err.message, error_code: err.code },
      {
        status: err.status,
        headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined,
      },
    );
  }
  console.error(`[parchi] ${route} failed:`, err);
  return NextResponse.json(
    { error: "Something went wrong.", error_code: "internal_error" },
    { status: 500 },
  );
}
