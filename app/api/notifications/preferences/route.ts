import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";
import type {
  NotificationChannel,
  NotificationChannelConfig,
} from "@/types/notifications.types";

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];

/**
 * Canonical notification preferences endpoint - the ONLY reads/writes to
 * `notification_preferences`, the table `getEffectiveChannelConfig()`
 * (lib/notifications/preferences.ts) actually consults when deciding
 * whether to send. `/api/user/settings`'s `user_preferences.notifications`
 * blob is a legacy, disconnected toggle set (email/bookings/reviews/
 * marketing booleans) that the send path never reads - do not add reads of
 * it here or in the send path; it should be migrated/retired separately.
 */

const UpdatePreferencesSchema = z.object({
  preferences: z.array(
    z.object({
      categorySlug: z.string().min(1),
      channel: z.enum(["bell", "email", "push"]),
      enabled: z.boolean(),
    })
  ),
});

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows: categories } = await query(
    `SELECT slug, label, description, is_mandatory, default_channel_config
     FROM public.notification_categories
     WHERE audience_roles @> ARRAY[$1]::public.user_role[]
     ORDER BY slug ASC`,
    [session.role]
  );

  const { rows: overrides } = await query(
    `SELECT category_slug, channel, enabled
     FROM public.notification_preferences
     WHERE profile_id = $1`,
    [session.userId]
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
      categorySlug: category.slug,
      label: category.label,
      description: category.description ?? null,
      isMandatory: category.is_mandatory,
      channels,
    };
  });

  return NextResponse.json({ success: true, categories: result });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validation = UpdatePreferencesSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.issues },
      { status: 400 }
    );
  }

  const { preferences } = validation.data;
  if (!preferences.length) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  // Mandatory categories must keep at least one channel on - reject a patch
  // that would zero out every channel for one, rather than silently
  // allowing it and having the send path re-force bell on unexpectedly.
  const slugs = [...new Set(preferences.map((p) => p.categorySlug))];
  const { rows: mandatoryRows } = await query(
    `SELECT slug FROM public.notification_categories
     WHERE slug = ANY($1::text[]) AND is_mandatory = true`,
    [slugs]
  );
  const mandatorySlugs = new Set(mandatoryRows.map((r) => r.slug));

  for (const slug of mandatorySlugs) {
    const forThisSlug = preferences.filter((p) => p.categorySlug === slug);
    if (forThisSlug.length === CHANNELS.length && forThisSlug.every((p) => !p.enabled)) {
      return NextResponse.json(
        { error: `"${slug}" is a required category and needs at least one channel enabled` },
        { status: 400 }
      );
    }
  }

  const values: unknown[] = [];
  const placeholders = preferences
    .map((pref, i) => {
      const base = i * 4;
      values.push(session.userId, pref.categorySlug, pref.channel, pref.enabled);
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    })
    .join(", ");

  try {
    await query(
      `INSERT INTO public.notification_preferences (profile_id, category_slug, channel, enabled)
       VALUES ${placeholders}
       ON CONFLICT (profile_id, category_slug, channel)
       DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = timezone('utc', now())`,
      values
    );
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, updated: preferences.length });
}
