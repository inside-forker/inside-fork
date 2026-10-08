import type { NotificationRecord } from "@/types/notifications.types";
import { getPublicSiteOrigin } from "@/lib/auth/url";

interface NotificationEmailRecipient {
  email: string;
  fullName?: string | null;
}

export interface SendNotificationEmailParams {
  notification: NotificationRecord;
  recipient: NotificationEmailRecipient;
  customHtml?: string | null;
}

export interface SendNotificationEmailResult {
  providerMessageId?: string | null;
}

export class NotificationEmailError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "NotificationEmailError";
  }
}

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL ?? "notifications@insidekarachi.com";
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "Inside Karachi";
const BREVO_BASE_URL = "https://api.brevo.com/v3/smtp/email";

/** Public site for email assets/CTAs — never localhost from a local .env. */
function emailSiteUrl(): string {
  return getPublicSiteOrigin();
}

/** Email clients cannot resolve relative paths — always emit an absolute href. */
function resolveEmailCtaUrl(ctaUrl: string | null | undefined): string | null {
  if (!ctaUrl) return null;
  const trimmed = ctaUrl.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const site = emailSiteUrl();
  try {
    return new URL(trimmed, `${site}/`).toString();
  } catch {
    return `${site}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  }
}

const INLINE_STYLES = {
  body: "margin:0;padding:0;background-color:#0f172a;color:#0f172a;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;",
  container:
    "max-width:600px;margin:0 auto;padding:40px 32px;background:linear-gradient(135deg,#0f172a,#111827);color:#f8fafc;",
  card: "background:rgba(15,23,42,0.8);border-radius:28px;padding:32px;border:1px solid rgba(148,163,184,0.18);box-shadow:0 30px 90px rgba(30,41,59,0.35);",
  logoContainer:
    "margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid rgba(255,24,77,0.15);",
  logo: "height:40px;width:auto;display:block;",
  title:
    "font-size:24px;font-weight:700;line-height:32px;margin:0;color:#f8fafc;",
  meta: "margin-top:32px;border-top:1px solid rgba(148,163,184,0.18);padding-top:24px;color:#cbd5f5;font-size:13px;line-height:20px;",
  metadataRow:
    "margin:8px 0;padding:12px 16px;border-radius:12px;background:rgba(30,41,59,0.6);color:#e2e8f0;",
  button:
    "display:inline-block;margin-top:28px;padding:14px 24px;border-radius:16px;background:linear-gradient(135deg,#ff184d,#ff5f8f);color:#fff;text-decoration:none;font-weight:600;letter-spacing:0.01em;box-shadow:0 4px 12px rgba(255,24,77,0.3);transition:all 0.3s ease;",
  signature: "margin-top:36px;font-size:13px;color:rgba(203,213,225,0.9);",
  footer:
    "margin-top:32px;padding-top:24px;border-top:1px solid rgba(148,163,184,0.18);font-size:11px;color:rgba(148,163,184,0.8);line-height:18px;",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMetadata(metadata: NotificationRecord["metadata"]): string {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  if (Array.isArray(metadata)) {
    return metadata
      .map(
        (item, index) =>
          `<div style="${INLINE_STYLES.metadataRow}"><strong>Item ${
            index + 1
          }</strong><div style="margin-top:6px;opacity:0.8;font-size:12px;">${escapeHtml(
            JSON.stringify(item, null, 2)
          )}</div></div>`
      )
      .join("");
  }

  return Object.entries(metadata)
    .map(
      ([key, value]) =>
        `<div style="${INLINE_STYLES.metadataRow}"><strong>${escapeHtml(
          key
        )}</strong><div style="margin-top:6px;opacity:0.8;font-size:12px;">${escapeHtml(
          typeof value === "string" ? value : JSON.stringify(value, null, 2)
        )}</div></div>`
    )
    .join("");
}

function buildEmailHtml(
  notification: NotificationRecord,
  recipientName?: string | null
): string {
  const { title, body, metadata, triggered_at, cta_label, cta_url } =
    notification;

  const safeBody = escapeHtml(body ?? "").replace(/\n/g, "<br/>");
  const safeTitle = escapeHtml(title ?? "Inside Karachi update");
  const metadataHtml = renderMetadata(metadata);
  const absoluteCtaUrl = resolveEmailCtaUrl(cta_url);

  const ctaButton = absoluteCtaUrl
    ? `<a href="${escapeHtml(absoluteCtaUrl)}" style="${
        INLINE_STYLES.button
      }" target="_blank" rel="noopener noreferrer">${escapeHtml(
        cta_label ?? "View details"
      )}</a>`
    : "";

  const friendlyGreeting = recipientName
    ? `Hi ${escapeHtml(recipientName)},`
    : "Hi there,";

  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>${safeTitle}</title>
  </head>
  <body style="${INLINE_STYLES.body}">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <div style="${INLINE_STYLES.container}">
            <div style="${INLINE_STYLES.card}">
              <div style="${INLINE_STYLES.logoContainer}">
                <img src="${emailSiteUrl()}/logo-white.png" alt="Inside Karachi" style="${
    INLINE_STYLES.logo
  }" />
              </div>
              <p style="margin:0 0 18px 0;font-size:15px;color:rgba(226,232,240,0.88);letter-spacing:0.01em;">${friendlyGreeting}</p>
              <h1 style="${INLINE_STYLES.title}">${safeTitle}</h1>
              <p style="margin:20px 0 0 0;font-size:16px;line-height:26px;color:rgba(226,232,240,0.95);letter-spacing:0.01em;">
                ${safeBody}
              </p>
              ${ctaButton}
              <div style="${INLINE_STYLES.meta}">
                <div style="opacity:0.7;text-transform:uppercase;font-size:11px;letter-spacing:0.08em;margin-bottom:12px;">Notification details</div>
                <div style="${
                  INLINE_STYLES.metadataRow
                }"><strong>Priority</strong><div style="margin-top:6px;opacity:0.8;font-size:12px;text-transform:capitalize;">${escapeHtml(
    notification.priority
  )}</div></div>
                <div style="${
                  INLINE_STYLES.metadataRow
                }"><strong>Triggered at</strong><div style="margin-top:6px;opacity:0.8;font-size:12px;">${new Date(
    triggered_at
  ).toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    year: "numeric",
  })}</div></div>
                ${metadataHtml}
              </div>
              <div style="${INLINE_STYLES.signature}">
                <div>Warm regards,</div>
                <div style="margin-top:4px;font-weight:600;color:#f8fafc;">Inside Karachi Team</div>
              </div>
            </div>
            <div style="${INLINE_STYLES.footer}">
              You are receiving this email because you opted in to Inside Karachi notifications.
              If you would like to update your preferences, visit your dashboard settings.
            </div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText(
  notification: NotificationRecord,
  recipientName?: string | null
): string {
  const lines: string[] = [];
  lines.push(recipientName ? `Hi ${recipientName},` : "Hi there,");
  lines.push("");
  lines.push(notification.title ?? "Inside Karachi update");
  lines.push("");
  lines.push(notification.body ?? "");
  lines.push("");
  lines.push(`Priority: ${notification.priority}`);
  lines.push(
    `Triggered at: ${new Date(notification.triggered_at).toLocaleString()}`
  );
  const absoluteCtaUrl = resolveEmailCtaUrl(notification.cta_url);
  if (absoluteCtaUrl) {
    lines.push("");
    lines.push(`View details: ${absoluteCtaUrl}`);
  }
  lines.push("");
  lines.push("— Inside Karachi Team");
  return lines.join("\n");
}

function assertBrevoConfig() {
  if (!BREVO_API_KEY) {
    throw new NotificationEmailError(
      "BREVO_API_KEY is not configured. Email notifications cannot be dispatched."
    );
  }
}

export async function sendNotificationEmail(
  params: SendNotificationEmailParams
): Promise<SendNotificationEmailResult> {
  assertBrevoConfig();

  const { notification, recipient, customHtml } = params;

  if (!recipient.email) {
    throw new NotificationEmailError("Recipient email is required");
  }

  const subject = notification.title ?? "Inside Karachi notification";

  // Use custom HTML if provided, otherwise use default template
  const htmlContent =
    customHtml || buildEmailHtml(notification, recipient.fullName);
  const textContent = buildEmailText(notification, recipient.fullName);

  const response = await fetch(BREVO_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      "api-key": BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: {
        email: BREVO_SENDER_EMAIL,
        name: BREVO_SENDER_NAME,
      },
      to: [
        {
          email: recipient.email,
          name: recipient.fullName ?? undefined,
        },
      ],
      subject,
      htmlContent,
      textContent,
      headers: {
        "X-IK-Notification-ID": notification.id,
        "X-IK-Notification-Category": notification.category_slug ?? "unknown",
      },
      tags: [
        "inside-karachi",
        `notification:${notification.category_slug ?? "general"}`,
        `priority:${notification.priority}`,
      ],
      params: {
        notificationId: notification.id,
        category: notification.category_slug,
      },
    }),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new NotificationEmailError(
      `Brevo email send failed with status ${response.status}`,
      errorBody
    );
  }

  try {
    const data = (await response.json()) as { messageId?: string } | null;
    return {
      providerMessageId: data?.messageId ?? null,
    };
  } catch {
    return { providerMessageId: null };
  }
}
