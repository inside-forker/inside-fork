import { randomUUID } from "crypto";

import { query } from "@/lib/db";
import { logNotificationFailed, logNotificationSent } from "@/lib/audit";
import type { Json } from "@/types/database";
import type {
  NotificationChannelRecord,
  NotificationOutboxRecord,
  NotificationRecord,
} from "@/types/notifications.types";

import { NotificationEmailError, sendNotificationEmail } from "./email";
import { NotificationPushError, sendNotificationPush } from "./push";
import { generateBookingConfirmationEmail } from "@/lib/emails/booking-confirmation-template";

const MAX_BATCH_SIZE = 25;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 5;
const BACKOFF_SCHEDULE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

class NotificationDispatchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NotificationDispatchError";
  }
}

type RecipientProfile = {
  id: string;
  full_name: string | null;
} | null;

type EmailChannelRecord = NotificationChannelRecord & {
  notification:
    | (NotificationRecord & {
        recipient_profile: RecipientProfile;
      })
    | null;
};

type EmailOutboxRow = NotificationOutboxRecord & {
  notification_channel: EmailChannelRecord | null;
};

interface RecipientInfo {
  email: string | null;
  fullName: string | null;
}

interface DispatchOptions {
  limit?: number;
}

export interface DispatchSummary {
  attempted: number;
  sent: number;
  deferred: number;
  failed: number;
  skipped: number;
  recoveredLocks: number;
  errors: Array<{ outboxId: number; message: string }>;
}

function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit < 1) {
    return MAX_BATCH_SIZE;
  }
  return Math.min(Math.floor(limit), MAX_BATCH_SIZE);
}

function extractStatusCode(message: string): number | null {
  const match = message.match(/status\s+(\d{3})/i);
  if (!match) {
    return null;
  }
  const code = Number(match[1]);
  return Number.isNaN(code) ? null : code;
}

function safeJson(value: unknown): Json {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (value ?? null) as Json;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? null,
    } satisfies Json;
  }

  if (Array.isArray(value)) {
    return value.map((item) => safeJson(item)) as Json;
  }

  if (typeof value === "object") {
    const entries: Record<string, Json> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      entries[key] = safeJson(val);
    }
    return entries as Json;
  }

  return String(value ?? "") as Json;
}

function serializeErrorDetails(error: unknown): Json {
  if (error instanceof NotificationEmailError) {
    return {
      name: error.name,
      message: error.message,
      cause: safeJson(error.cause),
    } satisfies Json;
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    } satisfies Json;
  }

  return safeJson(error);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof NotificationEmailError) {
    const message = error.message.toLowerCase();
    if (message.includes("not configured")) {
      return false;
    }
    if (message.includes("recipient email is required")) {
      return false;
    }

    const status = extractStatusCode(error.message);
    if (status !== null) {
      if (status === 429) {
        return true;
      }
      if (status >= 500) {
        return true;
      }
      if (status >= 400) {
        return false;
      }
    }
    return true;
  }

  return true;
}

function getBackoffDelayMs(retryCount: number): number {
  const index = Math.min(
    Math.max(retryCount - 1, 0),
    BACKOFF_SCHEDULE_MS.length - 1,
  );
  return (
    BACKOFF_SCHEDULE_MS[index] ??
    BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1]
  );
}

async function releaseStaleLocks(thresholdIso: string): Promise<number> {
  try {
    const { rows } = await query(
      `UPDATE public.notification_outbox
       SET status = 'pending', locked_at = NULL, locked_by = NULL
       WHERE status = 'processing' AND locked_at < $1
       RETURNING id`,
      [thresholdIso],
    );

    return rows.length;
  } catch (error) {
    console.error("[notifications] Unexpected error releasing locks", error);
    return 0;
  }
}

