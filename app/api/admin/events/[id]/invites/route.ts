import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  createInvites,
  inviteUrl,
  listInvites,
  MAX_INVITES_PER_BATCH,
} from "@/lib/events/invites";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

async function guard(request: NextRequest) {
  try {
    await requireAdmin(request);
    return null;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unauthorized" },
      { status: getAdminAuthErrorStatus(error) ?? 500 },
    );
  }
}

function csvCell(value: string | null | undefined) {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * GET /api/admin/events/[id]/invites — codes with claimed/booked state.
 * ?format=csv downloads code, link, label, claimed by, booked.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guard(request);
  if (denied) return denied;

  try {
    const eventId = Number((await params).id);
    if (!Number.isInteger(eventId)) {
      return NextResponse.json({ success: false, error: "Invalid event ID" }, { status: 400 });
    }

    const invites = await listInvites(eventId);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    if (request.nextUrl.searchParams.get("format") === "csv") {
      const lines = [
        "code,link,label,claimed_by,claimed_at,booked",
        ...invites.map((i) =>
          [
            i.code,
            inviteUrl(origin, i.code),
            i.label,
            i.claimed_by_email,
            i.claimed_at,
            i.booked ? "yes" : "no",
          ]
            .map(csvCell)
            .join(","),
        ),
      ];
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="event-${eventId}-invites.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      invites: invites.map((i) => ({ ...i, link: inviteUrl(origin, i.code) })),
      counts: {
        total: invites.length,
        claimed: invites.filter((i) => i.claimed_at).length,
        booked: invites.filter((i) => i.booked).length,
      },
    });
  } catch (error) {
    captureRouteError(error, { route: "/api/admin/events/[id]/invites", method: "GET" });
    return NextResponse.json({ success: false, error: "Failed to load invites" }, { status: 500 });
  }
}

/** POST { count, labels? } — generates new codes for the event. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await guard(request);
  if (denied) return denied;

  try {
    const eventId = Number((await params).id);
    if (!Number.isInteger(eventId)) {
      return NextResponse.json({ success: false, error: "Invalid event ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const labels: (string | null)[] = Array.isArray(body.labels)
      ? body.labels.map((l: unknown) => (typeof l === "string" ? l : null))
      : [];
    const count = Number(body.count ?? labels.length);
    if (!Number.isInteger(count) || count < 1 || count > MAX_INVITES_PER_BATCH) {
      return NextResponse.json(
        { success: false, error: `Count must be 1–${MAX_INVITES_PER_BATCH}` },
        { status: 400 },
      );
    }

    const codes = await createInvites(eventId, count, labels);
    return NextResponse.json({ success: true, created: codes.length });
  } catch (error) {
    captureRouteError(error, { route: "/api/admin/events/[id]/invites", method: "POST" });
    return NextResponse.json({ success: false, error: "Failed to create invites" }, { status: 500 });
  }
}
