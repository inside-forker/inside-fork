import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { Json } from "@/types/database";

// GET /api/admin/settings - Get system settings
export async function GET() {
  try {
    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is super admin
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    // Fetch all system settings
    let settings;
    try {
      const { rows } = await query(
        "SELECT * FROM public.system_config ORDER BY config_key"
      );
      settings = rows;
    } catch (settingsError) {
      console.error("[SETTINGS API] Error fetching settings:", settingsError);
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 },
      );
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[SETTINGS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/admin/settings - Update a system setting
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin or super admin
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { config_key, config_value } = body;

    if (!config_key || config_value === undefined) {
      return NextResponse.json(
        { error: "config_key and config_value are required" },
        { status: 400 },
      );
    }

    // config_type CHECK constraint only allows: 'feature_flag' | 'threshold' | 'setting'
    // Caller can pass an explicit config_type; default to 'setting' for all ad-hoc keys.
    const validConfigTypes = ["feature_flag", "threshold", "setting"] as const;
    type ValidConfigType = (typeof validConfigTypes)[number];
    const rawType: string =
      typeof body.config_type === "string" ? body.config_type : "setting";
    const resolvedConfigType: ValidConfigType = (
      validConfigTypes as readonly string[]
    ).includes(rawType)
      ? (rawType as ValidConfigType)
      : "setting";

    // Upsert - insert if key doesn't exist, update if it does.
    // updated_by references auth.users so we pass the current super_admin's id.
    //
    // config_value is jsonb. The pg driver sends parameters as raw text with
    // no type hint, so a bare string like `hello` or a JS array serialized as
    // a Postgres array literal ({a,b,c}) both fail Postgres's ::jsonb cast -
    // neither is valid JSON text. JSON.stringify always produces valid JSON
    // text for any JS value (including already-quoting plain strings), so it
    // must run unconditionally here, not just for arrays/objects.
    const serializedConfigValue = JSON.stringify(config_value);

    let data;
    try {
      const { rows } = await query(
        `INSERT INTO public.system_config (config_key, config_value, config_type, updated_by)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (config_key)
         DO UPDATE SET
           config_value = EXCLUDED.config_value,
           config_type = EXCLUDED.config_type,
           updated_by = EXCLUDED.updated_by
         RETURNING *`,
        [
          config_key,
          serializedConfigValue as Json,
          resolvedConfigType,
          session.userId,
        ]
      );
      data = rows[0];
    } catch (error) {
      console.error("Error updating system setting:", error);
      return NextResponse.json(
        { error: "Failed to update setting" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, setting: data });
  } catch (error) {
    console.error("[SETTINGS API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
