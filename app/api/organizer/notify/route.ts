import { NextRequest, NextResponse } from "next/server";
import { notifyOrganizer, type NotifyOrganizerInput } from "@/lib/organizer/notify";

export const dynamic = "force-dynamic";

// Internal/cron-only endpoint - this fires system-triggered notifications
// (ticket sales, check-ins, milestones) to an event's organizer. It is not
// meant to be called by end users, so it's gated the same way as
// /api/notifications/dispatch rather than by a user session.
const NOTIFY_SECRET =
  process.env.ORGANIZER_NOTIFY_TOKEN ?? process.env.CRON_SECRET ?? null;

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader?.length) {
    return cronHeader.trim();
  }

  return null;
}

function isAuthorized(request: NextRequest): boolean {
  if (!NOTIFY_SECRET) {
    console.warn(
      "POST /api/organizer/notify: no ORGANIZER_NOTIFY_TOKEN or CRON_SECRET configured - denying request"
    );
    return false;
  }

  return extractToken(request) === NOTIFY_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: NotifyOrganizerInput = await request.json();

    if (!body.type || !body.eventId) {
      return NextResponse.json(
        { error: "type and eventId required" },
        { status: 400 }
      );
    }

    const result = await notifyOrganizer(body);

    return NextResponse.json({
      success: true,
      notificationId: result.notification.id,
    });
  } catch (error) {
    console.error("Organizer notification error:", error);
    const status =
      error instanceof Error && error.message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send notification",
      },
      { status }
    );
  }
}
