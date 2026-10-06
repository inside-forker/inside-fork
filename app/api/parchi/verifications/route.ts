import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { startParchiVerification } from "@/lib/parchi/service";
import { parchiWebErrorResponse } from "@/lib/parchi/http";

export const dynamic = "force-dynamic";

const ROUTE = "/api/parchi/verifications";

/**
 * POST /api/parchi/verifications { eventId, parchiId }
 * Web twin of the mobile route - see lib/parchi/service.ts.
 */
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const eventId = Number(body?.eventId);
  const parchiId = body?.parchiId;
  if (!Number.isInteger(eventId) || eventId <= 0 || typeof parchiId !== "string") {
    return NextResponse.json(
      { error: "eventId and parchiId are required" },
      { status: 400 },
    );
  }
  try {
    const view = await startParchiVerification({
      userId: session.userId,
      eventId,
      parchiId,
      route: ROUTE,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    return parchiWebErrorResponse(err, ROUTE);
  }
}
