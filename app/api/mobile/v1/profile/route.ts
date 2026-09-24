import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import {
  PROFILE_COLUMNS,
  PROFILE_COLUMNS_JOINED,
  buildProfileUpdate,
  profilePatchSchema,
  type ProfileRow,
} from "@/lib/mobile/profile";
import { query } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { anonymizeAndDeleteAccount } from "@/lib/auth/delete-account";
import { getSystemConfig } from "@/lib/business-owner/api-utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/profile
 *
 * The authenticated caller's own profile (explicit `id = <caller>` filter).
 * Returns only the allow-listed profile columns.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  // Joined in one round trip - `has_password` is a read-only, derived field
  // (not part of the profiles write allow-list) the delete-account flow needs
  // to pick a password vs. typed-confirm step.
  const { rows } = await query(
    `SELECT ${PROFILE_COLUMNS_JOINED}, au.email AS email, (au.encrypted_password IS NOT NULL) AS has_password
     FROM profiles p
     LEFT JOIN auth.users au ON au.id = p.id
     WHERE p.id = $1`,
    [user.id],
  );
  const profile = rows[0] as (ProfileRow & { email?: string | null; has_password: boolean }) | undefined;

  if (!profile) {
    throw new MobileApiError("not_found", "Profile not found.", 404);
  }

  return ok({ ...profile, has_password: Boolean(profile.has_password) });
});

/**
 * PATCH /api/mobile/v1/profile
 *
 * Partial self-update of the caller's profile. Writes go through a strict
 * server-side column allow-list (`buildProfileUpdate`) - privileged columns
 * (role, points, verification flags) are never representable, so they can't
 * be written. `membership_plan` is gated to business accounts; avatars change
 * via POST /profile/avatar (PATCH can only clear `avatar_url`). Mirrors
 * `app/api/profile` (PUT).
 */
export const PATCH = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const parsed = profilePatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    const issue = parsed.error.errors[0];
    throw new MobileApiError(
      "validation_error",
      issue?.message ?? "Invalid profile update.",
      400,
      issue?.path.join(".") || undefined,
    );
  }

  const { rows: roleRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [user.id],
  );
  const currentRole = roleRows[0]?.role ?? null;

  const update = buildProfileUpdate(parsed.data, currentRole);

  // Username uniqueness (case-insensitive), excluding the caller's own row.
  if (typeof update.username === "string" && update.username) {
    const { rows: takenRows } = await query(
      `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1`,
      [update.username, user.id],
    );
    if (takenRows.length > 0) {
      throw new MobileApiError(
        "validation_error",
        "Username is already taken.",
        400,
        "username",
      );
    }
  }

  // Nothing valid to write (e.g. only a non-business membership_plan) -> no-op.
  if (Object.keys(update).length === 0) {
    const { rows } = await query(
      `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE id = $1`,
      [user.id],
    );
    const profile = rows[0] as ProfileRow | undefined;
    if (!profile) {
      throw new MobileApiError("not_found", "Profile not found.", 404);
    }
    return ok(profile);
  }

  const fields = Object.keys(update) as (keyof typeof update)[];
  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
  const values = fields.map((f) => update[f]);

  let profile: ProfileRow | undefined;
  try {
    const { rows } = await query(
      `UPDATE profiles SET ${setClauses} WHERE id = $1 RETURNING ${PROFILE_COLUMNS}`,
      [user.id, ...values],
    );
    profile = rows[0] as ProfileRow | undefined;
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      throw new MobileApiError(
        "validation_error",
        "Username is already taken.",
        400,
        "username",
      );
    }
    console.error(
      "[mobile-api] profile update failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update profile.",
      500,
    );
  }

  if (!profile) {
    throw new MobileApiError(
      "internal_error",
      "Failed to update profile.",
      500,
    );
  }

  // Parity with the website: award the one-time `profile_complete` XP once name,
  // username, and phone are all present. The activity is configured `once`, so
  // awardXP de-dupes; best-effort - a failure must not fail the update.
  if (profile.full_name && profile.username && profile.phone) {
    try {
      const { awardXP } = await import("@/lib/gamification");
      await awardXP(user.id, "profile_complete");
    } catch (err) {
      console.error("[mobile-api] profile_complete XP award failed:", err);
    }
  }

  return ok(profile);
});

/**
 * DELETE /api/mobile/v1/profile
 *
 * Self-service, permanent account deletion. Anonymizes the caller's profile
 * (name/avatar/phone/bio -> placeholder identity) and disables login, while
 * leaving everything they created (reviews, listings, bookings, points)
 * intact. Mirrors `app/api/profile` (DELETE). Irreversible.
 */
export const DELETE = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const enabled = await getSystemConfig("account_deletion.enabled", "true");
  if (enabled !== "true") {
    throw new MobileApiError(
      "feature_disabled",
      "Account deletion is temporarily unavailable.",
      503,
    );
  }

  const body = await request.json().catch(() => ({}));

  const { rows: authRows } = await query(
    `SELECT encrypted_password FROM auth.users WHERE id = $1 LIMIT 1`,
    [user.id],
  );
  const encryptedPassword = authRows[0]?.encrypted_password as string | undefined;

  if (encryptedPassword) {
    if (
      typeof body.currentPassword !== "string" ||
      !(await verifyPassword(body.currentPassword, encryptedPassword))
    ) {
      throw new MobileApiError(
        "validation_error",
        "Current password is incorrect.",
        400,
        "currentPassword",
      );
    }
  } else if (body.confirmText !== "DELETE") {
    throw new MobileApiError(
      "validation_error",
      'Type "DELETE" to confirm.',
      400,
      "confirmText",
    );
  }

  const result = await anonymizeAndDeleteAccount(user.id, {
    ipAddress:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
  });

  if (!result.success) {
    throw new MobileApiError(
      result.error,
      "Account could not be deleted.",
      409,
    );
  }

  return ok({ deleted: true });
});
