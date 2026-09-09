/**
 * Shared helpers for the mobile profile/account endpoints.
 *
 * The `profiles` UPDATE RLS policy is row-level only (`auth.uid() = id`) with NO
 * column restriction, and only `role` has a blocking self-escalation trigger -
 * every other privileged column (`active_role`, `points`, `is_verified_organizer`,
 * `email_verified_at`, `referred_by`, ...) relies entirely on this allow-list. So a
 * profile-write MUST apply the allow-list and never pass the request body through
 * to `.update()`. `buildProfileUpdate` is that allow-list; privileged columns are
 * simply not representable in its input.
 */
import { z } from "zod";
import type { Database } from "@/types/database";
import { MobileApiError } from "./errors";

/**
 * Columns returned by GET /profile and the PATCH /profile response. The select
 * string and the `ProfileRow` type are both derived from this one key list, so
 * they can't drift apart.
 */
export const PROFILE_COLUMN_KEYS = [
  "id",
  "full_name",
  "username",
  "avatar_url",
  "phone",
  "role",
  "active_role",
  "points",
  "membership_plan",
  "organizer_bio",
  "organizer_company",
  "organizer_website",
  "is_verified_organizer",
  "home_area_label",
  "age_band",
  "declared_interests",
  "created_at",
  "updated_at",
] as const;

export const PROFILE_COLUMNS = PROFILE_COLUMN_KEYS.join(", ");

/** Same columns, `p.`-prefixed for GET /profile's join against `auth.users`. */
export const PROFILE_COLUMNS_JOINED = PROFILE_COLUMN_KEYS.map((k) => `p.${k}`).join(", ");

type ProfileBase = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  | "id"
  | "full_name"
  | "username"
  | "avatar_url"
  | "phone"
  | "role"
  | "active_role"
  | "points"
  | "membership_plan"
  | "organizer_bio"
  | "organizer_company"
  | "organizer_website"
  | "is_verified_organizer"
  | "created_at"
  | "updated_at"
>;

export type ProfileRow = ProfileBase & {
  home_area_label: string | null;
  age_band: string | null;
  declared_interests: string[] | null;
};

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const MEMBERSHIP_PLANS = ["basic", "premium", "enterprise"];

/**
 * Pakistan phone validation - ported from `app/api/profile` so the mobile rules
 * match the website exactly.
 */
export function isValidPakistanPhone(phone: string): boolean {
  const c = phone.replace(/\D/g, "");
  if (c.length === 13 && c.startsWith("92")) return true;
  if (c.length === 12 && c.startsWith("92")) return true;
  if (c.length === 11 && c.startsWith("03")) return true;
  if (
    c.length >= 10 &&
    c.length <= 11 &&
    (c.startsWith("021") || c.startsWith("042") || c.startsWith("051"))
  )
    return true;
  return false;
}

/**
 * The fields a client may change via PATCH /profile. `avatar_url` accepts only
 * `null` (to clear the picture) - setting an avatar goes through the validated
 * upload at POST /profile/avatar, never an arbitrary client-supplied URL. Unknown
 * keys are stripped (zod default), and the update object is built field-by-field
 * below, so privileged columns can never be written.
 */
