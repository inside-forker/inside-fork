import path from "node:path";
import { query } from "@/lib/db";
import {
  TICKET_PDF_INVENTORY_PREFIX,
  uploadPrefixedFile,
} from "@/lib/storage/spaces";

export type PdfInventoryUploadStatus =
  | "ok"
  | "skipped_duplicate"
  | "invalid_filename"
  | "invalid_file"
  | "error";

export type PdfInventoryUploadResult = {
  filename: string;
  status: PdfInventoryUploadStatus;
  external_ticket_id?: string;
  inventory_id?: number;
  message?: string;
};

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10MB

/** Parse Ticketwala id from trailing digits in basename, e.g. 002_Prism_Fam_2586389.pdf */
export function extractExternalId(filename: string): string | null {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/(\d{6,})$/);
  return match?.[1] ?? null;
}

export async function syncTicketTypeQuantityAvailable(
  ticketTypeId: number,
): Promise<number> {
  const { rows } = await query<{ available: number | string }>(
    `SELECT COUNT(*)::int AS available
     FROM ticket_pdf_inventory
     WHERE ticket_type_id = $1 AND booking_id IS NULL`,
    [ticketTypeId],
  );
  const available = Number(rows[0]?.available ?? 0);
  await query(`UPDATE ticket_types SET quantity_available = $1 WHERE id = $2`, [
    available,
    ticketTypeId,
  ]);
  return available;
}

export async function uploadPdfToInventory(opts: {
  ticketTypeId: number;
  buffer: Buffer;
  filename: string;
  /** Override when filename lacks trailing Ticketwala digits (single-file uploads). */
  externalId?: string | null;
}): Promise<PdfInventoryUploadResult> {
  const filename = path.basename(opts.filename || "ticket.pdf");
  const lower = filename.toLowerCase();

  if (!lower.endsWith(".pdf")) {
    return {
      filename,
      status: "invalid_file",
      message: "Only PDF files are allowed",
    };
  }

  if (!opts.buffer?.length) {
    return {
      filename,
      status: "invalid_file",
      message: "Empty file",
    };
  }

  if (opts.buffer.length > MAX_PDF_BYTES) {
    return {
      filename,
      status: "invalid_file",
      message: "File size must be less than 10MB",
    };
  }

  const override = opts.externalId?.trim() || null;
  const externalId =
    override && /^\d{6,}$/.test(override)
      ? override
      : extractExternalId(filename);

  if (!externalId) {
    return {
      filename,
      status: "invalid_filename",
      message:
        "Filename must end with the Ticketwala ticket number (6+ digits), e.g. 002_Prism_Fam_2586389.pdf",
    };
  }

  try {
    const { rows: existing } = await query<{ id: number | string }>(
      `SELECT id FROM ticket_pdf_inventory WHERE external_ticket_id = $1`,
      [externalId],
    );
    if (existing.length > 0) {
      return {
        filename,
        status: "skipped_duplicate",
        external_ticket_id: externalId,
        inventory_id: Number(existing[0].id),
        message: `Ticket id ${externalId} already in inventory`,
      };
    }

    const relativePath = `${opts.ticketTypeId}/${externalId}.pdf`;
    const uploaded = await uploadPrefixedFile(
      TICKET_PDF_INVENTORY_PREFIX,
      relativePath,
      opts.buffer,
      { contentType: "application/pdf", isPublic: false },
    );

    const { rows: inserted } = await query<{ id: number | string }>(
      `INSERT INTO ticket_pdf_inventory
         (ticket_type_id, external_ticket_id, storage_key, original_filename)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [opts.ticketTypeId, externalId, uploaded.path, filename],
    );

    return {
      filename,
      status: "ok",
      external_ticket_id: externalId,
      inventory_id: Number(inserted[0].id),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload PDF";
    // Unique constraint race
    if (
      typeof message === "string" &&
      (message.includes("external_ticket_id") ||
        message.includes("unique") ||
        message.includes("duplicate"))
    ) {
      return {
        filename,
        status: "skipped_duplicate",
        external_ticket_id: externalId,
        message: `Ticket id ${externalId} already in inventory`,
      };
    }
    return {
      filename,
      status: "error",
      external_ticket_id: externalId,
      message,
    };
  }
}

export async function uploadPdfsToInventory(opts: {
  ticketTypeId: number;
  files: Array<{
    buffer: Buffer;
    filename: string;
    externalId?: string | null;
  }>;
}): Promise<{
  results: PdfInventoryUploadResult[];
  quantity_available: number;
  inserted: number;
  skipped: number;
}> {
  const results: PdfInventoryUploadResult[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const file of opts.files) {
    const result = await uploadPdfToInventory({
      ticketTypeId: opts.ticketTypeId,
      buffer: file.buffer,
      filename: file.filename,
      externalId: file.externalId,
    });
    results.push(result);
    if (result.status === "ok") inserted += 1;
    else skipped += 1;
  }

  const quantity_available = await syncTicketTypeQuantityAvailable(
    opts.ticketTypeId,
  );

  return { results, quantity_available, inserted, skipped };
}
