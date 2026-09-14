import { NextRequest, NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type {
  NotificationChannel,
  NotificationChannelConfig,
  NotificationPriority,
  NotificationUserRole,
} from "@/types/notifications.types";

type ScenarioCopy = {
  title: string;
  body: string;
  priority: NotificationPriority;
  ctaLabel?: string;
  ctaUrl?: string;
};

const SCENARIO_COPY: Record<NotificationUserRole, ScenarioCopy> = {
  super_admin: {
    title: "System health check: nightly audit is complete",
    body: "Our automated health sweep just finished without any blockers. You can review the latest audit log snapshot for more detail.",
    priority: "high",
    ctaLabel: "View audit logs",
    ctaUrl: "/admin/logs",
  },
  admin: {
    title: "New Get Listed submission awaiting review",
    body: "A business owner just shared their listing details. Approve or request edits to keep the onboarding queue flowing.",
    priority: "normal",
    ctaLabel: "Open submission queue",
    ctaUrl: "/admin/forms",
  },
  lister: {
    title: "Fresh review posted on one of your listings",
    body: "A visitor left feedback on your Karachi listing. Jump in to thank them or address any concerns while it’s still fresh.",
    priority: "normal",
    ctaLabel: "Read latest reviews",
    ctaUrl: "/dashboard/reviews",
  },
  data_entry: {
    title: "Listings waiting for capacity details",
    body: "Some listings still need price per person and guest capacity filled in. Open the capacity tool to keep coverage moving.",
    priority: "normal",
    ctaLabel: "Open listing capacity",
    ctaUrl: "/admin/listing-capacity",
  },
  business_owner: {
    title: "New lead captured from your premium page",
    body: "Someone just requested more details from your listing. Follow up quickly to close the loop and keep momentum high.",
    priority: "normal",
    ctaLabel: "Open my leads",
    ctaUrl: "/dashboard/bookings",
  },
  writer: {
    title: "Story pitch approved—ready for publication",
    body: "Editorial gave the green light to your recent submission. Give it one last review before we feature it on Inside Karachi.",
    priority: "normal",
    ctaLabel: "Finalize my draft",
    ctaUrl: "/dashboard",
  },
  organizer: {
    title: "New ticket sold for your event!",
    body: "Someone just purchased a ticket for your upcoming event. Check your dashboard for the latest sales figures.",
    priority: "normal",
    ctaLabel: "View dashboard",
    ctaUrl: "/dashboard",
  },
  eo_gate_pass: {
    title: "Gate Pass Scanner active",
    body: "Your gate scanner permissions are configured and ready for scanning attendees.",
    priority: "normal",
    ctaLabel: "Open scanner",
    ctaUrl: "/dashboard/scan",
  },
  public_user: {
    title: "Your booking is confirmed—get ready for Karachi!",
    body: "We’ve locked in your spot. Keep this confirmation handy and check the event page for last-minute updates or perks.",
    priority: "low",
    ctaLabel: "View my bookings",
    ctaUrl: "/dashboard/bookings",
  },
};

const CHANNELS: NotificationChannel[] = ["bell", "email", "push"];
const ASYNC_CHANNELS = new Set<NotificationChannel>(["email", "push"]);
const DEFAULT_CHANNEL_CONFIG: NotificationChannelConfig = {
  bell: true,
  email: false,
  push: false,
};

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return fallback;
}

function parseChannelConfig(raw: unknown): NotificationChannelConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CHANNEL_CONFIG };
  }
  const config = { ...DEFAULT_CHANNEL_CONFIG };
  CHANNELS.forEach((channel) => {
    config[channel] = toBoolean((raw as Record<string, unknown>)[channel], config[channel]);
  });
  return config;
}

