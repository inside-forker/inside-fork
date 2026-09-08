import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePathId } from "@/lib/mobile/params";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/favorites/events?eventId=
 *
 * Whether the caller has favorited an event. Unauthenticated callers always
 * get `{ favorited: false }`. Mirrors `GET /api/mobile/v1/favorites` (listings).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { searchParams } = new URL(request.url);
  const eventId = parsePathId(
    searchParams.get("eventId") ?? undefined,
    "eventId",
  );

  const { user } = await getOptionalMobileUser(request);
  if (!user) return ok({ favorited: false });

  const { rows } = await query(
    `SELECT 1 FROM favorite_events WHERE user_id = $1 AND event_id = $2 LIMIT 1`,
    [user.id, eventId],
  );

  return ok({ favorited: rows.length > 0 });
});

const toggleSchema = z.object({
  eventId: z.number().int().positive(),
});

/**
 * POST /api/mobile/v1/favorites/events
 *
 * Toggles the caller's favorite for an event: inserts if absent (-> favorited),
 * deletes if present (-> unfavorited). Ownership is enforced by the explicit
 * `user_id` filter below (scoped to the caller's own rows). Mirrors
 * `POST /api/mobile/v1/favorites` (listings) semantics; no analytics logging
 * here since `user_listing_events` is listing-scoped by design and there is
 * no event equivalent to write into.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = toggleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new MobileApiError(
      "validation_error",
      "A positive integer eventId is required.",
      400,
      "eventId",
    );
  }
  const { eventId } = parsed.data;

  const { rows: existing } = await query(
    `SELECT 1 FROM favorite_events WHERE user_id = $1 AND event_id = $2 LIMIT 1`,
    [user.id, eventId],
  );

  if (existing.length > 0) {
    await query(
      `DELETE FROM favorite_events WHERE user_id = $1 AND event_id = $2`,
      [user.id, eventId],
    );
    return ok({ favorited: false });
  }

  // Insert branch: the event must exist and be published.
  const { rows: eventRows } = await query(
    `SELECT id FROM events WHERE id = $1 AND status = 'published'`,
    [eventId],
  );
  if (!eventRows[0]) {
    throw new MobileApiError(
      "not_found",
      "Event not found.",
      404,
      "eventId",
    );
  }

  try {
    await query(
      `INSERT INTO favorite_events (user_id, event_id) VALUES ($1, $2)`,
      [user.id, eventId],
    );
  } catch (insError) {
    // Unique-PK violation = a concurrent insert already favorited it.
    const pgError = insError as { code?: string };
    if (pgError.code === "23505") return ok({ favorited: true });
    console.error("[mobile-api] event favorite insert failed:", insError);
    throw new MobileApiError("internal_error", "Failed to add favorite.", 500);
  }

  return ok({ favorited: true });
});
