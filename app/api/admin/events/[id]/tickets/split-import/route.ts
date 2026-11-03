import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { PDFDocument } from "pdf-lib";
import { PDFParse } from "pdf-parse";
import {
  uploadPdfToInventory,
  syncTicketTypeQuantityAvailable,
} from "@/lib/ticketing/pdf-inventory-upload";
import { captureRouteError } from "@/lib/sentry/captureRouteError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

async function verifyAccess(userId: string, eventId: number) {
  const { rows: profileRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [userId]
  );
  const profile = profileRows[0];
  if (!profile) return { error: "Profile not found", status: 404 } as const;

  const { rows: eventRows } = await query(
    `SELECT id, organizer_id, start_time, end_time FROM events WHERE id = $1`,
    [eventId]
  );
  const event = eventRows[0];
  if (!event) return { error: "Event not found", status: 404 } as const;

  const isOwner = event.organizer_id === userId;
  const isAdmin = ADMIN_ROLES.includes(profile.role);
  let isCoOrg = false;
  if (!isOwner && !isAdmin) {
    const { rows: coRows } = await query(
      `SELECT 1 FROM public.event_co_organizers WHERE event_id = $1 AND organizer_id = $2`,
      [eventId, userId]
    );
    isCoOrg = coRows.length > 0;
  }

  if (!isOwner && !isAdmin && !isCoOrg) {
    return { error: "Access denied", status: 403 } as const;
  }

  return { ok: true, event } as const;
}

/**
 * Infer group order from show title (e.g. Day 1 -> 1, Day 2 -> 2)
 */
function inferGroupOrder(show: string): number {
  const dayMatch = show.match(/Day\s*(\d+)/i);
  if (dayMatch) {
    return parseInt(dayMatch[1], 10);
  }
  return 0;
}

