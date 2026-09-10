import type { Json } from "@/types/database";

interface NotificationPushRecipient {
  tokens: string[];
}

export interface SendNotificationPushParams {
  recipient: NotificationPushRecipient;
  title: string;
  body: string;
  data?: Json;
}

export interface PushTicketResult {
  token: string;
  ok: boolean;
  /** Set when Expo reports the token as dead (uninstalled/unregistered). */
  deviceNotRegistered: boolean;
  error?: string;
}

export interface SendNotificationPushResult {
  tickets: PushTicketResult[];
}

export class NotificationPushError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NotificationPushError";
  }
}

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushSendError {
  code?: string;
  message?: string;
  /** For PUSH_TOO_MANY_EXPERIENCE_IDS: experienceId -> tokens in that project. */
  details?: Record<string, string[]>;
}

/**
 * Sends one push to every token a recipient has registered (multi-device).
 *
 * The tokens go in a single Expo API call on the happy path. If a recipient has
 * tokens from more than one Expo project (e.g. a stale token left over from a
 * previous app identity next to the current one), Expo rejects the whole request
 * with PUSH_TOO_MANY_EXPERIENCE_IDS - we then split the tokens by project using
 * the error's `details` map and send one call per project, so the valid tokens
 * still get delivered instead of the whole push failing.
 *
 * Expo's relay handles the actual FCM/APNs delivery - no Firebase Admin SDK
 * credentials needed here.
 */
export async function sendNotificationPush(
  params: SendNotificationPushParams,
): Promise<SendNotificationPushResult> {
  const { recipient, title, body, data } = params;

  if (recipient.tokens.length === 0) {
    throw new NotificationPushError("No push tokens for recipient");
  }

  const ticketsByToken = new Map<string, ExpoPushTicket>();

  const postBatch = async (tokens: string[]): Promise<Response> => {
    const messages = tokens.map((token) => ({
      to: token,
      title,
      body,
      data: data ?? undefined,
      sound: "default",
    }));
    try {
      return await fetch(EXPO_PUSH_API_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      throw new NotificationPushError("Expo push request failed", error);
    }
  };

  const consumeBatch = async (
    tokens: string[],
    response: Response,
  ): Promise<void> => {
    const json = (await response.json().catch(() => null)) as {
      data?: ExpoPushTicket[];
    } | null;
    const tickets = json?.data;
    if (!Array.isArray(tickets) || tickets.length !== tokens.length) {
      throw new NotificationPushError(
        "Expo push API returned an unexpected response shape",
      );
    }
    tokens.forEach((token, index) => ticketsByToken.set(token, tickets[index]));
  };

  const initial = await postBatch(recipient.tokens);

  if (initial.ok) {
    await consumeBatch(recipient.tokens, initial);
  } else {
    const text = await initial.text().catch(() => "");

    let groups: string[][] | null = null;
    try {
      const parsed = JSON.parse(text) as { errors?: ExpoPushSendError[] };
      const mixed = parsed.errors?.find(
        (error) => error.code === "PUSH_TOO_MANY_EXPERIENCE_IDS",
      );
      if (mixed?.details) {
        groups = Object.values(mixed.details).filter((group) => group.length > 0);
        // Defensive: cover any token Expo didn't list in `details`.
        const grouped = new Set(groups.flat());
        const leftover = recipient.tokens.filter((t) => !grouped.has(t));
        if (leftover.length > 0) {
          groups.push(leftover);
        }
      }
    } catch {
      // Not the mixed-project error - fall through to the generic throw.
    }

    if (!groups) {
      throw new NotificationPushError(
        `Expo push API returned status ${initial.status}: ${text}`,
      );
    }

    for (const group of groups) {
      const response = await postBatch(group);
      if (!response.ok) {
        const groupText = await response.text().catch(() => "");
        throw new NotificationPushError(
          `Expo push API returned status ${response.status} on a per-project retry: ${groupText}`,
        );
      }
      await consumeBatch(group, response);
    }
  }

  return {
    tickets: recipient.tokens.map((token) => {
      const ticket = ticketsByToken.get(token);
      return {
        token,
        ok: ticket?.status === "ok",
        deviceNotRegistered:
          ticket?.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered",
        error: ticket?.status === "error" ? ticket.message : undefined,
      };
    }),
  };
}
