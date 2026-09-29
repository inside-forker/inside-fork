import { query } from "@/lib/db";
import type { Json } from "@/types/database";

export type AuditAction =
  // User Management
  | "user_created"
  | "user_deleted"
  | "user_updated"
  | "user_role_changed"
  | "user_password_changed"
  | "user_email_changed"
  | "user_login"
  | "user_logout"
  | "user_login_failed"
  | "user_signup"
  | "account_self_deleted"
  | "content_reported"
  | "content_report_dismissed"
  // Admin Actions
  | "admin_user_created"
  | "admin_user_deleted"
  | "admin_user_updated"
  | "admin_bulk_operation"
  // Profile Updates
  | "profile_updated"
  | "avatar_updated"
  // Security Events
  | "password_reset_requested"
  | "password_reset_completed"
  | "email_verification_sent"
  | "email_verified"
  // Business Operations
  | "listing_created"
  | "listing_updated"
  | "listing_deleted"
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "review_created"
  | "review_updated"
  | "review_deleted"
  // Blog Operations
  | "post_created"
  | "post_updated"
  | "post_deleted"
  | "writer_application_reviewed"
  // Category Operations
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "category_archived"
  | "category_unarchived"
  | "category_bulk_operation"
  // Notifications
  | "notification_sent"
  | "notification_failed";