export async function POST(request: NextRequest) {
  try {
    // Disable demo seeding in production environments
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const { rows: profileRows } = await client.query(
        `SELECT role, full_name FROM profiles WHERE id = $1`,
        [session.userId]
      );
      const profile = profileRows[0] as { role: NotificationUserRole; full_name: string | null } | undefined;
      const role: NotificationUserRole = profile?.role ?? "public_user";
      const copy = SCENARIO_COPY[role];

      // Resolve the category slug for this role: prefer a category targeted
      // at the role (most-mandatory first), else fall back to the
      // alphabetically-first category overall.
      const { rows: targetedRows } = await client.query(
        `SELECT * FROM notification_categories WHERE audience_roles @> ARRAY[$1]::user_role[] ORDER BY is_mandatory DESC LIMIT 1`,
        [role]
      );
      let category = targetedRows[0];
      if (!category) {
        const { rows: fallbackRows } = await client.query(
          `SELECT * FROM notification_categories ORDER BY slug ASC LIMIT 1`
        );
        category = fallbackRows[0];
      }
      if (!category) {
        throw new Error("No notification categories available for fallback");
      }
      const categorySlug: string = category.slug;

      const nowIso = new Date().toISOString();
      const dedupeKey = `demo-${role}-${nowIso}`;

      // Dedupe check (virtually always a miss since the key includes a
      // fresh timestamp, but kept for parity with the original behavior).
      const { rows: existingRows } = await client.query(
        `SELECT id FROM notifications WHERE recipient_id = $1 AND dedupe_key = $2 ORDER BY id ASC LIMIT 1`,
        [session.userId, dedupeKey]
      );
      if (existingRows.length > 0) {
        return NextResponse.json({
          success: true,
          notificationId: existingRows[0].id,
        });
      }

      // Effective channel config: category defaults -> user preference
      // overrides -> enforce at least one enabled channel if mandatory.
      const defaults = parseChannelConfig(category.default_channel_config);
      const { rows: prefRows } = await client.query(
        `SELECT channel, enabled FROM notification_preferences WHERE profile_id = $1 AND category_slug = $2`,
        [session.userId, categorySlug]
      );
      const config = { ...defaults };
      for (const pref of prefRows as { channel: NotificationChannel; enabled: boolean }[]) {
        config[pref.channel] = pref.enabled;
      }
      if (category.is_mandatory && !CHANNELS.some((c) => config[c])) {
        config.bell = true;
      }

      await client.query("BEGIN");
      try {
        const metadata = {
          demo: true,
          generatedAt: nowIso,
          actorName: profile?.full_name ?? null,
        };

        const { rows: notificationRows } = await client.query(
          `INSERT INTO notifications
             (recipient_id, role_scope, category_slug, title, body, metadata, priority, cta_label, cta_url, dedupe_key, actor_id, expires_at, triggered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL, $11)
           RETURNING id,
             to_json(triggered_at) #>> '{}' AS triggered_at,
             to_json(created_at) #>> '{}' AS created_at,
             to_json(updated_at) #>> '{}' AS updated_at`,
          [
            session.userId,
            role,
            categorySlug,
            copy.title,
            copy.body,
            metadata,
            copy.priority,
            copy.ctaLabel ?? null,
            copy.ctaUrl ?? null,
            dedupeKey,
            nowIso,
          ]
        );
        const notification = notificationRows[0];

        for (const channel of CHANNELS) {
          if (!config[channel]) continue;
          const isAsync = ASYNC_CHANNELS.has(channel);
          const { rows: channelRows } = await client.query(
            `INSERT INTO notification_channels (notification_id, channel, status, sent_at, deliver_after)
             VALUES ($1, $2, $3, $4, NULL)
             RETURNING id`,
            [notification.id, channel, isAsync ? "pending" : "sent", isAsync ? null : nowIso]
          );
          if (isAsync) {
            const channelId = channelRows[0].id;
            await client.query(
              `INSERT INTO notification_outbox (notification_channel_id, status, scheduled_for)
               VALUES ($1, 'pending', $2)`,
              [channelId, nowIso]
            );
          }
        }

        await client.query("COMMIT");

        return NextResponse.json({
          success: true,
          notificationId: notification.id,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/notifications/seed failed", error);
    return NextResponse.json(
      { error: "Failed to generate demo notification" },
      { status: 500 }
    );
  }
}
