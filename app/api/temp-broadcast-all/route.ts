import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createNotification, resolveCategorySlugForRole } from "@/lib/notifications";
import type { NotificationUserRole } from "@/types/notifications.types";

// TEMPORARY: one-off manual test notification for a single account, to prove
// push notifications reach a real device end-to-end. Not linked from
// anywhere, guarded by a local secret, meant to be deleted right after use.
const SECRET = "one-off-broadcast-test-2026-09-11";
const TARGET_EMAIL = "mazahirbilal@gmail.com";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows } = await query(
    `SELECT p.id, p.role
     FROM public.profiles p
     JOIN auth.users u ON u.id = p.id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [TARGET_EMAIL],
  );
  const target = rows[0] as { id: string; role: NotificationUserRole } | undefined;

  if (!target) {
    return NextResponse.json({ error: `No profile found for ${TARGET_EMAIL}` }, { status: 404 });
  }

  const { rows: tokenRows } = await query(
    `SELECT expo_push_token FROM public.push_tokens WHERE user_id = $1`,
    [target.id],
  );

  const categorySlug = await resolveCategorySlugForRole(target.role, "general");
  const result = await createNotification({
    recipientId: target.id,
    roleScope: target.role,
    categorySlug,
    title: "System check",
    body: "Testing our notification system.",
    priority: "normal",
    channelOverrides: { push: true },
    dedupeKey: `broadcast-test:${target.id}:${new Date().toISOString().slice(0, 10)}:${Date.now()}`,
  });

  return NextResponse.json({
    userId: target.id,
    registeredPushTokens: tokenRows.length,
    notification: result,
  });
}

// Diagnostic: check what actually happened to the push channel/tokens for
// the test account after a dispatch run.
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rows: profileRows } = await query(
    `SELECT p.id FROM public.profiles p
     JOIN auth.users u ON u.id = p.id
     WHERE LOWER(u.email) = LOWER($1) LIMIT 1`,
    [TARGET_EMAIL],
  );
  const userId = profileRows[0]?.id;
  if (!userId) {
    return NextResponse.json({ error: "profile not found" }, { status: 404 });
  }

  const { rows: tokens } = await query(
    `SELECT expo_push_token, platform, device_id, last_seen_at, updated_at
     FROM public.push_tokens WHERE user_id = $1 ORDER BY last_seen_at DESC`,
    [userId],
  );

  const { rows: channels } = await query(
    `SELECT nc.id, nc.channel, nc.status, nc.attempt_count, nc.last_attempted_at,
            nc.sent_at, nc.error, n.title, n.created_at AS notification_created_at
     FROM public.notification_channels nc
     JOIN public.notifications n ON n.id = nc.notification_id
     WHERE n.recipient_id = $1 AND n.title = 'System check'
     ORDER BY n.created_at DESC
     LIMIT 10`,
    [userId],
  );

  const { rows: outbox } = await query(
    `SELECT o.id, o.status, o.retry_count, o.last_error, o.scheduled_for,
            o.next_attempt_at, nc.channel
     FROM public.notification_outbox o
     JOIN public.notification_channels nc ON nc.id = o.notification_channel_id
     JOIN public.notifications n ON n.id = nc.notification_id
     WHERE n.recipient_id = $1 AND n.title = 'System check'
     ORDER BY o.id DESC
     LIMIT 10`,
    [userId],
  );

  return NextResponse.json({ userId, tokens, channels, outbox });
}