async function fetchEmailOutboxRows(
  limit: number,
  now: Date,
): Promise<EmailOutboxRow[]> {
  const nowIso = now.toISOString();

  const { rows } = await query(
    `SELECT
       o.id, o.notification_channel_id, o.retry_count, o.scheduled_for, o.status,
       o.next_attempt_at, o.locked_at, o.locked_by, o.last_error, o.created_at, o.updated_at,
       json_build_object(
         'id', nc.id,
         'notification_id', nc.notification_id,
         'channel', nc.channel,
         'status', nc.status,
         'attempt_count', nc.attempt_count,
         'last_attempted_at', nc.last_attempted_at,
         'sent_at', nc.sent_at,
         'provider_message_id', nc.provider_message_id,
         'deliver_after', nc.deliver_after,
         'error', nc.error,
         'created_at', nc.created_at,
         'updated_at', nc.updated_at,
         'notification', json_build_object(
           'id', n.id,
           'recipient_id', n.recipient_id,
           'role_scope', n.role_scope,
           'category_slug', n.category_slug,
           'title', n.title,
           'body', n.body,
           'metadata', n.metadata,
           'priority', n.priority,
           'triggered_at', n.triggered_at,
           'cta_label', n.cta_label,
           'cta_url', n.cta_url,
           'recipient_profile', CASE WHEN p.id IS NOT NULL
             THEN json_build_object('id', p.id, 'full_name', p.full_name)
             ELSE NULL
           END
         )
       ) AS notification_channel
     FROM public.notification_outbox o
     INNER JOIN public.notification_channels nc ON nc.id = o.notification_channel_id AND nc.channel = 'email'
     INNER JOIN public.notifications n ON n.id = nc.notification_id
     LEFT JOIN public.profiles p ON p.id = n.recipient_id
     WHERE o.status = 'pending'
       AND o.locked_at IS NULL
       AND o.scheduled_for <= $1
     ORDER BY o.scheduled_for ASC
     LIMIT $2`,
    [nowIso, limit],
  );

  const typedRows = rows as unknown as EmailOutboxRow[];
  const nowTs = now.getTime();

  return typedRows.filter((row) => {
    if (!row.notification_channel || !row.notification_channel.notification) {
      return false;
    }
    if (!row.next_attempt_at) {
      return true;
    }
    const nextAttemptTs = Date.parse(row.next_attempt_at);
    return Number.isNaN(nextAttemptTs) ? true : nextAttemptTs <= nowTs;
  });
}

async function attemptLockOutboxRow(
  outboxId: number,
  lockToken: string,
): Promise<boolean> {
  const lockedAt = new Date().toISOString();

  try {
    const { rows } = await query(
      `UPDATE public.notification_outbox
       SET status = 'processing', locked_at = $1, locked_by = $2
       WHERE id = $3 AND status = 'pending' AND locked_at IS NULL
       RETURNING id`,
      [lockedAt, lockToken, outboxId],
    );

    return rows.length > 0;
  } catch (error) {
    console.error(
      `[notifications] Failed to lock outbox row ${outboxId}`,
      error,
    );
    return false;
  }
}

async function markChannelSuccess(
  channel: NotificationChannelRecord,
  attemptIso: string,
  providerMessageId: string | null,
): Promise<void> {
  try {
    await query(
      `UPDATE public.notification_channels
       SET status = 'sent', sent_at = $1, last_attempted_at = $1,
           attempt_count = $2, provider_message_id = $3, error = NULL
       WHERE id = $4`,
      [attemptIso, (channel.attempt_count ?? 0) + 1, providerMessageId, channel.id],
    );
  } catch (error) {
    throw new NotificationDispatchError(
      `Failed to update channel ${channel.id}: ${(error as Error).message}`,
      error,
    );
  }
}

async function markOutboxSuccess(
  outboxId: number,
  lockToken: string,
  attemptIso: string,
): Promise<void> {
  try {
    await query(
      `UPDATE public.notification_outbox
       SET status = 'sent', locked_at = NULL, locked_by = NULL,
           next_attempt_at = NULL, last_error = NULL, updated_at = $1
       WHERE id = $2 AND locked_by = $3`,
      [attemptIso, outboxId, lockToken],
    );
  } catch (error) {
    throw new NotificationDispatchError(
      `Failed to finalize outbox ${outboxId}: ${(error as Error).message}`,
      error,
    );
  }
}

