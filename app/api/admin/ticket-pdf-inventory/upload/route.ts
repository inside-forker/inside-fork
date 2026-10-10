import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  PdfInventoryGateError,
  requirePdfInventoryEmailAllowed,
  requirePdfInventoryUnlock,
} from "@/lib/ticketing/pdf-inventory-gate";
import { parsePdfInventoryUploadForm } from "@/lib/ticketing/parse-pdf-inventory-upload";
import { uploadPdfsToInventory } from "@/lib/ticketing/pdf-inventory-upload";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/ticket-pdf-inventory/upload
 * Multipart: ticket_type_id, files (or file), optional external_ticket_id.
 * Allowlisted account + admin auth + passcode unlock cookie.
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
      requirePdfInventoryUnlock(request, String(admin.profile.id));
    } catch (error) {
      if (error instanceof PdfInventoryGateError) {
        return NextResponse.json(
          { success: false, code: error.code, error: error.message },
          { status: error.status },
        );
      }
      throw error;
    }

    const parsed = await parsePdfInventoryUploadForm(request);
    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const { rows: typeRows } = await query<{
      id: number | string;
      name: string;
      event_id: number | string;
    }>(
      `SELECT id, name, event_id FROM ticket_types WHERE id = $1`,
      [parsed.ticketTypeId],
    );
    if (!typeRows[0]) {
      return NextResponse.json(
        { success: false, error: "Ticket type not found" },
        { status: 404 },
      );
    }

    const outcome = await uploadPdfsToInventory({
      ticketTypeId: parsed.ticketTypeId,
      files: parsed.files,
    });

    return NextResponse.json({
      success: true,
      data: {
        ticket_type_id: parsed.ticketTypeId,
        ticket_type_name: typeRows[0].name,
        event_id: Number(typeRows[0].event_id),
        inserted: outcome.inserted,
        skipped: outcome.skipped,
        quantity_available: outcome.quantity_available,
        results: outcome.results,
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/ticket-pdf-inventory/upload",
      method: "POST",
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
