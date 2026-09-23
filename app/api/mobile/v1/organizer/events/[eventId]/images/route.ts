import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError, MobileErrors } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { deleteFile, getKeyFromPublicUrl, uploadFile } from "@/lib/storage/spaces";

export const dynamic = "force-dynamic";

// Matches web's local ADMIN_ROLES in app/api/organizer/events/[eventId]/images/route.ts:
// listers can manage images on ANY event, not just their own - broader than
// requireMobileOrganizer's built-in admin bypass (admin/super_admin only), so
// ownership is checked manually here instead of via the `eventId` option.
const IMAGE_ADMIN_ROLES = ["admin", "super_admin", "lister"];
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const MAX_SIZE = 10 * 1024 * 1024;

const EVENT_IMAGE_COLUMNS =
  "id, event_id, url, alt_text, is_primary, display_order, " +
  "to_json(created_at) #>> '{}' AS created_at";

function toNumericEventImage(row: Record<string, unknown>) {
  return { ...row, id: Number(row.id), event_id: Number(row.event_id) };
}

async function loadEventAndAuthorize(eventIdNum: number, userId: string, role: string) {
  const { rows: eventRows } = await query(
    `SELECT id, organizer_id FROM events WHERE id = $1`,
    [eventIdNum],
  );
  const event = eventRows[0];
  if (!event) {
    throw MobileErrors.notFound("Event not found.");
  }
  const isOwner = event.organizer_id === userId;
  const isAdmin = IMAGE_ADMIN_ROLES.includes(role);
  if (!isOwner && !isAdmin) {
    throw new MobileApiError("forbidden", "Access denied.", 403);
  }
  return event;
}

/** GET /api/mobile/v1/organizer/events/[eventId]/images */
export const GET = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseInt(eventId, 10);
  if (Number.isNaN(eventIdNum)) throw MobileErrors.badRequest("Invalid event ID.");

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const { rows } = await query(
    `SELECT ${EVENT_IMAGE_COLUMNS} FROM event_images WHERE event_id = $1 ORDER BY display_order ASC`,
    [eventIdNum],
  );
  return ok(rows.map(toNumericEventImage));
});

/** POST /api/mobile/v1/organizer/events/[eventId]/images */
export const POST = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseInt(eventId, 10);
  if (Number.isNaN(eventIdNum)) throw MobileErrors.badRequest("Invalid event ID.");

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw MobileErrors.badRequest("No file provided.", "file");

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const isAllowed =
    ALLOWED_TYPES.includes((file.type || "").toLowerCase()) ||
    ALLOWED_EXTS.includes(ext);

  if (!isAllowed) {
    throw new MobileApiError(
      "invalid_file_type",
      "Only JPEG, PNG, WebP, and HEIC images are allowed.",
      400,
      "file",
    );
  }
  if (file.size > MAX_SIZE) {
    throw new MobileApiError("file_too_large", "Maximum file size is 10MB.", 400, "file");
  }

  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS count FROM event_images WHERE event_id = $1`,
    [eventIdNum],
  );
  if (Number(countRows[0]?.count || 0) >= 8) {
    throw new MobileApiError(
      "limit_reached",
      "Maximum 8 images allowed per event.",
      400,
    );
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `event-images/event-${eventIdNum}-${Date.now()}.${fileExt}`;

  let publicUrl: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uploaded = await uploadFile(fileName, Buffer.from(arrayBuffer), {
      contentType: file.type,
    });
    publicUrl = uploaded.publicUrl;
  } catch (uploadError) {
    console.error("[mobile-api] event image upload failed:", uploadError);
    throw new MobileApiError("upload_failed", "Failed to upload image.", 500);
  }

  const { rows: maxOrderRows } = await query(
    `SELECT MAX(display_order) AS max_order FROM event_images WHERE event_id = $1`,
    [eventIdNum],
  );
  const nextOrder = Number(maxOrderRows[0]?.max_order || 0) + 1;

  try {
    const { rows } = await query(
      `INSERT INTO event_images (event_id, url, alt_text, display_order, is_primary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${EVENT_IMAGE_COLUMNS}`,
      [eventIdNum, publicUrl, file.name, nextOrder, nextOrder === 1],
    );
    return ok(toNumericEventImage(rows[0]));
  } catch (dbError) {
    console.error("[mobile-api] failed to save event image:", dbError);
    try {
      await deleteFile(fileName);
    } catch {
      // best-effort cleanup
    }
    throw new MobileApiError("internal_error", "Failed to save image.", 500);
  }
});

/** PATCH /api/mobile/v1/organizer/events/[eventId]/images?imageId= — set primary */
export const PATCH = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseInt(eventId, 10);
  const { searchParams } = new URL(request.url);
  const imageIdParam = searchParams.get("imageId");
  if (!imageIdParam) throw MobileErrors.badRequest("imageId is required.", "imageId");
  const imageIdNum = parseInt(imageIdParam, 10);
  if (Number.isNaN(eventIdNum) || Number.isNaN(imageIdNum)) {
    throw MobileErrors.badRequest("Invalid event or image ID.");
  }

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const body = await request.json().catch(() => null);
  const isPrimary = body?.is_primary as boolean | undefined;

  if (isPrimary === true) {
    await query(`UPDATE event_images SET is_primary = false WHERE event_id = $1`, [
      eventIdNum,
    ]);
  }

  const { rows } = await query(
    `UPDATE event_images SET is_primary = COALESCE($1, is_primary) WHERE id = $2 AND event_id = $3
     RETURNING ${EVENT_IMAGE_COLUMNS}`,
    [isPrimary ?? null, imageIdNum, eventIdNum],
  );
  if (!rows[0]) {
    throw new MobileApiError("internal_error", "Failed to update image.", 500);
  }
  return ok(toNumericEventImage(rows[0]));
});

/** DELETE /api/mobile/v1/organizer/events/[eventId]/images?imageId= */
export const DELETE = mobileRoute(async (request: NextRequest, context) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { eventId } = await context.params;
  const eventIdNum = parseInt(eventId, 10);
  const { searchParams } = new URL(request.url);
  const imageIdParam = searchParams.get("imageId");
  if (!imageIdParam) throw MobileErrors.badRequest("imageId is required.", "imageId");
  const imageIdNum = parseInt(imageIdParam, 10);
  if (Number.isNaN(eventIdNum) || Number.isNaN(imageIdNum)) {
    throw MobileErrors.badRequest("Invalid event or image ID.");
  }

  await loadEventAndAuthorize(eventIdNum, user.id, user.role);

  const { rows: imageRows } = await query(
    `SELECT url FROM event_images WHERE id = $1 AND event_id = $2`,
    [imageIdNum, eventIdNum],
  );
  const image = imageRows[0];
  if (!image) throw MobileErrors.notFound("Image not found.");

  const { rows: countRows } = await query(
    `SELECT COUNT(*) AS count FROM event_images WHERE event_id = $1`,
    [eventIdNum],
  );
  if (Number(countRows[0]?.count || 0) <= 1) {
    throw new MobileApiError(
      "last_image",
      "This is the last photo for this event. Upload a replacement before removing it.",
      400,
    );
  }

  await query(`DELETE FROM event_images WHERE id = $1`, [imageIdNum]);

  try {
    const key = getKeyFromPublicUrl(image.url);
    if (key) await deleteFile(key);
  } catch (storageError) {
    console.error("[mobile-api] failed to delete image from storage:", storageError);
  }

  return ok({ message: "Image deleted successfully" });
});