/**
 * POST /api/admin/events/[id]/tickets/split-import
 * Multi-part upload containing a bundled multi-page PDF (e.g. Ticketwala bundle).
 * Slices pages, groups by Show and Ticket, creates ticket types with pre-uploaded flow enabled,
 * and populates ticket_pdf_inventory.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (isNaN(eventId) || eventId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid event ID" },
        { status: 400 }
      );
    }

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const access = await verifyAccess(session.userId, eventId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const event = access.event;

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: "A valid PDF file is required" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: "Uploaded PDF file is empty" },
        { status: 400 }
      );
    }

    // Load source PDF with pdf-lib
    let srcDoc: PDFDocument;
    try {
      srcDoc = await PDFDocument.load(fileBuffer);
    } catch (_err) {
      return NextResponse.json(
        { success: false, error: "Could not parse PDF. Please ensure it is a valid PDF document." },
        { status: 400 }
      );
    }

    const pageCount = srcDoc.getPageCount();
    if (pageCount === 0) {
      return NextResponse.json(
        { success: false, error: "PDF has no pages." },
        { status: 400 }
      );
    }

    // Extract text from all pages with pdf-parse
    let parsedPages: Array<{ text: string }> = [];
    try {
      const parser = new PDFParse({ data: fileBuffer });
      const result = await parser.getText();
      parsedPages = result.pages || [];
    } catch (err) {
      console.warn("pdf-parse extraction warning, falling back to page index naming:", err);
    }

    // Group pages by (Show, Ticket)
    interface PageItem {
      pageIndex: number;
      show: string;
      ticket: string;
      invoiceId: string | null;
      buffer: Buffer;
    }

    const categoryMap = new Map<string, { show: string; ticket: string; pages: PageItem[] }>();

    for (let i = 0; i < pageCount; i++) {
      const text = parsedPages[i]?.text || "";
      const showMatch = text.match(/Show:\s*([^\r\n]+)/i);
      const ticketMatch = text.match(/Ticket:\s*([^\r\n]+)/i);
      const invoiceMatch = text.match(/Invoice:\s*(\d{6,})/i);

      const show = showMatch ? showMatch[1].trim() : "General";
      const ticket = ticketMatch ? ticketMatch[1].trim() : `Tier ${i + 1}`;
      const invoiceId = invoiceMatch ? invoiceMatch[1].trim() : null;

      // Slice single page into independent PDF
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const singleBytes = await singleDoc.save();

      const key = `${show}:::${ticket}`;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, { show, ticket, pages: [] });
      }

      categoryMap.get(key)!.pages.push({
        pageIndex: i,
        show,
        ticket,
        invoiceId,
        buffer: Buffer.from(singleBytes),
      });
    }

    // Fetch existing ticket types for this event
    const { rows: existingTypes } = await query<{
      id: number | string;
      name: string;
      group_name: string | null;
    }>(
      `SELECT id, name, group_name FROM ticket_types WHERE event_id = $1`,
      [eventId]
    );

    const now = new Date();
    const eventStart = event.start_time ? new Date(event.start_time) : now;
    const eventEnd = event.end_time ? new Date(event.end_time) : new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const summaryBreakdown: Array<{
      show: string;
      ticket: string;
      ticketTypeId: number;
      passesCount: number;
      isNewTier: boolean;
      status: string;
    }> = [];

    let totalCreatedTiers = 0;
    let totalUploadedPasses = 0;

    for (const [, cat] of categoryMap.entries()) {
      const { show, ticket, pages } = cat;

      // Match existing ticket type by name and group_name
      const existing = existingTypes.find(
        (t) =>
          t.name.trim().toLowerCase() === ticket.toLowerCase() &&
          (t.group_name || "").trim().toLowerCase() === show.toLowerCase()
      );

      let ticketTypeId: number;
      let isNew = false;

      if (existing) {
        ticketTypeId = Number(existing.id);
      } else {
        const order = inferGroupOrder(show);
        const { rows: insertedRows } = await query<{ id: number | string }>(
          `INSERT INTO ticket_types (
             event_id,
             name,
             group_name,
             group_order,
             price,
             quantity_available,
             sale_starts_at,
             sale_ends_at,
             max_per_person,
             people_per_ticket,
             attendee_fields
           ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6, 10, 1, '[]'::jsonb)
           RETURNING id`,
          [eventId, ticket, show, order, eventStart, eventEnd]
        );
        ticketTypeId = Number(insertedRows[0].id);
        isNew = true;
        totalCreatedTiers += 1;
      }

      // Upload each page to Spaces and ticket_pdf_inventory
      let passesUploadedForTier = 0;
      for (const pageItem of pages) {
        // Generate a 10-digit unique external ID if no invoice digits found
        const fallbackExtId = `${eventId}${String(pageItem.pageIndex + 1).padStart(4, "0")}${Math.floor(
          1000 + Math.random() * 9000
        )}`;
        const externalId = pageItem.invoiceId || fallbackExtId;
        const sanitizedTier = ticket.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${sanitizedTier}_${externalId}.pdf`;

        const uploadRes = await uploadPdfToInventory({
          ticketTypeId,
          buffer: pageItem.buffer,
          filename,
          externalId,
        });

        if (uploadRes.status === "ok") {
          passesUploadedForTier += 1;
          totalUploadedPasses += 1;
        } else if (uploadRes.status === "skipped_duplicate") {
          // Already in inventory
          passesUploadedForTier += 1;
        }
      }

      // Sync sellable inventory
      await syncTicketTypeQuantityAvailable(ticketTypeId);

      summaryBreakdown.push({
        show,
        ticket,
        ticketTypeId,
        passesCount: passesUploadedForTier,
        isNewTier: isNew,
        status: isNew ? "Created & Populated" : "Existing & Updated",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        eventId,
        totalPages: pageCount,
        totalTiers: categoryMap.size,
        newTiersCreated: totalCreatedTiers,
        passesUploaded: totalUploadedPasses,
        breakdown: summaryBreakdown,
      },
    });
  } catch (error) {
    captureRouteError(error, {
      route: "/api/admin/events/[id]/tickets/split-import",
      method: "POST",
    });
    console.error("Bundled PDF split-import failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import and split bundled PDF",
      },
      { status: 500 }
    );
  }
}
