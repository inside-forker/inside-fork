import { query } from "@/lib/db";

/** Best-effort server-side product analytics into mobile_events. */
export async function emitRedemptionAnalytics(input: {
  eventName: string;
  userId: string | null;
  sessionId?: string | null;
  sourceContext?: string | null;
  deviceId?: string | null;
  screen?: string | null;
  platform?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO public.mobile_events
         (event_name, occurred_at, user_id, anon_id, session_id, source_context,
          screen, platform, app_version, os_version, context, device_id)
       VALUES ($1, now(), $2, null, $3, $4, $5, $6, null, null, $7::jsonb, $8)`,
      [
        input.eventName,
        input.userId,
        input.sessionId ?? null,
        input.sourceContext ?? "redeem",
        input.screen ?? null,
        input.platform ?? "api",
        JSON.stringify(input.context ?? {}),
        input.deviceId ?? null,
      ],
    );
  } catch (error) {
    console.error(
      "[redemptions] analytics emit failed:",
      error instanceof Error ? error.message : error,
    );
  }
}
