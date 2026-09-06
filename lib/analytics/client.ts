"use client";

import { ZodError } from "zod";

import {
  analyticsEventSchema,
  type AnalyticsEventInput,
} from "@/types/analytics";
import {
  getOrRotateWebSessionId,
  getWebDeviceId,
} from "@/lib/analytics/envelope";

const ANALYTICS_ENDPOINT = "/api/analytics/events";
const DEFAULT_USE_BEACON = true;
const DEFAULT_KEEPALIVE = true;

export interface RecordAnalyticsOptions {
  signal?: AbortSignal;
  useBeacon?: boolean;
  keepalive?: boolean;
}

export interface RecordAnalyticsResult {
  ok: boolean;
  status?: number;
  error?: string;
  details?: unknown;
}

/** Ensure every web event carries Phase 1 CORE envelope fields. */
function withEnvelope(event: AnalyticsEventInput): AnalyticsEventInput {
  return {
    ...event,
    sessionId: event.sessionId ?? getOrRotateWebSessionId(),
    deviceId: event.deviceId ?? getWebDeviceId(),
    sourceContext: event.sourceContext ?? "unknown",
  };
}

const toSerializableEvents = (events: AnalyticsEventInput[]) => {
  const serialized: AnalyticsEventInput[] = [];

  for (const event of events) {
    const parsed = analyticsEventSchema.safeParse(withEnvelope(event));

    if (!parsed.success) {
      throw parsed.error;
    }

    serialized.push(parsed.data);
  }

  return serialized;
};

const canUseBeacon = (options?: RecordAnalyticsOptions) => {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  if (options?.signal) {
    return false;
  }

  return options?.useBeacon ?? DEFAULT_USE_BEACON;
};

const sendWithBeacon = (payload: unknown): boolean => {
  try {
    const body = JSON.stringify(payload);
    return navigator.sendBeacon(
      ANALYTICS_ENDPOINT,
      new Blob([body], { type: "application/json" }),
    );
  } catch (error) {
    console.warn("Analytics beacon failed", error);
    return false;
  }
};

const sendWithFetch = async (
  payload: unknown,
  options?: RecordAnalyticsOptions,
): Promise<RecordAnalyticsResult> => {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  };

  if (
    typeof window !== "undefined" &&
    (options?.keepalive ?? DEFAULT_KEEPALIVE)
  ) {
    requestInit.keepalive = true;
  }

  try {
    const response = await fetch(ANALYTICS_ENDPOINT, requestInit);

    if (!response.ok) {
      const details = await response.json().catch(() => undefined);
      return {
        ok: false,
        status: response.status,
        error:
          (details as { error?: string } | undefined)?.error ??
          response.statusText,
        details,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Analytics request failed",
    };
  }
};

export async function recordAnalyticsEvents(
  events: AnalyticsEventInput[],
  options?: RecordAnalyticsOptions,
): Promise<RecordAnalyticsResult> {
  try {
    const serialized = toSerializableEvents(events);
    const payload =
      serialized.length === 1 ? serialized[0] : { events: serialized };

    if (canUseBeacon(options)) {
      const beaconOk = sendWithBeacon(payload);
      return { ok: beaconOk, status: beaconOk ? 202 : undefined };
    }

    return await sendWithFetch(payload, options);
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        ok: false,
        error: "Invalid analytics event",
        details: error.flatten(),
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Analytics event failed",
    };
  }
}

export async function recordAnalyticsEvent(
  event: AnalyticsEventInput,
  options?: RecordAnalyticsOptions,
): Promise<RecordAnalyticsResult> {
  return recordAnalyticsEvents([event], options);
}
