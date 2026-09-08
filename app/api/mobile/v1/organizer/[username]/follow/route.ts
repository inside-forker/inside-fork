import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function resolveOrganizerId(username: string): Promise<string> {
  const { rows } = await query(
    `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) LIMIT 1`,
    [username],
  );
  const organizer = rows[0];
  if (!organizer) {
    throw new MobileApiError("not_found", "Organizer not found.", 404);
  }
  return organizer.id as string;
}

/**
 * GET /api/mobile/v1/organizer/{username}/follow
 *
 * Whether the caller follows this organizer. Unauthenticated callers always
 * get `{ following: false }`. Mirrors `GET /api/mobile/v1/favorites`.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { username } = await params;

  const { user } = await getOptionalMobileUser(request);
  if (!user) return ok({ following: false });

  const organizerId = await resolveOrganizerId(username);
  const { rows } = await query(
    `SELECT 1 FROM organizer_follows WHERE follower_id = $1 AND organizer_id = $2 LIMIT 1`,
    [user.id, organizerId],
  );

  return ok({ following: rows.length > 0 });
});

/**
 * POST /api/mobile/v1/organizer/{username}/follow
 *
 * Toggles the caller's follow of this organizer. Following yourself is
 * rejected both here (organizer_id === caller) and by the DB's
 * organizer_follows_no_self check, in case a future caller bypasses this route.
 */
export const POST = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  const { username } = await params;

  const organizerId = await resolveOrganizerId(username);
  if (organizerId === user.id) {
    throw new MobileApiError(
      "validation_error",
      "You can't follow yourself.",
      400,
    );
  }

  const { rows: existing } = await query(
    `SELECT 1 FROM organizer_follows WHERE follower_id = $1 AND organizer_id = $2 LIMIT 1`,
    [user.id, organizerId],
  );

  if (existing.length > 0) {
    await query(
      `DELETE FROM organizer_follows WHERE follower_id = $1 AND organizer_id = $2`,
      [user.id, organizerId],
    );
    return ok({ following: false });
  }

  try {
    await query(
      `INSERT INTO organizer_follows (follower_id, organizer_id) VALUES ($1, $2)`,
      [user.id, organizerId],
    );
  } catch (insError) {
    const pgError = insError as { code?: string };
    if (pgError.code === "23505") return ok({ following: true });
    console.error("[mobile-api] organizer follow insert failed:", insError);
    throw new MobileApiError("internal_error", "Failed to follow organizer.", 500);
  }

  return ok({ following: true });
});