export interface AuditLogData {
  admin_id?: string;
  user_id?: string;
  action: AuditAction;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

// Callers commonly fall back to the literal string "unknown" when no IP
// header is present; `inet` rejects anything that isn't a valid address.
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+:[0-9a-fA-F:]*$/;

export async function logAuditEvent(data: AuditLogData) {
  try {
    const ipAddress =
      data.ip_address && IP_REGEX.test(data.ip_address)
        ? data.ip_address
        : null;

    await query(
      `INSERT INTO public.audit_logs
         (admin_id, user_id, action, entity_type, entity_id, old_values, new_values, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.admin_id || null,
        data.user_id || null,
        data.action,
        data.entity_type || null,
        data.entity_id || null,
        (data.old_values || null) as Json | null,
        (data.new_values || null) as Json | null,
        (data.metadata || null) as Json | null,
        ipAddress,
        data.user_agent || null,
      ],
    );
  } catch (error) {
    console.error("Audit logging error:", error);
    // Don't throw error to avoid breaking the main operation
  }
}

// Helper functions for common audit events
export async function logUserCreation(
  adminId: string,
  userId: string,
  userData: Record<string, unknown>,
  ipAddress?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    user_id: userId,
    action: "admin_user_created",
    entity_type: "user",
    entity_id: userId,
    new_values: userData,
    ip_address: ipAddress,
  });
}

export async function logUserDeletion(
  adminId: string,
  userId: string,
  userData: Record<string, unknown>,
  ipAddress?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    user_id: userId,
    action: "admin_user_deleted",
    entity_type: "user",
    entity_id: userId,
    old_values: userData,
    ip_address: ipAddress,
  });
}

export async function logUserUpdate(
  adminId: string,
  userId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  ipAddress?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    user_id: userId,
    action: "admin_user_updated",
    entity_type: "user",
    entity_id: userId,
    old_values: oldData,
    new_values: newData,
    ip_address: ipAddress,
  });
}

export async function logUserLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    user_id: userId,
    action: "user_login",
    entity_type: "user",
    entity_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logUserLogout(userId: string, ipAddress?: string) {
  await logAuditEvent({
    user_id: userId,
    action: "user_logout",
    entity_type: "user",
    entity_id: userId,
    ip_address: ipAddress,
  });
}

export async function logFailedLogin(
  email: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    action: "user_login_failed",
    entity_type: "auth",
    metadata: { email },
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logPasswordChange(userId: string, ipAddress?: string) {
  await logAuditEvent({
    user_id: userId,
    action: "user_password_changed",
    entity_type: "user",
    entity_id: userId,
    ip_address: ipAddress,
  });
}

export async function logContentReport(
  reporterId: string,
  contentType: "review" | "comment",
  contentId: number,
  reason: string,
  ipAddress?: string,
) {
  await logAuditEvent({
    user_id: reporterId,
    action: "content_reported",
    entity_type: contentType,
    entity_id: String(contentId),
    metadata: { reason },
    ip_address: ipAddress,
  });
}

export async function logContentReportDismissed(
  adminId: string,
  contentType: "review" | "comment",
  contentId: number,
  ipAddress?: string,
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "content_report_dismissed",
    entity_type: contentType,
    entity_id: String(contentId),
    ip_address: ipAddress,
  });
}

export async function logAccountDeletion(userId: string, ipAddress?: string) {
  await logAuditEvent({
    user_id: userId,
    action: "account_self_deleted",
    entity_type: "profile",
    entity_id: userId,
    ip_address: ipAddress,
  });
}

export async function logProfileUpdate(
  userId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  ipAddress?: string
) {
  await logAuditEvent({
    user_id: userId,
    action: "profile_updated",
    entity_type: "profile",
    entity_id: userId,
    old_values: oldData,
    new_values: newData,
    ip_address: ipAddress,
  });
}

export async function logPasswordResetRequest(
  email: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    action: "password_reset_requested",
    entity_type: "auth",
    metadata: { email },
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logPasswordResetCompleted(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    user_id: userId,
    action: "password_reset_completed",
    entity_type: "user",
    entity_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logUserSignup(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    user_id: userId,
    action: "user_signup",
    entity_type: "user",
    entity_id: userId,
    metadata: { email },
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logListingCreation(
  adminId: string,
  listingId: string,
  listingData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "listing_created",
    entity_type: "listing",
    entity_id: listingId,
    new_values: listingData,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logNotificationSent(
  notificationId: string,
  channel: string,
  metadata?: Record<string, unknown>
) {
  await logAuditEvent({
    action: "notification_sent",
    entity_type: "notification",
    entity_id: notificationId,
    new_values: { channel, ...(metadata ?? {}) },
  });
}

export async function logNotificationFailed(
  notificationId: string,
  channel: string,
  error: unknown,
  metadata?: Record<string, unknown>
) {
  await logAuditEvent({
    action: "notification_failed",
    entity_type: "notification",
    entity_id: notificationId,
    metadata: {
      channel,
      error:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : error,
      ...(metadata ?? {}),
    },
  });
}

export async function logListingUpdate(
  adminId: string,
  listingId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "listing_updated",
    entity_type: "listing",
    entity_id: listingId,
    old_values: oldData,
    new_values: newData,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logListingDeletion(
  adminId: string,
  listingId: string,
  listingData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "listing_deleted",
    entity_type: "listing",
    entity_id: listingId,
    old_values: listingData,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logEventCreation(
  adminId: string,
  eventId: string,
  eventData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "event_created",
    entity_type: "event",
    entity_id: eventId,
    new_values: eventData,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logEventUpdate(
  adminId: string,
  eventId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  // Calculate which fields changed
  const changedFields: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    if (oldData[key] !== newData[key]) {
      changedFields[key] = {
        old: oldData[key],
        new: newData[key],
      };
    }
  }

  // Create human-readable change summary
  const changedFieldNames = Object.keys(changedFields);
  const changesSummary = changedFieldNames
    .map((field) => {
      const fieldLabel = field
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
      const oldVal = changedFields[field].old;
      const newVal = changedFields[field].new;
      return `${fieldLabel}: ${oldVal || "empty"} → ${newVal || "empty"}`;
    })
    .join("; ");

  await logAuditEvent({
    admin_id: adminId,
    action: "event_updated",
    entity_type: "event",
    entity_id: eventId,
    old_values: oldData,
    new_values: newData,
    metadata: {
      changed_fields: changedFieldNames,
      changes_count: changedFieldNames.length,
      changes_summary: changesSummary,
    },
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}

export async function logEventDeletion(
  adminId: string,
  eventId: string,
  eventData: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
) {
  await logAuditEvent({
    admin_id: adminId,
    action: "event_deleted",
    entity_type: "event",
    entity_id: eventId,
    old_values: eventData,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
}
