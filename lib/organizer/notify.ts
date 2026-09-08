import { query } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import type { NotificationUserRole } from "@/types/notifications.types";

export type OrganizerNotificationType =
  | "ticket_sale"
  | "check_in"
  | "milestone"
  | "event_reminder";

export interface NotifyOrganizerInput {
  type: OrganizerNotificationType;
  eventId: number;
  data?: {
    ticketCount?: number;
    totalAmount?: number;
    buyerName?: string;
    attendeeName?: string;
    milestonePercent?: number;
    hoursUntil?: number;
  };
}

/**
 * System-triggered notifications to an event's organizer (ticket sales,
 * check-ins, sell-through milestones, reminders). Called directly from
 * server-side flows (checkout, check-in scanning) - not exposed to end
 * users, so callers are trusted and no per-call auth happens here. The
 * HTTP route wrapping this (app/api/organizer/notify) is for internal/cron
 * use only and is itself secret-gated.
 */
export async function notifyOrganizer(input: NotifyOrganizerInput) {
  const { type, eventId, data } = input;

  const { rows: eventRows } = await query(
    `SELECT id, name, organizer_id FROM events WHERE id = $1`,
    [eventId]
  );
  const event = eventRows[0] as
    | { id: number; name: string; organizer_id: string }
    | undefined;

  if (!event) {
    throw new Error(`Event ${eventId} not found`);
  }

  const { rows: organizerRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [event.organizer_id]
  );
  const role = (organizerRows[0]?.role ?? "public_user") as NotificationUserRole;

  let title = "";
  let bodyText = "";
  let categorySlug = "";
  let ctaUrl = `/dashboard/organizer`;

  switch (type) {
    case "ticket_sale":
      categorySlug = "organizer_ticket_sale";
      title = `🎫 New Ticket Sale for ${event.name}`;
      bodyText = data?.buyerName
        ? `${data.buyerName} purchased ${
            data.ticketCount || 1
          } ticket(s) for PKR ${(data.totalAmount || 0).toLocaleString()}`
        : `${data?.ticketCount || 1} ticket(s) sold for PKR ${(
            data?.totalAmount || 0
          ).toLocaleString()}`;
      break;

    case "check_in":
      categorySlug = "organizer_check_in";
      // Milestone check-ins (25/50/75/100% of tickets scanned) get their own
      // message and dedupe key so callers can report a threshold crossing
      // without also spamming a bell notification per individual scan.
      if (data?.milestonePercent) {
        title =
          data.milestonePercent >= 100
            ? `✓ Everyone has checked in to ${event.name}!`
            : `✓ ${data.milestonePercent}% checked in to ${event.name}`;
        bodyText =
          data.milestonePercent >= 100
            ? "All ticket holders have been checked in."
            : `${data.milestonePercent}% of ticket holders have checked in so far.`;
      } else {
        title = `✓ Check-in at ${event.name}`;
        bodyText = data?.attendeeName
          ? `${data.attendeeName} has checked in`
          : "An attendee has checked in to your event";
      }
      break;

    case "milestone": {
      categorySlug = "organizer_milestone";
      const percent = data?.milestonePercent || 0;
      if (percent >= 100) {
        title = `🎉 ${event.name} is SOLD OUT!`;
        bodyText = "Congratulations! Your event has sold out.";
      } else {
        title = `📈 ${event.name} is ${percent}% sold`;
        bodyText = `Your event has reached ${percent}% capacity. Great progress!`;
      }
      break;
    }

    case "event_reminder": {
      categorySlug = "organizer_event_reminder";
      const hours = data?.hoursUntil || 24;
      title = `⏰ ${event.name} starts in ${hours} hours`;
      bodyText = `Your event is coming up soon. Make sure everything is ready!`;
      ctaUrl = `/events/${eventId}`;
      break;
    }

    default:
      throw new Error(`Invalid organizer notification type: ${type}`);
  }

  return createNotification({
    recipientId: event.organizer_id,
    roleScope: role,
    categorySlug,
    title,
    body: bodyText,
    metadata: {
      eventId,
      eventName: event.name,
      type,
      ...data,
    },
    priority:
      type === "milestone" && (data?.milestonePercent || 0) >= 100
        ? "high"
        : "normal",
    ctaLabel: "View Dashboard",
    ctaUrl,
    dedupeKey:
      type === "milestone"
        ? `organizer_milestone_${eventId}_${data?.milestonePercent}`
        : type === "check_in" && data?.milestonePercent
          ? `organizer_checkin_milestone_${eventId}_${data.milestonePercent}`
          : undefined,
  });
}
