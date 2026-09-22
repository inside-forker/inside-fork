import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import { z } from "zod";

const CONFIG_KEY = "scraper.worker_automation";

const WorkerAutomationSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["manual", "interval"]).default("manual"),
  intervalMinutes: z.number().min(15).max(1440).default(1440),
  syncDefaults: z.object({
    maxConcurrent: z.number().min(1).max(10).default(5),
    autoPublish: z.boolean().default(false),
    preserveManualEdits: z.boolean().default(true),
    syncMode: z.enum(["deals_only", "full"]).default("deals_only"),
  }),
  canary: z.object({
    enabled: z.boolean().default(false),
    entityLimit: z.number().min(3).max(100).default(10),
    maxErrorRatePercent: z.number().min(1).max(100).default(40),
  }),
});

type WorkerAutomationConfig = z.infer<typeof WorkerAutomationSchema>;

const DEFAULT_CONFIG: WorkerAutomationConfig = {
  enabled: false,
  mode: "manual",
  intervalMinutes: 1440,
  syncDefaults: {
    maxConcurrent: 5,
    autoPublish: false,
    preserveManualEdits: true,
    syncMode: "deals_only",
  },
  canary: {
    enabled: false,
    entityLimit: 10,
    maxErrorRatePercent: 40,
  },
};

async function assertSuperAdmin() {
  const session = await getSessionFromCookies();
  if (!session) {
    return { ok: false as const, status: 401, userId: null };
  }

  const { rows } = await query(
    "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
    [session.userId],
  );
  const profile = rows[0];

  if (!profile) {
    return { ok: false as const, status: 401, userId: session.userId };
  }

  if (profile.role !== "super_admin") {
    return { ok: false as const, status: 403, userId: session.userId };
  }

  return { ok: true as const, status: 200, userId: session.userId };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    let data: { config_value: unknown } | undefined;
    try {
      const { rows } = await query(
        "SELECT config_value FROM system_config WHERE config_key = $1 LIMIT 1",
        [CONFIG_KEY],
      );
      data = rows[0];
    } catch {
      return NextResponse.json(
        { error: "Failed to load worker config" },
        { status: 500 },
      );
    }

    const raw = data?.config_value;
    const parsed = WorkerAutomationSchema.safeParse(raw);

    return NextResponse.json({
      config: parsed.success ? parsed.data : DEFAULT_CONFIG,
      source: parsed.success ? "system_config" : "default",
    });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: auth.status },
      );
    }

    const body = (await request.json()) as unknown;
    const parsed = WorkerAutomationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid config", details: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      await query(
        `INSERT INTO system_config (
           config_key, config_value, config_type, description,
           requires_restart, is_public, updated_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (config_key) DO UPDATE SET
           config_value = EXCLUDED.config_value,
           config_type = EXCLUDED.config_type,
           description = EXCLUDED.description,
           requires_restart = EXCLUDED.requires_restart,
           is_public = EXCLUDED.is_public,
           updated_by = EXCLUDED.updated_by`,
        [
          CONFIG_KEY,
          parsed.data,
          "setting",
          "Listing scraper worker automation config",
          false,
          false,
          auth.userId,
        ],
      );
    } catch {
      return NextResponse.json(
        { error: "Failed to save config" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, config: parsed.data });
  } catch (error) {
    const e = error as Error;
    return NextResponse.json(
      { error: "Internal server error", message: e.message },
      { status: 500 },
    );
  }
}