async function safeLogSent(
  notificationId: string,
  outboxId: number,
  providerMessageId: string | null,
) {
  try {
    await logNotificationSent(notificationId, "email", {
      outboxId,
      providerMessageId: providerMessageId ?? undefined,
    });
  } catch (error) {
    console.error(
      `[notifications] Failed to log notification_sent for ${notificationId}`,
      error,
    );
  }
}

async function safeLogFailure(
  notificationId: string,
  channelId: number,
  outcome: "failed" | "deferred",
  retries: number,
  outboxId: number,
  error: unknown,
  nextAttemptAt?: string | null,
) {
  try {
    await logNotificationFailed(notificationId, "email", error, {
      outcome,
      retries,
      outboxId,
      channelId,
      nextAttemptAt: nextAttemptAt ?? null,
    });
  } catch (logError) {
    console.error(
      `[notifications] Failed to log notification_failed for ${notificationId}`,
      logError,
    );
  }
}

async function getRecipientInfo(
  notification: NotificationRecord & { recipient_profile: RecipientProfile },
  cache: Map<string, RecipientInfo>,
): Promise<RecipientInfo> {
  const key = notification.recipient_id;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const info: RecipientInfo = {
    email: null,
    fullName: notification.recipient_profile?.full_name ?? null,
  };

  try {
    const { rows } = await query(
      `SELECT email FROM auth.users WHERE id = $1 LIMIT 1`,
      [key],
    );
    if (rows[0]?.email) {
      info.email = rows[0].email;
    }
  } catch (error) {
    console.error(
      `[notifications] Unexpected error loading auth user for ${key}`,
      error,
    );
  }

  cache.set(key, info);
  return info;
}

/**
 * Builds custom HTML for specific notification categories
 * Returns null if default template should be used
 */
