import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function parseEventId(eventId: string): number {
  const eventIdNum = parseInt(eventId, 10);
  if (Number.isNaN(eventIdNum)) throw MobileErrors.badRequest("Invalid event ID.");
  return eventIdNum;
}

const settingsSchema = z.object({
  scanning_mode: z.enum(["single", "multi_gate"]).optional(),
  total_gates: z.number().int().min(1).max(50).optional(),
});

/**
 * PATCH /api/mobile/v1/organizer/events/[eventId]/settings
 *
 * Allows event organizers or admins to update the event's scanning architecture
 * (single scanner vs multi-gate zone slicing) and total configured gates.
 */
export const PATCH = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { eventId } = await context.params;
  const eventIdNum = parseEventId(eventId);

  const { user, isGatePass } = await requireMobileOrganizer(request, {
    eventId: eventIdNum,
    allowGatePass: false, // Only organizers & admins can change architecture settings
  });
  await enforceMobileRateLimit(request, user.id);

  if (isGatePass) {
    throw MobileErrors.forbidden("Gate pass operators cannot modify event settings.");
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw MobileErrors.badRequest("Invalid settings payload.");
  }

  const { scanning_mode, total_gates } = parsed.data;

  const setClauses: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];

  if (scanning_mode !== undefined) {
    params.push(scanning_mode);
    setClauses.push(`scanning_mode = $${params.length}`);
  }

  if (total_gates !== undefined) {
    params.push(total_gates);
    setClauses.push(`total_gates = $${params.length}`);
  }

  if (params.length === 0) {
    throw MobileErrors.badRequest("No settings fields provided to update.");
  }

  params.push(eventIdNum);
  const idIdx = params.length;

  const { rows } = await query(
    `UPDATE public.events
     SET ${setClauses.join(", ")}
     WHERE id = $${idIdx}
     RETURNING id, name, scanning_mode, total_gates`,
    params,
  );

  const updated = rows[0];
  if (!updated) {
    throw MobileErrors.notFound("Event not found.");
  }

  return ok({
    event: {
      id: Number(updated.id),
      name: updated.name,
      scanning_mode: updated.scanning_mode,
      total_gates: Number(updated.total_gates),
    },
    message: "Event scanning settings updated successfully.",
  });
});
