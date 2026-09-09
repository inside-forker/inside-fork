import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";
import {
  analyticsEventRequestSchema,
  type AnalyticsEventInput,
  type AnalyticsUserRole,
} from "@/types/analytics";

const CONTEXT_BYTES_LIMIT = 8_192; // 8 KB per event context to avoid oversized payloads
const textEncoder = new TextEncoder();

type AnalyticsEventInsert = {
  event_type: string;
  source: string;
  occurred_at: string;
  ingested_at: string;
  entity_type: string | null;
  entity_id: string | null;
  session_id: string | null;
  source_context: string | null;
  device_id: string | null;
  screen: string | null;
  actor_id: string | null;
  actor_role: string | null;
  context: unknown;
};

type ParsedRequest =
  | ({ events: AnalyticsEventInput[] } & { isBatch: true })
  | ({ events: [AnalyticsEventInput] } & { isBatch: false });

const parseRequest = (payload: unknown): ParsedRequest => {
  const result = analyticsEventRequestSchema.parse(payload);

  if ("events" in result) {
    return { events: result.events, isBatch: true };
  }

  return { events: [result], isBatch: false };
};

const ensureActorRole = async (
  actorId: string | null
): Promise<AnalyticsUserRole | null> => {
  if (!actorId) {
    return null;
  }

  const { rows } = await query(
    "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
    [actorId]
  );

  if (!rows[0]) {
    return null;
  }

  return (rows[0] as { role: string }).role as AnalyticsUserRole ?? null;
};

const sanitizeContext = (
  value: AnalyticsEventInput["context"]
): AnalyticsEventInput["context"] => {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch (error) {
    console.warn("Invalid context payload provided", error);
    return {};
  }
};

const normalizeEvents = async (
  request: NextRequest,
  events: AnalyticsEventInput[],
  authenticatedActorId: string | null,
  authenticatedRole: AnalyticsUserRole | null
): Promise<AnalyticsEventInsert[] | { error: NextResponse }> => {
  const ipAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const normalizedEvents: AnalyticsEventInsert[] = [];

  for (const event of events) {
    const occurredAt = event.occurredAt ?? new Date();
    const eventActorId = event.actorId ?? authenticatedActorId;
    const eventActorRole = event.actorRole ?? authenticatedRole;
    const context = sanitizeContext(event.context);
    const contextSizeBytes = textEncoder.encode(
      JSON.stringify(context)
    ).byteLength;

    if (contextSizeBytes > CONTEXT_BYTES_LIMIT) {
      return {
        error: NextResponse.json(
          {
            error: "Context payload too large",
            limitBytes: CONTEXT_BYTES_LIMIT,
            actualBytes: contextSizeBytes,
          },
          { status: 413 }
        ),
      };
    }

    const mergedContext = (() => {
      if (
        !ipAddress &&
        !userAgent &&
        (typeof context !== "object" ||
          context === null ||
          Array.isArray(context))
      ) {
        return context;
      }

      const baseContext =
        typeof context === "object" &&
        context !== null &&
        !Array.isArray(context)
          ? { ...context }
          : {};

      const requestMeta: Record<string, string> = {};

      if (ipAddress) {
        requestMeta.ipAddress = ipAddress;
      }

      if (userAgent) {
        requestMeta.userAgent = userAgent;
      }

      if (Object.keys(requestMeta).length === 0) {
        return baseContext;
      }

      const existingRequestMeta =
        typeof baseContext.request === "object" &&
        baseContext.request !== null &&
        !Array.isArray(baseContext.request)
          ? (baseContext.request as Record<string, string>)
          : undefined;

      return {
        ...baseContext,
        request: {
          ...existingRequestMeta,
          ...requestMeta,
        },
      };
    })();

    const ingestedAt = new Date().toISOString();

    normalizedEvents.push({
      event_type: event.eventType,
      source: event.source,
      occurred_at: occurredAt.toISOString(),
      ingested_at: ingestedAt,
      entity_type: event.entityType ?? null,
      entity_id: event.entityId ?? null,
      session_id: event.sessionId ?? null,
      source_context: event.sourceContext ?? null,
      device_id: event.deviceId ?? null,
      screen: event.screen ?? null,
      actor_id: eventActorId ?? null,
      actor_role: eventActorRole ?? null,
      context: mergedContext,
    });
  }

  return normalizedEvents;
};

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (_error) {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  let parsed: ParsedRequest;

  try {
    parsed = parseRequest(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Invalid analytics event payload",
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: "Invalid analytics event payload",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Invalid analytics event payload" },
      { status: 400 }
    );
  }

  const session = await getSessionFromCookies();

  const authenticatedActorId = session?.userId ?? null;
  const authenticatedRole = await ensureActorRole(authenticatedActorId);

  const normalized = await normalizeEvents(
    request,
    parsed.events,
    authenticatedActorId,
    authenticatedRole
  );

  if (!Array.isArray(normalized)) {
    return normalized.error;
  }

  try {
    const placeholders = normalized.map(
      (_, i) =>
        `($${i * 13 + 1}, $${i * 13 + 2}, $${i * 13 + 3}, $${i * 13 + 4}, $${i * 13 + 5}, $${i * 13 + 6}, $${i * 13 + 7}, $${i * 13 + 8}, $${i * 13 + 9}, $${i * 13 + 10}, $${i * 13 + 11}, $${i * 13 + 12}, $${i * 13 + 13})`
    ).join(", ");
    const values = normalized.flatMap((e) => [
      e.event_type,
      e.source,
      e.occurred_at,
      e.ingested_at,
      e.entity_type,
      e.entity_id,
      e.session_id,
      e.source_context,
      e.device_id,
      e.screen,
      e.actor_id,
      e.actor_role,
      JSON.stringify(e.context ?? {}),
    ]);
    await query(
      `INSERT INTO public.analytics_events
       (event_type, source, occurred_at, ingested_at, entity_type, entity_id, session_id, source_context, device_id, screen, actor_id, actor_role, context)
       VALUES ${placeholders}`,
      values
    );

    return NextResponse.json(
      {
        ok: true,
        inserted: normalized.length,
        batch: parsed.isBatch,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Unexpected analytics ingestion error", error);
    return NextResponse.json(
      { error: "Failed to record analytics event" },
      { status: 500 }
    );
  }
}
