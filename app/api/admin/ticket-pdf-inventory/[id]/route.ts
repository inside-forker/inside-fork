import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import { getObjectBuffer } from "@/lib/storage/spaces";
import {
  PdfInventoryGateError,
  requirePdfInventoryEmailAllowed,
  requirePdfInventoryUnlock,
} from "@/lib/ticketing/pdf-inventory-gate";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ticket-pdf-inventory/:id
 * Admin download/view of any inventory PDF (sold or available).
 * Pass ?inline=1 to open in the browser instead of forcing download.
 * Allowlisted account + admin auth + passcode unlock cookie.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

    const { id } = await context.params;
    const inventoryId = Number(id);
    if (!Number.isInteger(inventoryId) || inventoryId < 1) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows } = await query(
      `SELECT id, storage_key, original_filename, external_ticket_id
       FROM ticket_pdf_inventory
       WHERE id = $1`,
      [inventoryId],
    );
    const pdf = rows[0];
    if (!pdf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { body, contentType } = await getObjectBuffer(String(pdf.storage_key));
    const filename =
      (pdf.original_filename as string | null) ||
      `ticket-${pdf.external_ticket_id}.pdf`;
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/ticket-pdf-inventory/[id]",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Failed to load ticket PDF" },
      { status: 500 },
    );
  }
}
