import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";

import { resolveKarachiNeighborhood } from "@/lib/analytics/karachi-areas";

export const dynamic = "force-dynamic";

const MAX_BATCH = 50;

const eventSchema = z.object({
  event_name: z.string().min(1),
  occurred_at: z.coerce.date().optional(),
  source_context: z.string().min(1),
  session_id: z.string().min(1),
  device_id: z.string().min(1).optional(),
  screen: z.string().optional(),
  platform: z.string().optional(),
  app_version: z.string().optional(),
  os_version: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  context: z.record(z.unknown()).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).max(MAX_BATCH),
});

/**
 * POST /api/mobile/v1/analytics-events
 *
 * General mobile product-analytics ingest → public.mobile_events.
 * Auth optional; signed-out actors use `X-Anon-Id`.
 * Malformed rows / DB failures are swallowed (telemetry must never break the app).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  const { user } = await getOptionalMobileUser(request);
  await enforceMobileRateLimit(request, user?.id);

  const anonId = request.headers.get("x-anon-id");
  if (!user && !anonId) return ok({ accepted: 0, dropped: 0 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ok({ accepted: 0, dropped: 0 });

  const rows = parsed.data.events;
  if (rows.length === 0) return ok({ accepted: 0, dropped: 0 });

  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((e, i) => {
    const base = i * 17;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}::jsonb, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17})`,
    );

    const lat = typeof e.latitude === "number" && !isNaN(e.latitude) ? e.latitude : null;
    const lng = typeof e.longitude === "number" && !isNaN(e.longitude) ? e.longitude : null;
    const resolvedNeighborhood =
      e.neighborhood?.trim() ||
      (lat && lng ? resolveKarachiNeighborhood(lat, lng) : null);

    values.push(
      e.event_name,
      e.occurred_at ?? new Date(),
      user?.id ?? null,
      user ? null : anonId,
      e.session_id,
      e.source_context,
      e.screen ?? null,
      e.platform ?? null,
      e.app_version ?? null,
      e.os_version ?? null,
      JSON.stringify(e.context ?? {}),
      e.device_id ?? null,
      lat,
      lng,
      e.accuracy ?? null,
      resolvedNeighborhood,
      e.city ?? "Karachi",
    );
  });

  try {
    await query(
      `INSERT INTO public.mobile_events
         (event_name, occurred_at, user_id, anon_id, session_id, source_context, screen, platform, app_version, os_version, context, device_id, latitude, longitude, accuracy, neighborhood, city)
       VALUES ${placeholders.join(", ")}`,
      values,
    );
  } catch (error) {
    console.error("[mobile-api] analytics-event ingest failed:", error);
    return ok({ accepted: 0, dropped: rows.length });
  }

  return ok({ accepted: rows.length, dropped: 0 });
});
