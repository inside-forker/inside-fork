import type { NextRequest } from "next/server";

export type ParsedPdfUploadFile = {
  buffer: Buffer;
  filename: string;
  externalId?: string | null;
};

export type ParsedPdfInventoryUpload = {
  ticketTypeId: number;
  files: ParsedPdfUploadFile[];
  error?: string;
};

/**
 * Parse multipart form for PDF inventory upload.
 * Fields: ticket_type_id, files (or file), optional external_ticket_id (single file only).
 */
export async function parsePdfInventoryUploadForm(
  request: NextRequest,
): Promise<ParsedPdfInventoryUpload> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return {
      ticketTypeId: 0,
      files: [],
      error: "Expected multipart/form-data",
    };
  }

  const ticketTypeRaw = String(form.get("ticket_type_id") ?? "").trim();
  const ticketTypeId = Number(ticketTypeRaw);
  if (!Number.isInteger(ticketTypeId) || ticketTypeId <= 0) {
    return {
      ticketTypeId: 0,
      files: [],
      error: "ticket_type_id is required",
    };
  }

  const collected: File[] = [];
  for (const key of ["files", "file", "pdf"]) {
    const values = form.getAll(key);
    for (const value of values) {
      if (value instanceof File && value.size > 0) {
        collected.push(value);
      }
    }
  }

  // Deduplicate by object identity if same File appears under multiple keys
  const unique = [...new Set(collected)];

  if (unique.length === 0) {
    return {
      ticketTypeId,
      files: [],
      error: "At least one PDF file is required",
    };
  }

  const overrideRaw = String(form.get("external_ticket_id") ?? "").trim();
  const override =
    unique.length === 1 && overrideRaw ? overrideRaw : undefined;

  const files: ParsedPdfUploadFile[] = [];
  for (const file of unique) {
    const arrayBuffer = await file.arrayBuffer();
    files.push({
      buffer: Buffer.from(arrayBuffer),
      filename: file.name || "ticket.pdf",
      externalId: override,
    });
  }

  return { ticketTypeId, files };
}
