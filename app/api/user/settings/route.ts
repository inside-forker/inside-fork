import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";
import { appendConsentLedger } from "@/lib/consent/ledger";

// Validation schema for user preferences
const UserPreferencesSchema = z.object({
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
    })
    .optional(),
});

const UpdateSettingsSchema = z.object({
  userPreferences: UserPreferencesSchema,
});

type Settings = z.infer<typeof UserPreferencesSchema>;

// GET /api/user/settings - Get current user settings
export async function GET() {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows } = await query(
      `SELECT id, user_preferences FROM profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const profile = rows[0];

    return NextResponse.json({
      success: true,
      settings: profile?.user_preferences || {},
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/user/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = UpdateSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { userPreferences: patch } = validationResult.data;

    const { rows: existingRows } = await query(
      `SELECT user_preferences FROM profiles WHERE id = $1 LIMIT 1`,
      [session.userId],
    );
    const existing =
      (existingRows[0]?.user_preferences as Settings | null) ?? {};

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

    let updatedPreferences: unknown;
    try {
      const { rows } = await query(
        `UPDATE profiles
         SET user_preferences = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING user_preferences`,
        [JSON.stringify(merged), session.userId],
      );
      updatedPreferences = rows[0]?.user_preferences;
    } catch (error) {
      console.error("Error updating user settings:", error);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 },
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
      patch.consent?.termsVersion !== undefined ||
      patch.consent?.privacyVersion !== undefined;

    if (marketingTouched) {
      try {
        const c = merged.consent ?? {};
        await appendConsentLedger({
          userId: session.userId,
          source: "web_settings",
          termsVersion: c.termsVersion ?? null,
          privacyVersion: c.privacyVersion ?? null,
          marketingPush: c.marketingPush ?? null,
          marketingSms: c.marketingSms ?? null,
          marketingWhatsapp: c.marketingWhatsapp ?? null,
          marketingEmail:
            c.marketingEmail ?? merged.notifications?.marketing ?? null,
          locationPermission: c.locationPermission ?? null,
          personalisationOptIn: c.personalisationOptIn ?? null,
          meta: {
            notificationsMarketing: merged.notifications?.marketing ?? null,
          },
        });
      } catch (ledgerError) {
        console.error("consent ledger append failed:", ledgerError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully",
      settings: updatedPreferences,
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/user/settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
