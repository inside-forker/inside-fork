import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAdmin, getAdminAuthErrorStatus } from "@/lib/auth/admin";
import {
  PdfInventoryGateError,
  requirePdfInventoryEmailAllowed,
  requirePdfInventoryUnlock,
} from "@/lib/ticketing/pdf-inventory-gate";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ticket-pdf-inventory
 * Live inventory of organizer PDF tickets (sold vs available) with buyer info.
 * Allowlisted account + admin auth + passcode unlock cookie.
 */
export async function GET(request: NextRequest) {
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

    const eventSlug = new URL(request.url).searchParams.get("event_slug");

    const { rows: tickets } = await query(
      `SELECT
         i.id,
         i.external_ticket_id,
         i.original_filename,
         i.storage_key,
         i.ticket_type_id,
         i.booking_id,
         i.assigned_at,
         i.created_at,
         tt.name AS ticket_type_name,
         tt.price AS ticket_type_price,
         e.id AS event_id,
         e.name AS event_name,
         e.slug AS event_slug,
         b.booking_reference,
         b.payment_status,
         b.customer_name,
         b.customer_email,
         b.customer_phone,
         b.total_amount AS booking_total,
         CASE WHEN v.request_id IS NULL THEN false ELSE true END AS is_parchi,
         v.parchi_id
       FROM ticket_pdf_inventory i
       INNER JOIN ticket_types tt ON tt.id = i.ticket_type_id
       INNER JOIN events e ON e.id = tt.event_id
       LEFT JOIN bookings b ON b.id = i.booking_id
       LEFT JOIN parchi_verifications v
         ON v.booking_id = i.booking_id AND v.status = 'approved'
       WHERE ($1::text IS NULL OR lower(e.slug) = lower($1))
       ORDER BY
         CASE WHEN i.booking_id IS NULL THEN 0 ELSE 1 END,
         i.assigned_at DESC NULLS LAST,
         i.id ASC`,
      [eventSlug],
    );

    const byTypeMap = new Map<
      number,
      {
        ticket_type_id: number;
        ticket_type_name: string;
        event_id: number;
        event_name: string;
        event_slug: string;
        price: number;
        total: number;
        sold: number;
        available: number;
      }
    >();

    for (const row of tickets) {
      const typeId = Number(row.ticket_type_id);
      let bucket = byTypeMap.get(typeId);
      if (!bucket) {
        bucket = {
          ticket_type_id: typeId,
          ticket_type_name: String(row.ticket_type_name),
          event_id: Number(row.event_id),
          event_name: String(row.event_name),
          event_slug: String(row.event_slug),
          price: Number(row.ticket_type_price ?? 0),
          total: 0,
          sold: 0,
          available: 0,
        };
        byTypeMap.set(typeId, bucket);
      }
      bucket.total += 1;
      if (row.booking_id != null) bucket.sold += 1;
      else bucket.available += 1;
    }

    const tiers = [...byTypeMap.values()];
    const total = tickets.length;
    const sold = tickets.filter((t) => t.booking_id != null).length;
    const available = total - sold;

    return NextResponse.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        summary: { total, sold, available },
        tiers,
        tickets: tickets.map((row) => ({
          id: Number(row.id),
          external_ticket_id: String(row.external_ticket_id),
          original_filename: (row.original_filename as string | null) ?? null,
          ticket_type_id: Number(row.ticket_type_id),
          ticket_type_name: String(row.ticket_type_name),
          event_id: Number(row.event_id),
          event_name: String(row.event_name),
          event_slug: String(row.event_slug),
          status: row.booking_id != null ? "sold" : "available",
          booking_id: row.booking_id != null ? Number(row.booking_id) : null,
          booking_reference: (row.booking_reference as string | null) ?? null,
          payment_status: (row.payment_status as string | null) ?? null,
          customer_name: (row.customer_name as string | null) ?? null,
          customer_email: (row.customer_email as string | null) ?? null,
          customer_phone: (row.customer_phone as string | null) ?? null,
          booking_total:
            row.booking_total != null ? Number(row.booking_total) : null,
          is_parchi: Boolean(row.is_parchi),
          parchi_id: (row.parchi_id as string | null) ?? null,
          assigned_at: row.assigned_at
            ? new Date(row.assigned_at as string | Date).toISOString()
            : null,
          created_at: new Date(row.created_at as string | Date).toISOString(),
          view_url: `/api/admin/ticket-pdf-inventory/${row.id}?inline=1`,
          download_url: `/api/admin/ticket-pdf-inventory/${row.id}`,
        })),
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/ticket-pdf-inventory",
      method: "GET",
    });
    return NextResponse.json(
      { success: false, error: "Failed to load PDF inventory" },
      { status: 500 },
    );
  }
}
