import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

// Runs hourly (see vercel.json). Each window below is an approximate
// 1-hour bucket ending `hoursBefore` hours before an event's start_time -
// this only reliably catches every event if the cron fires every hour
// without long gaps, since a missed hour means a missed window (there's no
// backfill/catch-up logic here). Booking must be paid to count as a real
// attendee. dedupeKey is scoped by (recipient, key) in createNotification,
// so re-running this cron for the same hour is safe and won't double-send.
const WINDOWS: Array<{ hoursBefore: number; slug: "tomorrow" | "starting_soon" }> = [
  { hoursBefore: 24, slug: "tomorrow" },
  { hoursBefore: 3, slug: "starting_soon" },
];

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary: Record<string, { events: number; notified: number }> = {};

  try {
    for (const window of WINDOWS) {
      const { rows: events } = await query(
        `SELECT id, name, start_time, location_name
         FROM public.events
         WHERE start_time BETWEEN
           NOW() + ($1::int - 1) * INTERVAL '1 hour' AND
           NOW() + $1::int * INTERVAL '1 hour'`,
        [window.hoursBefore]
      );

      let notified = 0;

      for (const event of events) {
        const { rows: attendees } = await query(
          `SELECT DISTINCT user_id FROM public.bookings
           WHERE event_id = $1 AND payment_status = 'paid' AND user_id IS NOT NULL`,
          [event.id]
        );

        const title =
          window.slug === "tomorrow"
            ? `📅 ${event.name} is tomorrow`
            : `⏰ ${event.name} starts soon`;
        const body =
          window.slug === "tomorrow"
            ? `Your event is happening tomorrow${
                event.location_name ? ` at ${event.location_name}` : ""
              }. Get ready!`
            : `Your event starts in a few hours${
                event.location_name ? ` at ${event.location_name}` : ""
              }.`;

        await Promise.allSettled(
          attendees.map(async (attendee) => {
            try {
              await createNotification({
                recipientId: attendee.user_id,
                roleScope: "public_user",
                categorySlug: "public_event_reminder",
                title,
                body,
                priority: "high",
                ctaLabel: "View My Tickets",
                ctaUrl: `/dashboard/bookings`,
                dedupeKey: `event-reminder-${event.id}-${window.slug}`,
                metadata: {
                  event_id: event.id,
                  event_name: event.name,
                  window: window.slug,
                },
              });
              notified += 1;
            } catch (notifyError) {
              console.error(
                `Failed to send ${window.slug} reminder for event ${event.id} to ${attendee.user_id}:`,
                notifyError
              );
            }
          })
        );
      }

      summary[window.slug] = { events: events.length, notified };
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("POST /api/cron/event-reminders failed", error);
    return NextResponse.json(
      { error: "Failed to send event reminders" },
      { status: 500 }
    );
  }
}
