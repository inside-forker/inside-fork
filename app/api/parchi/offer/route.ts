import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getParchiOffer } from "@/lib/parchi/service";
import { parchiWebErrorResponse } from "@/lib/parchi/http";

export const dynamic = "force-dynamic";

/** GET /api/parchi/offer?eventId=123 - web twin of the mobile offer route. */
export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const eventId = Number(request.nextUrl.searchParams.get("eventId"));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ offer: await getParchiOffer(eventId) });
  } catch (err) {
    return parchiWebErrorResponse(err, "/api/parchi/offer");
  }
}