async function buildCustomEmailHtml(
  notification: NotificationRecord,
): Promise<string | null> {
  // Use booking confirmation template
  if (notification.category_slug === "public_booking_confirmation") {
    try {
      const metadata = notification.metadata as Record<string, unknown> | null;
      const bookingId = metadata?.booking_id as number | undefined;

      if (!bookingId) {
        console.warn("[dispatcher] No booking_id in notification metadata");
        return null;
      }

      // Fetch booking details with event and venue
      const { rows: bookingRows } = await query(
        `SELECT
           b.booking_reference, b.customer_name, b.total_amount, b.event_id,
           e.name AS event_name, e.start_time AS event_start_time,
           e.location_name AS event_location_name, e.address AS event_address
         FROM public.bookings b
         INNER JOIN public.events e ON e.id = b.event_id
         WHERE b.id = $1
         LIMIT 1`,
        [bookingId],
      );
      const booking = bookingRows[0];

      if (!booking) {
        console.error("[dispatcher] Failed to fetch booking", bookingId);
        return null;
      }

      // Fetch IK ticket passes with guest details including CNIC
      const { rows: passes } = await query(
        `SELECT tp.code, tp.guest_name, tp.cnic_last4, tt.name AS ticket_type_name
         FROM public.ticket_passes tp
         LEFT JOIN public.ticket_types tt ON tt.id = tp.ticket_type_id
         WHERE tp.booking_id = $1
         ORDER BY tp.issued_at ASC`,
        [bookingId],
      );

      // Organizer PDF inventory tickets (e.g. Ticketwala Prism Fam)
      const { rows: pdfTickets } = await query(
        `SELECT i.external_ticket_id, tt.name AS ticket_type_name
         FROM public.ticket_pdf_inventory i
         LEFT JOIN public.ticket_types tt ON tt.id = i.ticket_type_id
         WHERE i.booking_id = $1
         ORDER BY i.assigned_at ASC, i.id ASC`,
        [bookingId],
      );

      // Format event date and time
      const eventDate = new Date(booking.event_start_time);
      const formattedDate = eventDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = eventDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Extract event location
      const venueName = booking.event_location_name || "To be announced";
      const venueAddress = booking.event_address || "Check your tickets";

      const emailPasses = [
        ...passes.map((pass) => ({
          code: pass.code as string,
          guestName: pass.guest_name as string | null,
          cnicLast4: pass.cnic_last4 as string | null,
          ticketTypeName: (pass.ticket_type_name as string) || "General Admission",
        })),
        ...pdfTickets.map((pdf) => ({
          code: `TW-${pdf.external_ticket_id}`,
          guestName: booking.customer_name as string | null,
          cnicLast4: null as string | null,
          ticketTypeName:
            (pdf.ticket_type_name as string) || "Event Ticket",
        })),
      ];

      // Generate HTML
      const premiumHtml = generateBookingConfirmationEmail({
        customerName: booking.customer_name || "Valued Customer",
        bookingReference: booking.booking_reference || "N/A",
        eventName: booking.event_name,
        eventDate: formattedDate,
        eventTime: formattedTime,
        eventVenue: `${venueName}, ${venueAddress}`,
        ticketCount: emailPasses.length,
        totalAmount: booking.total_amount || 0,
        passes: emailPasses,
        viewTicketsUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bookings`,
      });

      return premiumHtml;
    } catch (error) {
      console.error("[dispatcher] Error building custom email:", error);
      return null;
    }
  }

  // Default: no custom template
  return null;
}

async function handleDispatchFailure(
  row: EmailOutboxRow,
  channel: EmailChannelRecord,
  notification: NotificationRecord & { recipient_profile: RecipientProfile },
  lockToken: string,
  attemptIso: string,
  error: unknown,
): Promise<"failed" | "deferred"> {
  const nextRetryCount = (row.retry_count ?? 0) + 1;
  const serializedError = serializeErrorDetails(error);
  const hasRetriesLeft =
    nextRetryCount < MAX_RETRY_ATTEMPTS && isRetryableError(error);

  try {
    await query(
      `UPDATE public.notification_channels
       SET status = $1, last_attempted_at = $2, attempt_count = $3, error = $4
       WHERE id = $5`,
      [
        hasRetriesLeft ? "pending" : "failed",
        attemptIso,
        (channel.attempt_count ?? 0) + 1,
        serializedError,
        channel.id,
      ],
    );
  } catch (channelError) {
    throw new NotificationDispatchError(
      `Failed to update channel ${channel.id} after error: ${(channelError as Error).message}`,
      channelError,
    );
  }

  const nextAttemptAt = hasRetriesLeft
    ? new Date(Date.now() + getBackoffDelayMs(nextRetryCount)).toISOString()
    : null;

  try {
    await query(
      `UPDATE public.notification_outbox
       SET retry_count = $1, last_error = $2, locked_at = NULL, locked_by = NULL,
           updated_at = $3, status = $4, next_attempt_at = $5
       WHERE id = $6 AND locked_by = $7`,
      [
        nextRetryCount,
        serializedError,
        attemptIso,
        hasRetriesLeft ? "pending" : "failed",
        nextAttemptAt,
        row.id,
        lockToken,
      ],
    );
  } catch (outboxError) {
    throw new NotificationDispatchError(
      `Failed to persist outbox failure for ${row.id}: ${(outboxError as Error).message}`,
      outboxError,
    );
  }

  await safeLogFailure(
    notification.id,
    channel.id,
    hasRetriesLeft ? "deferred" : "failed",
    nextRetryCount,
    row.id,
    error,
    nextAttemptAt,
  );

  return hasRetriesLeft ? "deferred" : "failed";
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return JSON.stringify(error);
}

export async function dispatchEmailOutboxBatch(
  options?: DispatchOptions,
): Promise<DispatchSummary> {
  const limit = clampLimit(options?.limit);
  const now = new Date();
  const recoveredLocks = await releaseStaleLocks(
    new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString(),
  );

  const rows = await fetchEmailOutboxRows(limit, now);

  const summary: DispatchSummary = {
    attempted: 0,
    sent: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
    recoveredLocks,
    errors: [],
  };

  if (!rows.length) {
    return summary;
  }

  const recipientCache = new Map<string, RecipientInfo>();

  for (const row of rows) {
    const channel = row.notification_channel;
    if (!channel || channel.channel !== "email" || !channel.notification) {
      summary.skipped += 1;
      continue;
    }

    const notification = channel.notification;
    if (!notification) {
      summary.skipped += 1;
      continue;
    }

    const lockToken = randomUUID();
    const locked = await attemptLockOutboxRow(row.id, lockToken);
    if (!locked) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    const attemptIso = new Date().toISOString();

    try {
      const recipient = await getRecipientInfo(notification, recipientCache);

      if (!recipient.email) {
        throw new NotificationEmailError("Recipient email is required");
      }

      const sendResult = await sendNotificationEmail({
        notification,
        recipient: {
          email: recipient.email,
          fullName: recipient.fullName ?? undefined,
        },
        customHtml: (await buildCustomEmailHtml(notification)) ?? undefined,
      });

      await markChannelSuccess(
        channel,
        attemptIso,
        sendResult.providerMessageId ?? null,
      );
      await markOutboxSuccess(row.id, lockToken, attemptIso);
      await safeLogSent(
        notification.id,
        row.id,
        sendResult.providerMessageId ?? null,
      );
      summary.sent += 1;
    } catch (error) {
      try {
        const outcome = await handleDispatchFailure(
          row,
          channel,
          notification,
          lockToken,
          attemptIso,
          error,
        );
        if (outcome === "failed") {
          summary.failed += 1;
          summary.errors.push({
            outboxId: row.id,
            message: formatError(error),
          });
        } else {
          summary.deferred += 1;
        }
      } catch (innerError) {
        summary.failed += 1;
        summary.errors.push({
          outboxId: row.id,
          message: formatError(innerError),
        });
      }
    }
  }

  return summary;
}

export class EmailDispatchError extends NotificationDispatchError {}

type PushChannelRecord = NotificationChannelRecord & {
  notification: NotificationRecord | null;
};

type PushOutboxRow = NotificationOutboxRecord & {
  notification_channel: PushChannelRecord | null;
};

async function fetchPushOutboxRows(
  limit: number,
  now: Date,
): Promise<PushOutboxRow[]> {
  const nowIso = now.toISOString();

  const { rows } = await query(
    `SELECT
       o.id, o.notification_channel_id, o.retry_count, o.scheduled_for, o.status,
       o.next_attempt_at, o.locked_at, o.locked_by, o.last_error, o.created_at, o.updated_at,
       json_build_object(
         'id', nc.id,
         'notification_id', nc.notification_id,
         'channel', nc.channel,
         'status', nc.status,
         'attempt_count', nc.attempt_count,
         'last_attempted_at', nc.last_attempted_at,
         'sent_at', nc.sent_at,
         'provider_message_id', nc.provider_message_id,
         'deliver_after', nc.deliver_after,
         'error', nc.error,
         'created_at', nc.created_at,
         'updated_at', nc.updated_at,
         'notification', json_build_object(
           'id', n.id,
           'recipient_id', n.recipient_id,
           'role_scope', n.role_scope,
           'category_slug', n.category_slug,
           'title', n.title,
           'body', n.body,
           'metadata', n.metadata,
           'priority', n.priority,
           'triggered_at', n.triggered_at,
           'cta_label', n.cta_label,
           'cta_url', n.cta_url
         )
       ) AS notification_channel
     FROM public.notification_outbox o
     INNER JOIN public.notification_channels nc ON nc.id = o.notification_channel_id AND nc.channel = 'push'
     INNER JOIN public.notifications n ON n.id = nc.notification_id
     WHERE o.status = 'pending'
       AND o.locked_at IS NULL
       AND o.scheduled_for <= $1
     ORDER BY o.scheduled_for ASC
     LIMIT $2`,
    [nowIso, limit],
  );

  const typedRows = rows as unknown as PushOutboxRow[];
  const nowTs = now.getTime();

  return typedRows.filter((row) => {
    if (!row.notification_channel || !row.notification_channel.notification) {
      return false;
    }
    if (!row.next_attempt_at) {
      return true;
    }
    const nextAttemptTs = Date.parse(row.next_attempt_at);
    return Number.isNaN(nextAttemptTs) ? true : nextAttemptTs <= nowTs;
  });
}

async function fetchPushTokens(userId: string): Promise<string[]> {
  try {
    const { rows } = await query(
      `SELECT expo_push_token FROM public.push_tokens WHERE user_id = $1`,
      [userId],
    );
    return rows.map((row) => row.expo_push_token as string);
  } catch (error) {
    console.error(
      `[notifications] Failed to load push tokens for ${userId}`,
      error,
    );
    return [];
  }
}

async function deleteDeadPushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }
  try {
    await query(
      `DELETE FROM public.push_tokens WHERE expo_push_token = ANY($1)`,
      [tokens],
    );
  } catch (error) {
    console.error("[notifications] Failed to prune dead push tokens", error);
  }
}

function isRetryablePushError(error: unknown): boolean {
  if (error instanceof NotificationPushError) {
    if (error.message.includes("No push tokens")) {
      return false;
    }
    const status = extractStatusCode(error.message);
    if (status !== null) {
      if (status === 429) {
        return true;
      }
      if (status >= 500) {
        return true;
      }
      if (status >= 400) {
        return false;
      }
    }
    return true;
  }
  return true;
}

async function safeLogPushSent(
  notificationId: string,
  outboxId: number,
): Promise<void> {
  try {
    await logNotificationSent(notificationId, "push", { outboxId });
  } catch (error) {
    console.error(
      `[notifications] Failed to log notification_sent for ${notificationId}`,
      error,
    );
  }
}

async function safeLogPushFailure(
  notificationId: string,
  channelId: number,
  outcome: "failed" | "deferred",
  retries: number,
  outboxId: number,
  error: unknown,
  nextAttemptAt?: string | null,
) {
  try {
    await logNotificationFailed(notificationId, "push", error, {
      outcome,
      retries,
      outboxId,
      channelId,
      nextAttemptAt: nextAttemptAt ?? null,
    });
  } catch (logError) {
    console.error(
      `[notifications] Failed to log notification_failed for ${notificationId}`,
      logError,
    );
  }
}

async function handlePushDispatchFailure(
  row: PushOutboxRow,
  channel: PushChannelRecord,
  notification: NotificationRecord,
  lockToken: string,
  attemptIso: string,
  error: unknown,
): Promise<"failed" | "deferred"> {
  const nextRetryCount = (row.retry_count ?? 0) + 1;
  const serializedError = serializeErrorDetails(error);
  const hasRetriesLeft =
    nextRetryCount < MAX_RETRY_ATTEMPTS && isRetryablePushError(error);

  try {
    await query(
      `UPDATE public.notification_channels
       SET status = $1, last_attempted_at = $2, attempt_count = $3, error = $4
       WHERE id = $5`,
      [
        hasRetriesLeft ? "pending" : "failed",
        attemptIso,
        (channel.attempt_count ?? 0) + 1,
        serializedError,
        channel.id,
      ],
    );
  } catch (channelError) {
    throw new NotificationDispatchError(
      `Failed to update channel ${channel.id} after error: ${(channelError as Error).message}`,
      channelError,
    );
  }

  const nextAttemptAt = hasRetriesLeft
    ? new Date(Date.now() + getBackoffDelayMs(nextRetryCount)).toISOString()
    : null;

  try {
    await query(
      `UPDATE public.notification_outbox
       SET retry_count = $1, last_error = $2, locked_at = NULL, locked_by = NULL,
           updated_at = $3, status = $4, next_attempt_at = $5
       WHERE id = $6 AND locked_by = $7`,
      [
        nextRetryCount,
        serializedError,
        attemptIso,
        hasRetriesLeft ? "pending" : "failed",
        nextAttemptAt,
        row.id,
        lockToken,
      ],
    );
  } catch (outboxError) {
    throw new NotificationDispatchError(
      `Failed to persist outbox failure for ${row.id}: ${(outboxError as Error).message}`,
      outboxError,
    );
  }

  await safeLogPushFailure(
    notification.id,
    channel.id,
    hasRetriesLeft ? "deferred" : "failed",
    nextRetryCount,
    row.id,
    error,
    nextAttemptAt,
  );

  return hasRetriesLeft ? "deferred" : "failed";
}

/**
 * Sends pending `push` outbox rows via Expo's push API. Fans out to every
 * device token a recipient has registered; drops tokens Expo reports as
 * `DeviceNotRegistered` so dead installs stop being retried.
 */
export async function dispatchPushOutboxBatch(
  options?: DispatchOptions,
): Promise<DispatchSummary> {
  const limit = clampLimit(options?.limit);
  const now = new Date();
  const recoveredLocks = await releaseStaleLocks(
    new Date(now.getTime() - LOCK_TIMEOUT_MS).toISOString(),
  );

  const rows = await fetchPushOutboxRows(limit, now);

  const summary: DispatchSummary = {
    attempted: 0,
    sent: 0,
    deferred: 0,
    failed: 0,
    skipped: 0,
    recoveredLocks,
    errors: [],
  };

  if (!rows.length) {
    return summary;
  }

  const tokenCache = new Map<string, string[]>();

  for (const row of rows) {
    const channel = row.notification_channel;
    if (!channel || channel.channel !== "push" || !channel.notification) {
      summary.skipped += 1;
      continue;
    }

    const notification = channel.notification;

    const lockToken = randomUUID();
    const locked = await attemptLockOutboxRow(row.id, lockToken);
    if (!locked) {
      summary.skipped += 1;
      continue;
    }

    summary.attempted += 1;
    const attemptIso = new Date().toISOString();

    try {
      let tokens = tokenCache.get(notification.recipient_id);
      if (!tokens) {
        tokens = await fetchPushTokens(notification.recipient_id);
        tokenCache.set(notification.recipient_id, tokens);
      }

      if (tokens.length === 0) {
        throw new NotificationPushError("No push tokens for recipient");
      }

      const result = await sendNotificationPush({
        recipient: { tokens },
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          categorySlug: notification.category_slug,
          ctaUrl: notification.cta_url,
        },
      });

      const deadTokens = result.tickets
        .filter((ticket) => ticket.deviceNotRegistered)
        .map((ticket) => ticket.token);
      if (deadTokens.length > 0) {
        await deleteDeadPushTokens(deadTokens);
        tokenCache.set(
          notification.recipient_id,
          tokens.filter((token) => !deadTokens.includes(token)),
        );
      }

      const anySucceeded = result.tickets.some((ticket) => ticket.ok);
      if (!anySucceeded) {
        const message =
          result.tickets
            .map((ticket) => ticket.error)
            .filter(Boolean)
            .join("; ") || "All push tickets failed";
        throw new NotificationPushError(message);
      }

      await markChannelSuccess(channel, attemptIso, null);
      await markOutboxSuccess(row.id, lockToken, attemptIso);
      await safeLogPushSent(notification.id, row.id);
      summary.sent += 1;
    } catch (error) {
      try {
        const outcome = await handlePushDispatchFailure(
          row,
          channel,
          notification,
          lockToken,
          attemptIso,
          error,
        );
        if (outcome === "failed") {
          summary.failed += 1;
          summary.errors.push({
            outboxId: row.id,
            message: formatError(error),
          });
        } else {
          summary.deferred += 1;
        }
      } catch (innerError) {
        summary.failed += 1;
        summary.errors.push({
          outboxId: row.id,
          message: formatError(innerError),
        });
      }
    }
  }

  return summary;
}

export class PushDispatchError extends NotificationDispatchError {}
