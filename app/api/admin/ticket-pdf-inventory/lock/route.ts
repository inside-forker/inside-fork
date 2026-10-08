import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  clearUnlockCookie,
  PdfInventoryGateError,
  requirePdfInventoryEmailAllowed,
} from "@/lib/ticketing/pdf-inventory-gate";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ticket-pdf-inventory/lock
 * Clears the HttpOnly unlock cookie.
 */
export async function POST(request: NextRequest) {
  try {
    let admin;
    try {
      admin = await requireAdmin(request);
    } catch (error) {
      const status = getAdminAuthErrorStatus(error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unauthorized",
        },
        { status: status ?? 500 },
      );
    }

    try {
      requirePdfInventoryEmailAllowed(admin.user.email);
    } catch (error) {
      if (error instanceof PdfInventoryGateError) {
        return NextResponse.json(
          { success: false, code: error.code, error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }

    const response = NextResponse.json({ success: true });
    clearUnlockCookie(response);
    return response;
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/ticket-pdf-inventory/lock",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Failed to lock" },
      { status: 500 },
    );
  }
}
