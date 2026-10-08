import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getObjectBuffer } from "@/lib/storage/spaces";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/:id/ticket-pdfs/:inventoryId
 * Owner-scoped download of an assigned organizer PDF ticket.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; inventoryId: string }> },
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, inventoryId } = await context.params;
    const bookingId = Number(id);
    const pdfId = Number(inventoryId);
    if (
      !Number.isInteger(bookingId) ||
      bookingId < 1 ||
      !Number.isInteger(pdfId) ||
      pdfId < 1
    ) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { rows: bookingRows } = await query(
      `SELECT id, user_id, payment_status
       FROM bookings
       WHERE id = $1`,
      [bookingId],
    );
    const booking = bookingRows[0];
    if (!booking || String(booking.user_id) !== String(session.userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (String(booking.payment_status).toLowerCase() !== "paid") {
      return NextResponse.json(
        { error: "Tickets are available after payment" },
        { status: 403 },
      );
    }

    const { rows: pdfRows } = await query(
      `SELECT id, storage_key, original_filename, external_ticket_id
       FROM ticket_pdf_inventory
       WHERE id = $1 AND booking_id = $2`,
      [pdfId, bookingId],
    );
    const pdf = pdfRows[0];
    if (!pdf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { body, contentType } = await getObjectBuffer(String(pdf.storage_key));
    const filename =
      (pdf.original_filename as string | null) ||
      `ticket-${pdf.external_ticket_id}.pdf`;

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/pdf",
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/bookings/[id]/ticket-pdfs/[inventoryId]",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Failed to download ticket" },
      { status: 500 },
    );
  }
}
