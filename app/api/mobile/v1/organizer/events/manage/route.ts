import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileOrganizer } from "@/lib/mobile/organizer";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError, MobileErrors } from "@/lib/mobile/errors";
import { query, pool } from "@/lib/db";
import type {
  EventFormData,
  SubmitEventChangeResponse,
} from "@/types/event-change-request.types";
import { mergeEventUpdateProposed } from "@/lib/events/mergeEventUpdateProposed";

export const dynamic = "force-dynamic";

const INSTANT_APPLY_ROLES = ["lister", "admin", "super_admin"];

/**
 * GET /api/mobile/v1/organizer/events/manage
 *
 * Own events + their pending change-request status, plus separate
 * pending-create and rejected requests. Mirrors
 * `app/api/organizer/events/manage/route.ts` (GET) exactly, swapped to
 * Bearer auth via `requireMobileOrganizer`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows: eventRows } = await query(
    `SELECT
       e.id AS event_id, e.name AS event_name, e.slug AS event_slug,
       e.description AS event_description, e.status AS event_status,
       to_json(e.start_time) #>> '{}' AS start_time,
       to_json(e.end_time) #>> '{}' AS end_time,
       e.is_featured, e.max_capacity, e.location_name, e.address, e.category_id,
       to_json(e.created_at) #>> '{}' AS created_at,
       to_json(e.updated_at) #>> '{}' AS updated_at,
       ecr.id AS pending_request_id, ecr.action_type AS pending_action_type,
       (ecr.id IS NOT NULL) AS has_pending_changes
     FROM events e
     LEFT JOIN LATERAL (
       SELECT ecr_inner.id, ecr_inner.action_type
       FROM event_change_requests ecr_inner
       WHERE ecr_inner.event_id = e.id AND ecr_inner.status = 'pending'
       ORDER BY ecr_inner.created_at DESC
       LIMIT 1
     ) ecr ON true
     WHERE e.organizer_id = $1
     ORDER BY e.start_time DESC`,
    [user.id],
  );
  const events = eventRows.map((row) => ({
    ...row,
    event_id: Number(row.event_id),
    category_id: row.category_id !== null ? Number(row.category_id) : null,
    pending_request_id:
      row.pending_request_id !== null ? Number(row.pending_request_id) : null,
  }));

  const { rows: pendingCreateRows } = await query(
    `SELECT id, event_id, organizer_id, action_type, proposed_data, original_data,
       status, reviewed_by,
       to_json(reviewed_at) #>> '{}' AS reviewed_at,
       review_notes,
       to_json(created_at) #>> '{}' AS created_at,
       to_json(updated_at) #>> '{}' AS updated_at
     FROM event_change_requests
     WHERE organizer_id = $1 AND action_type = 'create' AND status = 'pending'
     ORDER BY created_at DESC`,
    [user.id],
  );
  const pendingCreates = pendingCreateRows.map((row) => ({
    ...row,
    id: Number(row.id),
    event_id: row.event_id !== null ? Number(row.event_id) : null,
  }));

  const { rows: rejectedRows } = await query(
    `SELECT id, event_id, organizer_id, action_type, proposed_data, original_data,
       status, reviewed_by,
       to_json(reviewed_at) #>> '{}' AS reviewed_at,
       review_notes,
       to_json(created_at) #>> '{}' AS created_at,
       to_json(updated_at) #>> '{}' AS updated_at
     FROM event_change_requests
     WHERE organizer_id = $1 AND status = 'rejected'
     ORDER BY updated_at DESC`,
    [user.id],
  );
  const rejectedRequests = rejectedRows.map((row) => ({
    ...row,
    id: Number(row.id),
    event_id: row.event_id !== null ? Number(row.event_id) : null,
  }));

  return ok({ events, pendingCreates, rejectedRequests });
});

/**
 * POST /api/mobile/v1/organizer/events/manage
 *
 * Submit a create/update/delete request. Mirrors
 * `app/api/organizer/events/manage/route.ts` (POST) exactly: `organizer`-role
 * users always get a pending `event_change_requests` row (admin approval
 * required before anything changes); `lister`/`admin`/`super_admin` apply
 * instantly. Never skip the pending path for a plain organizer.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const body = await request.json().catch(() => null);
  const action_type = body?.action_type as
    | "create"
    | "update"
    | "delete"
    | undefined;
  const event_id = body?.event_id as number | undefined;
  const event_data = body?.event_data as EventFormData | undefined;

  if (!action_type || !["create", "update", "delete"].includes(action_type)) {
    throw MobileErrors.badRequest("Invalid action type.", "action_type");
  }
  if (action_type === "create" && !event_data) {
    throw MobileErrors.badRequest(
      "Event data is required to create an event.",
      "event_data",
    );
  }
  if (
    action_type === "create" &&
    (!event_data?.temp_images || event_data.temp_images.length === 0)
  ) {
    throw MobileErrors.badRequest(
      "At least one event photo is required.",
      "temp_images",
    );
  }
  if (action_type !== "create" && !event_id) {
    throw MobileErrors.badRequest(
      "event_id is required for update/delete.",
      "event_id",
    );
  }
  if (action_type === "update" && !event_data) {
    throw MobileErrors.badRequest(
      "Event data is required to update an event.",
      "event_data",
    );
  }

  let response: SubmitEventChangeResponse;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      let originalData: Record<string, unknown> | null = null;

      if (action_type === "update" || action_type === "delete") {
        const { rows: eventRows } = await client.query(
          `SELECT id, organizer_id, name, slug, description,
             to_json(start_time) #>> '{}' AS start_time,
             to_json(end_time) #>> '{}' AS end_time,
             location_name, address, latitude, longitude, category_id, max_capacity,
             is_featured, is_commission_based, commission_rate, status, require_guest_details,
             to_json(created_at) #>> '{}' AS created_at,
             to_json(updated_at) #>> '{}' AS updated_at
           FROM events WHERE id = $1`,
          [event_id],
        );
        const existingEvent = eventRows[0];
        if (existingEvent) {
          existingEvent.latitude =
            existingEvent.latitude !== null ? Number(existingEvent.latitude) : null;
          existingEvent.longitude =
            existingEvent.longitude !== null ? Number(existingEvent.longitude) : null;
          existingEvent.commission_rate =
            existingEvent.commission_rate !== null
              ? Number(existingEvent.commission_rate)
              : null;
        }

        if (!existingEvent) {
          await client.query("ROLLBACK");
          throw MobileErrors.notFound("Event not found.");
        }

        if (user.role === "organizer" && existingEvent.organizer_id !== user.id) {
          await client.query("ROLLBACK");
          throw new MobileApiError(
            "forbidden",
            "You can only modify your own events.",
            403,
          );
        }

        const { rows: pendingRows } = await client.query(
          `SELECT id FROM event_change_requests WHERE event_id = $1 AND status = 'pending' LIMIT 1`,
          [event_id],
        );
        if (pendingRows[0]) {
          await client.query("ROLLBACK");
          throw new MobileApiError(
            "pending_request_exists",
            "A pending change request already exists for this event. Cancel it first or wait for review.",
            400,
          );
        }

        originalData = {
          id: Number(existingEvent.id),
          organizer_id: existingEvent.organizer_id,
          name: existingEvent.name,
          slug: existingEvent.slug,
          description: existingEvent.description,
          start_time: existingEvent.start_time,
          end_time: existingEvent.end_time,
          location_name: existingEvent.location_name,
          address: existingEvent.address,
          latitude: existingEvent.latitude,
          longitude: existingEvent.longitude,
          category_id: existingEvent.category_id,
          max_capacity: existingEvent.max_capacity,
          is_featured: existingEvent.is_featured,
          is_commission_based: existingEvent.is_commission_based,
          commission_rate: existingEvent.commission_rate,
          status: existingEvent.status,
          require_guest_details: existingEvent.require_guest_details,
          created_at: existingEvent.created_at,
          updated_at: existingEvent.updated_at,
        };
      }

      const proposedData = event_data
        ? action_type === "update" && originalData
          ? mergeEventUpdateProposed(
              originalData,
              event_data as unknown as Record<string, unknown>,
            )
          : (event_data as unknown as Record<string, unknown>)
        : null;

      if (INSTANT_APPLY_ROLES.includes(user.role)) {
        if (action_type === "create") {
          const rawName = String(proposedData?.name ?? "");
          let slug = rawName
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-+|-+$/g, "");
          slug = `${slug}-${Math.floor(Date.now() / 1000)}`;

          const { rows: insertedRows } = await client.query(
            `INSERT INTO events (
               name, slug, description, start_time, end_time,
               location_name, address, latitude, longitude, category_id, organizer_id, max_capacity,
               is_featured, is_commission_based, commission_rate, status, require_guest_details
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
             RETURNING id`,
            [
              proposedData?.name ?? null,
              slug,
              proposedData?.description ?? null,
              proposedData?.start_time ?? null,
              proposedData?.end_time ?? null,
              proposedData?.location_name ?? null,
              proposedData?.address ?? null,
              proposedData?.latitude ?? null,
              proposedData?.longitude ?? null,
              proposedData?.category_id ?? null,
              user.id,
              proposedData?.max_capacity ?? null,
              proposedData?.is_featured ?? false,
              proposedData?.is_commission_based ?? false,
              proposedData?.commission_rate ?? null,
              proposedData?.status ?? "draft",
              proposedData?.require_guest_details ?? false,
            ],
          );
          const newEventId = Number(insertedRows[0].id);

          const tempTickets = (proposedData?.temp_tickets ?? []) as Array<{
            name: string;
            description?: string | null;
            price: number;
            quantity_available: number | null;
            sale_starts_at: string;
            sale_ends_at: string;
            max_per_person?: number;
          }>;
          if (Array.isArray(tempTickets) && tempTickets.length > 0) {
            for (const t of tempTickets) {
              if (t.name && t.price !== undefined && t.quantity_available !== undefined) {
                await client.query(
                  `INSERT INTO ticket_types (event_id, name, description, price, quantity_available, sale_starts_at, sale_ends_at, max_per_person)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                  [
                    newEventId,
                    t.name,
                    t.description ?? null,
                    Number(t.price),
                    t.quantity_available !== null ? Number(t.quantity_available) : null,
                    t.sale_starts_at || null,
                    t.sale_ends_at || null,
                    t.max_per_person ? Number(t.max_per_person) : 10,
                  ],
                );
              }
            }
          }

          await client.query("COMMIT");
          response = {
            success: true,
            event_id: newEventId,
            message: "Event created successfully",
            requires_approval: false,
          };
        } else if (action_type === "update") {
          await client.query(
            `UPDATE events SET
               name = COALESCE($1, name),
               description = COALESCE($2, description),
               start_time = COALESCE($3, start_time),
               end_time = COALESCE($4, end_time),
               location_name = COALESCE($5, location_name),
               address = COALESCE($6, address),
               latitude = COALESCE($7, latitude),
               longitude = COALESCE($8, longitude),
               category_id = COALESCE($9, category_id),
               max_capacity = COALESCE($10, max_capacity),
               is_featured = COALESCE($11, is_featured),
               is_commission_based = COALESCE($12, is_commission_based),
               commission_rate = COALESCE($13, commission_rate),
               status = COALESCE($14, status),
               require_guest_details = COALESCE($15, require_guest_details),
               updated_at = NOW()
             WHERE id = $16`,
            [
              proposedData?.name ?? null,
              proposedData?.description ?? null,
              proposedData?.start_time ?? null,
              proposedData?.end_time ?? null,
              proposedData?.location_name ?? null,
              proposedData?.address ?? null,
              proposedData?.latitude ?? null,
              proposedData?.longitude ?? null,
              proposedData?.category_id ?? null,
              proposedData?.max_capacity ?? null,
              proposedData?.is_featured ?? null,
              proposedData?.is_commission_based ?? null,
              proposedData?.commission_rate ?? null,
              proposedData?.status ?? null,
              proposedData?.require_guest_details ?? null,
              event_id,
            ],
          );
          await client.query("COMMIT");
          response = {
            success: true,
            event_id: event_id as number,
            message: "Event updated successfully",
            requires_approval: false,
          };
        } else {
          await client.query(`DELETE FROM events WHERE id = $1`, [event_id]);
          await client.query("COMMIT");
          response = {
            success: true,
            event_id: event_id as number,
            message: "Event deleted successfully",
            requires_approval: false,
          };
        }
      } else {
        const { rows: requestRows } = await client.query(
          `INSERT INTO event_change_requests (event_id, organizer_id, action_type, proposed_data, original_data, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING id`,
          [
            event_id ?? null,
            user.id,
            action_type,
            proposedData ? JSON.stringify(proposedData) : null,
            originalData ? JSON.stringify(originalData) : null,
          ],
        );
        await client.query("COMMIT");
        response = {
          success: true,
          request_id: Number(requestRows[0].id),
          event_id: event_id ?? undefined,
          message: "Change request submitted for approval",
          requires_approval: true,
        };
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }

  return ok({
    request_id: response.request_id,
    event_id: response.event_id,
    message: response.message,
    requires_approval: response.requires_approval,
  });
});

/**
 * DELETE /api/mobile/v1/organizer/events/manage?request_id=
 *
 * Cancels a pending or rejected change request. Mirrors
 * `app/api/organizer/events/manage/route.ts` (DELETE).
 */
export const DELETE = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileOrganizer(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const requestIdParam = searchParams.get("request_id");
  if (!requestIdParam) {
    throw MobileErrors.badRequest("request_id is required.", "request_id");
  }
  const requestId = parseInt(requestIdParam, 10);
  if (Number.isNaN(requestId)) {
    throw MobileErrors.badRequest("request_id must be a number.", "request_id");
  }

  const { rows: changeRequestRows } = await query(
    `SELECT id, organizer_id, status FROM event_change_requests WHERE id = $1`,
    [requestId],
  );
  const changeRequest = changeRequestRows[0];
  if (!changeRequest) {
    throw MobileErrors.notFound("Change request not found.");
  }
  if (changeRequest.organizer_id !== user.id) {
    throw new MobileApiError(
      "forbidden",
      "You can only cancel your own requests.",
      403,
    );
  }
  if (changeRequest.status !== "pending" && changeRequest.status !== "rejected") {
    throw MobileErrors.badRequest(
      "Only pending or rejected requests can be cancelled.",
    );
  }

  await query(`DELETE FROM event_change_requests WHERE id = $1`, [requestId]);

  return ok({ message: "Change request cancelled successfully" });
});
