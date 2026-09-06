import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const KNOWN_EVENT_TYPES = new Set([
  "view",
  "view_long",
  "favorite",
  "unfavorite",
  "contact_click",
  "call_click",
  "directions_click",
  "menu_open",
  "share",
  "rec_impression",
  "rec_click",
]);

const MAX_BATCH = 50;

const eventSchema = z.object({
  listingId: z.number().int().positive(),
  eventType: z.string(),
  session_id: z.string().min(1).optional(),
  device_id: z.string().min(1).optional(),
  source_context: z.string().min(1).optional(),
  context: z.record(z.unknown()).optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).max(MAX_BATCH),
});

/**
 * POST /api/mobile/v1/listing-events
 *
 * Batched listing-affinity telemetry → public.user_listing_events.
 * Phase 1 CORE also stores session_id / device_id / source_context when present.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  const { user } = await getOptionalMobileUser(request);
  await enforceMobileRateLimit(request, user?.id);

  const anonId = request.headers.get("x-anon-id");
  if (!user && !anonId) return ok({ accepted: 0, dropped: 0 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ok({ accepted: 0, dropped: 0 });

  const rows = parsed.data.events.filter((e) => KNOWN_EVENT_TYPES.has(e.eventType));
  const dropped = parsed.data.events.length - rows.length;
  if (rows.length === 0) return ok({ accepted: 0, dropped });

  const values: unknown[] = [];
  const placeholders: string[] = [];
  rows.forEach((e, i) => {
    const base = i * 8;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, $${base + 6}, $${base + 7}, $${base + 8})`,
    );
    values.push(
      user?.id ?? null,
      user ? null : anonId,
      e.listingId,
      e.eventType,
      JSON.stringify(e.context ?? {}),
      e.session_id ?? null,
      e.source_context ?? null,
      e.device_id ?? null,
    );
  });

  try {
    await query(
      `INSERT INTO public.user_listing_events
         (user_id, anon_id, listing_id, event_type, context, session_id, source_context, device_id)
       VALUES ${placeholders.join(", ")}`,
      values,
    );
  } catch (error) {
    console.error("[mobile-api] listing-event ingest failed:", error);
    return ok({ accepted: 0, dropped: parsed.data.events.length });
  }

  return ok({ accepted: rows.length, dropped });
});
