import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import type {
  NotificationChannel,
  NotificationChannelConfig,
} from "@/types/notifications.types";

export const dynamic = "force-dynamic";

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];

/**
 * GET/PATCH /api/mobile/v1/notifications/preferences
 *
 * Mobile counterpart to /api/notifications/preferences (web, cookie-auth).
 * Same underlying `notification_preferences` table and semantics - this is
 * the only extra layer needed since the web route uses session cookies the
 * app doesn't have; both write to the exact same rows.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows: categories } = await query(
    `SELECT slug, label, description, is_mandatory, default_channel_config
     FROM public.notification_categories
     WHERE audience_roles @> ARRAY[$1]::public.user_role[]
     ORDER BY slug ASC`,
    [user.role],
  );

  const { rows: overrides } = await query(
    `SELECT category_slug, channel, enabled
     FROM public.notification_preferences
     WHERE profile_id = $1`,
    [user.id],
  );

  const overrideMap = new Map<string, boolean>();
  for (const row of overrides) {
    overrideMap.set(`${row.category_slug}:${row.channel}`, row.enabled);
  }

  const result = categories.map((category) => {
    const defaults = category.default_channel_config as NotificationChannelConfig;
    const channels = CHANNELS.reduce((acc, channel) => {
      const key = `${category.slug}:${channel}`;
      acc[channel] = overrideMap.has(key)
        ? (overrideMap.get(key) as boolean)
        : Boolean(defaults?.[channel]);
      return acc;
    }, {} as NotificationChannelConfig);

    return {
      category_slug: category.slug,
      label: category.label,
      description: category.description ?? null,
      is_mandatory: category.is_mandatory,
      channels,
    };
  });

  return ok(result);
});

interface PreferenceUpdate {
  categorySlug: string;
  channel: NotificationChannel;
  enabled: boolean;
}

function isValidUpdate(value: unknown): value is PreferenceUpdate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.categorySlug === "string" &&
    v.categorySlug.length > 0 &&
    CHANNELS.includes(v.channel as NotificationChannel) &&
    typeof v.enabled === "boolean"
  );
}

export const PATCH = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const body = await request.json().catch(() => null);
  const preferences = body?.preferences;

  if (!Array.isArray(preferences) || !preferences.every(isValidUpdate)) {
    throw new MobileApiError(
      "validation_error",
      "preferences must be an array of { categorySlug, channel, enabled }.",
      400,
      "preferences",
    );
  }

  if (!preferences.length) {
    return ok({ updated: 0 });
  }

  const slugs = [...new Set(preferences.map((p: PreferenceUpdate) => p.categorySlug))];
  const { rows: mandatoryRows } = await query(
    `SELECT slug FROM public.notification_categories
     WHERE slug = ANY($1::text[]) AND is_mandatory = true`,
    [slugs],
  );
  const mandatorySlugs = new Set(mandatoryRows.map((r) => r.slug));

  for (const slug of mandatorySlugs) {
    const forThisSlug = preferences.filter(
      (p: PreferenceUpdate) => p.categorySlug === slug,
    );
    if (
      forThisSlug.length === CHANNELS.length &&
      forThisSlug.every((p: PreferenceUpdate) => !p.enabled)
    ) {
      throw new MobileApiError(
        "validation_error",
        `"${slug}" is a required category and needs at least one channel enabled.`,
        400,
        "preferences",
      );
    }
  }

  const values: unknown[] = [];
  const placeholders = preferences
    .map((pref: PreferenceUpdate, i: number) => {
      const base = i * 4;
      values.push(user.id, pref.categorySlug, pref.channel, pref.enabled);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(", ");

  try {
    await query(
      `INSERT INTO public.notification_preferences (profile_id, category_slug, channel, enabled)
       VALUES ${placeholders}
       ON CONFLICT (profile_id, category_slug, channel)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = timezone('utc', now())`,
      values,
    );
  } catch (error) {
    console.error("[mobile-api] update notification preferences failed:", error);
    throw new MobileApiError(
      "internal_error",
      "Failed to update preferences.",
      500,
    );
  }

  return ok({ updated: preferences.length });
});