export const profilePatchSchema = z.object({
  full_name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.null().optional(),
  organizer_bio: z.string().nullable().optional(),
  organizer_company: z.string().nullable().optional(),
  organizer_website: z.string().nullable().optional(),
  membership_plan: z.string().nullable().optional(),
  home_area_label: z.string().nullable().optional(),
  age_band: z.string().nullable().optional(),
  declared_interests: z.array(z.string()).nullable().optional(),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;

export type ProfileUpdate = Partial<{
  full_name: string | null;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  organizer_bio: string | null;
  organizer_company: string | null;
  organizer_website: string | null;
  membership_plan: string | null;
  home_area_label: string | null;
  age_band: string | null;
  declared_interests: string[] | null;
}>;

function invalid(message: string, field: string): MobileApiError {
  return new MobileApiError("validation_error", message, 400, field);
}

/**
 * Validates + normalizes a PATCH body into a column-scoped update object,
 * mirroring the website's rules. `currentRole` gates `membership_plan` to
 * business accounts. Throws `validation_error` (400, with `field`) on bad input.
 * Username uniqueness is checked separately by the caller (needs a DB query).
 */
export function buildProfileUpdate(
  input: ProfilePatchInput,
  currentRole: string | null,
): ProfileUpdate {
  const update: ProfileUpdate = {};

  if (input.full_name !== undefined) {
    const v = input.full_name?.trim() ?? "";
    if (v.length > 100)
      throw invalid("Full name must be 100 characters or fewer.", "full_name");
    update.full_name = v || null;
  }

  if (input.username !== undefined) {
    const v = input.username?.trim().toLowerCase() ?? "";
    if (v && !USERNAME_RE.test(v)) {
      throw invalid(
        "Username must be 3–30 characters: letters, numbers, and underscores only.",
        "username",
      );
    }
    update.username = v || null;
  }

  if (input.phone !== undefined) {
    const v = input.phone?.trim() ?? "";
    if (v && !isValidPakistanPhone(v)) {
      throw invalid("Please enter a valid Pakistan phone number.", "phone");
    }
    update.phone = v || null;
  }

  // Clear-only: a non-null avatar_url is rejected by the schema; here null clears it.
  if (input.avatar_url !== undefined) update.avatar_url = null;

  if (input.organizer_company !== undefined) {
    const v = input.organizer_company?.trim() ?? "";
    if (v.length > 100)
      throw invalid(
        "Company name must be 100 characters or fewer.",
        "organizer_company",
      );
    update.organizer_company = v || null;
  }

  if (input.organizer_bio !== undefined) {
    const v = input.organizer_bio?.trim() ?? "";
    if (v.length > 500)
      throw invalid("Bio must be 500 characters or fewer.", "organizer_bio");
    update.organizer_bio = v || null;
  }

  if (input.organizer_website !== undefined) {
    const v = input.organizer_website?.trim() ?? "";
    if (v) {
      try {
        const parsed = new URL(v.startsWith("http") ? v : `https://${v}`);
        if (!parsed.hostname) throw new Error("no host");
        update.organizer_website = parsed.href;
      } catch {
        throw invalid("Please enter a valid website URL.", "organizer_website");
      }
    } else {
      update.organizer_website = null;
    }
  }

  if (input.membership_plan !== undefined) {
    // Silently ignored for non-business accounts (mirrors the website), so a
    // normal user can't set a plan; a bad value from a business account is a 400.
    if (currentRole === "business_owner") {
      const v = input.membership_plan?.trim().toLowerCase() ?? "";
      if (v && !MEMBERSHIP_PLANS.includes(v)) {
        throw invalid(
          "Invalid membership plan. Must be basic, premium, or enterprise.",
          "membership_plan",
        );
      }
      update.membership_plan = v || null;
    }
  }

  if (input.home_area_label !== undefined) {
    const v = input.home_area_label?.trim() ?? "";
    if (v.length > 120) {
      throw invalid("Home area must be 120 characters or fewer.", "home_area_label");
    }
    update.home_area_label = v || null;
  }

  if (input.age_band !== undefined) {
    const v = input.age_band?.trim() ?? "";
    const allowed = new Set(["", "under_18", "18-24", "25-34", "35-44", "45-54", "55+"]);
    if (!allowed.has(v)) {
      throw invalid(
        "Invalid age band. Use under_18, 18-24, 25-34, 35-44, 45-54, or 55+.",
        "age_band",
      );
    }
    update.age_band = v || null;
  }

  if (input.declared_interests !== undefined) {
    const interests = (input.declared_interests ?? [])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    update.declared_interests = interests;
  }

  return update;
}
