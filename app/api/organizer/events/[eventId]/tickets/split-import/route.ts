import { NextRequest } from "next/server";
import { POST as adminSplitImport } from "@/app/api/admin/events/[id]/tickets/split-import/route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  return adminSplitImport(request, { params: Promise.resolve({ id: eventId }) });
}

