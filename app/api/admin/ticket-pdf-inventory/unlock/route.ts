import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  applyUnlockCookie,
  consumeUnlockAttempt,
  isPdfInventoryPasscodeConfigured,
  PdfInventoryGateError,
  requirePdfInventoryEmailAllowed,
  verifyPdfInventoryPasscode,
} from "@/lib/ticketing/pdf-inventory-gate";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ticket-pdf-inventory/unlock
 * Validates the shared ops passcode and sets an HttpOnly unlock cookie.
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

    if (!isPdfInventoryPasscodeConfigured()) {
      return NextResponse.json(
        {
          success: false,
          code: "passcode_not_configured",
          error: "Ticket PDF inventory passcode is not configured.",
        },
        { status: 503 },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateKey = `${admin.profile.id}:${ip}`;
    if (!consumeUnlockAttempt(rateKey)) {
      return NextResponse.json(
        {
          success: false,
          code: "rate_limited",
          error: "Too many passcode attempts. Try again in a few minutes.",
        },
        { status: 429 },
      );
    }

    let body: { passcode?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    const passcode =
      typeof body.passcode === "string" ? body.passcode.trim() : "";
    if (!passcode || !verifyPdfInventoryPasscode(passcode)) {
      return NextResponse.json(
        {
          success: false,
          code: "invalid_passcode",
          error: "Incorrect passcode.",
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ success: true });
    applyUnlockCookie(response, String(admin.profile.id));
    return response;
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/ticket-pdf-inventory/unlock",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Failed to unlock" },
      { status: 500 },
    );
  }
}
