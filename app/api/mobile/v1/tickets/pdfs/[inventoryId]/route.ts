import { NextResponse, type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { getObjectBuffer } from "@/lib/storage/spaces";
import { isBookingPaid } from "@/lib/mobile/commerce";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/tickets/pdfs/:inventoryId
 * Streams an assigned organizer PDF for the authenticated buyer.
 */
export const GET = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { inventoryId } = await context.params;
  const pdfId = Number(inventoryId);
  if (!Number.isInteger(pdfId) || pdfId < 1) {
    throw new MobileApiError(
      "validation_error",
      "A valid inventory id is required.",
      400,
      "inventoryId",
    );
  }

  const { rows } = await query(
    `SELECT i.id, i.storage_key, i.original_filename, i.external_ticket_id,
            b.payment_status, b.user_id
     FROM ticket_pdf_inventory i
     INNER JOIN bookings b ON b.id = i.booking_id
     WHERE i.id = $1`,
    [pdfId],
  );
  const row = rows[0];
  if (!row || String(row.user_id) !== String(user.id)) {
    throw new MobileApiError("not_found", "Ticket not found.", 404);
  }
  if (!isBookingPaid(row.payment_status)) {
    throw new MobileApiError(
      "forbidden",
      "Tickets are available after payment.",
      403,
    );
  }

  const { body, contentType } = await getObjectBuffer(String(row.storage_key));
  const filename =
    (row.original_filename as string | null) ||
    `ticket-${row.external_ticket_id}.pdf`;

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": contentType || "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
