import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { refreshParchiVerification } from "@/lib/parchi/service";
import { parchiWebErrorResponse } from "@/lib/parchi/http";

export const dynamic = "force-dynamic";

const ROUTE = "/api/parchi/verifications/[id]";

/** GET /api/parchi/verifications/{id} - owner-scoped status poll. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(
      await refreshParchiVerification({
        userId: session.userId,
        requestId: (await params).id,
        route: ROUTE,
      }),
    );
  } catch (err) {
    return parchiWebErrorResponse(err, ROUTE);
  }
}
