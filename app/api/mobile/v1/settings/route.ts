import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { appendConsentLedger } from "@/lib/consent/ledger";

export const dynamic = "force-dynamic";

/**
 * User settings = the `profiles.user_preferences` JSON blob. Shape mirrors the
 * website's `app/api/user/settings` schema (theme / notifications / location),
 * plus Phase 1 CORE consent channel flags under `consent`.
 */
const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  notifications: z
    .object({
      email: z.boolean().optional(),
      bookings: z.boolean().optional(),
      reviews: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      name: z.string().optional(),
    })
    .optional(),
  consent: z
    .object({
      termsVersion: z.string().optional(),
      privacyVersion: z.string().optional(),
      marketingPush: z.boolean().optional(),
      marketingSms: z.boolean().optional(),
      marketingWhatsapp: z.boolean().optional(),
      marketingEmail: z.boolean().optional(),
      locationPermission: z.string().optional(),
      personalisationOptIn: z.boolean().optional(),
      researchPanelOptIn: z.boolean().optional(),
    })
    .optional(),
});

type Settings = z.infer<typeof settingsSchema>;

/**
 * GET /api/mobile/v1/settings
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  let data;
  try {
    const result = await query(
      `SELECT user_preferences FROM profiles WHERE id = $1`,
      [user.id],
    );
    data = result.rows[0];
  } catch (error) {
    console.error(
      "[mobile-api] settings fetch failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load settings.", 500);
  }

  return ok((data?.user_preferences as Settings | null) ?? {});
});

const updateSchema = z.object({ userPreferences: settingsSchema });

/**
 * PATCH /api/mobile/v1/settings
 * Deep-merges preferences. Consent / marketing changes append to consent_ledger.
 */
export const PATCH = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid settings.",
      400,
      first?.path.join("."),
    );
  }
  const patch = parsed.data.userPreferences;

  let existingRow;
  try {
    const result = await query(
      `SELECT user_preferences FROM profiles WHERE id = $1`,
      [user.id],
    );
    existingRow = result.rows[0];
  } catch (readError) {
    console.error(
      "[mobile-api] settings read failed:",
      readError instanceof Error ? readError.message : readError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update settings.",
      500,
    );
  }
  const existing = (existingRow?.user_preferences as Settings | null) ?? {};

  const merged: Settings = {
    ...existing,
    ...patch,
    ...(existing.notifications || patch.notifications
      ? {
          notifications: {
            ...existing.notifications,
            ...patch.notifications,
          },
        }
      : {}),
    ...(existing.location || patch.location
      ? { location: { ...existing.location, ...patch.location } }
      : {}),
    ...(existing.consent || patch.consent
      ? { consent: { ...existing.consent, ...patch.consent } }
      : {}),
  };

  let data;
  try {
    const result = await query(
      `UPDATE profiles
       SET user_preferences = $1, updated_at = $2
       WHERE id = $3
       RETURNING user_preferences`,
      [JSON.stringify(merged), new Date().toISOString(), user.id],
    );
    data = result.rows[0];
  } catch (error) {
    console.error(
      "[mobile-api] settings update failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to update settings.",
      500,
    );
  }

  const marketingTouched =
    patch.notifications?.marketing !== undefined ||
    patch.consent?.marketingPush !== undefined ||
    patch.consent?.marketingSms !== undefined ||
    patch.consent?.marketingWhatsapp !== undefined ||
    patch.consent?.marketingEmail !== undefined ||
    patch.consent?.locationPermission !== undefined ||
    patch.consent?.personalisationOptIn !== undefined ||
    patch.consent?.researchPanelOptIn !== undefined ||
    patch.consent?.termsVersion !== undefined ||
    patch.consent?.privacyVersion !== undefined;

  if (marketingTouched) {
    try {
      const c = merged.consent ?? {};
      await appendConsentLedger({
        userId: user.id,
        source: "settings",
        termsVersion: c.termsVersion ?? null,
        privacyVersion: c.privacyVersion ?? null,
        marketingPush: c.marketingPush ?? null,
        marketingSms: c.marketingSms ?? null,
        marketingWhatsapp: c.marketingWhatsapp ?? null,
        marketingEmail:
          c.marketingEmail ?? merged.notifications?.marketing ?? null,
        locationPermission: c.locationPermission ?? null,
        personalisationOptIn: c.personalisationOptIn ?? null,
        researchPanelOptIn: c.researchPanelOptIn ?? null,
        meta: {
          notificationsMarketing: merged.notifications?.marketing ?? null,
        },
      });
      if (typeof c.researchPanelOptIn === "boolean") {
        await query(
          `UPDATE public.profiles SET research_panel_opt_in = $2 WHERE id = $1`,
          [user.id, c.researchPanelOptIn],
        );
      }
    } catch (ledgerError) {
      console.error(
        "[mobile-api] consent ledger append failed:",
        ledgerError instanceof Error ? ledgerError.message : ledgerError,
      );
    }
  }

  return ok((data?.user_preferences as Settings | null) ?? merged);
});
