import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import rateLimiter from "@/lib/rate-limiter";
import { claimInvite, normalizeInviteCode } from "@/lib/events/invites";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

/**
 * POST /api/invites/claim { code } — locks an invite-only event code to the
 * logged-in user. Opening /i/[code] never claims; only this explicit POST does.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Log in to accept your invite" }, { status: 401 });
    }

    const limit = rateLimiter.check(`invite-claim:${session.userId}`, 10, 15 * 60000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a few minutes." },
        { status: 429 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? normalizeInviteCode(body.code) : null;
    if (!code) {
      return NextResponse.json({ error: "This invite link isn't valid" }, { status: 404 });
    }

    const result = await claimInvite(code, session.userId);
    if (!result.ok) {
      return result.reason === "used"
        ? NextResponse.json({ error: "This invite has already been used" }, { status: 409 })
        : NextResponse.json({ error: "This invite link isn't valid" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, redirect: `/invite/${result.eventSlug}` });
  } catch (error) {
    captureRouteError(error, { route: "/api/invites/claim", method: "POST" });
    return NextResponse.json({ error: "Couldn't accept the invite" }, { status: 500 });
  }
}
