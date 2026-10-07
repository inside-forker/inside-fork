import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  copyFile,
  deleteFile,
  getKeyFromPublicUrl,
  getPublicUrl,
  listFiles,
} from "@/lib/storage/spaces";
import type {
  EventChangeRequestWithDetails,
  ProcessEventChangeResponse,
} from "@/types/event-change-request.types";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["lister", "admin", "super_admin"];

const CHANGE_REQUEST_COLUMNS =
  "id, event_id, organizer_id, action_type, proposed_data, original_data, status, reviewed_by, " +
  "to_json(reviewed_at) #>> '{}' AS reviewed_at, review_notes, " +
  "to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at, " +
  "organizer_name, organizer_username, organizer_avatar, " +
  "current_event_name, current_event_slug, current_event_status, proposed_event_name, reviewer_name";

function toNumericChangeRequest(row: Record<string, unknown>) {
  return {
    ...row,
    id: Number(row.id),
    event_id: row.event_id !== null ? Number(row.event_id) : null,
  };
}

async function requireAdminRole(userId: string) {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    return { error: "Profile not found", status: 404 } as const;
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    return { error: "Admin access required", status: 403 } as const;
  }
  return { ok: true } as const;
}

// =============================================================================
// GET - Get event change requests for admin approval
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending";
    const action_type = searchParams.get("action_type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    // Build query for change requests with details
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (status && status !== "all") {
      params.push(status);
      whereClauses.push(`status = $${params.length}`);
    }

    if (action_type && action_type !== "all") {
      params.push(action_type);
      whereClauses.push(`action_type = $${params.length}`);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let requests, count;
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM event_change_requests_with_details ${whereSql}`,
        params
      );
      count = parseInt(countRows[0].count, 10);

      const offset = (page - 1) * limit;
      const dataParams = [...params, limit, offset];
      const { rows } = await query(
        `SELECT ${CHANGE_REQUEST_COLUMNS} FROM event_change_requests_with_details
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );
      requests = rows.map(toNumericChangeRequest);
    } catch (error) {
      console.error("Error fetching change requests:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch change requests" },
        { status: 500 }
      );
    }

    // Get stats counts
    const [pendingResult, approvedResult, rejectedResult] = await Promise.all([
      query(
        `SELECT COUNT(*) FROM event_change_requests WHERE status = 'pending'`
      ),
      query(
        `SELECT COUNT(*) FROM event_change_requests WHERE status = 'approved'`
      ),
      query(
        `SELECT COUNT(*) FROM event_change_requests WHERE status = 'rejected'`
      ),
    ]);

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        requests: (requests as EventChangeRequestWithDetails[]) || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        pendingCount: parseInt(pendingResult.rows[0].count, 10) || 0,
        approvedCount: parseInt(approvedResult.rows[0].count, 10) || 0,
        rejectedCount: parseInt(rejectedResult.rows[0].count, 10) || 0,
      },
    });
  } catch (error) {
    console.error("Error in event approvals GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Process (approve/reject) an event change request
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await request.json();
    const {
      request_id,
      action,
      review_notes,
    }: {
      request_id: number;
      action: "approve" | "reject";
      review_notes?: string;
    } = body;

    // Validate required fields
    if (!request_id) {
      return NextResponse.json(
        { success: false, error: "Request ID is required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be approve or reject" },
        { status: 400 }
      );
    }

    // Rejection requires notes
    if (action === "reject" && !review_notes?.trim()) {
      return NextResponse.json(
        { success: false, error: "Review notes are required for rejection" },
        { status: 400 }
      );
    }

    // Replicated directly from process_event_change_request(): that
    // function reads auth.uid() exclusively with no fallback parameter, so
    // it would always return {success:false, error:'Authentication
    // required'} over a direct pg connection. Reimplemented here using
    // session.userId, in a real transaction (the RPC ran as one implicit
    // transaction via SELECT ... FOR UPDATE).
    let response: ProcessEventChangeResponse;
    let changeRequestDetails: {
      action_type: string;
      organizer_id: string;
      proposed_data: Record<string, unknown> | null;
    } | null = null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        const { rows: requestRows } = await client.query(
          `SELECT id, event_id, organizer_id, action_type, proposed_data, original_data, status
           FROM event_change_requests WHERE id = $1 FOR UPDATE`,
          [request_id]
        );
        const changeRequest = requestRows[0];

        if (!changeRequest) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, error: "Change request not found" },
            { status: 400 }
          );
        }

        if (changeRequest.status !== "pending") {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, error: "Request has already been processed" },
            { status: 400 }
          );
        }

        changeRequestDetails = {
          action_type: changeRequest.action_type,
          organizer_id: changeRequest.organizer_id,
          proposed_data: changeRequest.proposed_data,
        };
        const proposedData = changeRequest.proposed_data as Record<
          string,
          unknown
        > | null;

        if (action === "reject") {
          await client.query(
            `UPDATE event_change_requests
             SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW()
             WHERE id = $3`,
            [session.userId, review_notes, request_id]
          );

          await client.query(
            `INSERT INTO notifications (recipient_id, role_scope, category_slug, title, body, cta_url, cta_label, metadata, priority)
             VALUES ($1, 'organizer', 'event_updates', $2, $3, '/dashboard/events', 'View Events', $4, 'high')`,
            [
              changeRequest.organizer_id,
              changeRequest.action_type === "create"
                ? "Event Creation Rejected"
                : changeRequest.action_type === "update"
                  ? "Event Update Rejected"
                  : "Event Deletion Rejected",
              review_notes?.trim()
                ? review_notes
                : "Your event change request has been rejected.",
              JSON.stringify({
                request_id,
                action_type: changeRequest.action_type,
                event_id:
                  changeRequest.event_id !== null
                    ? Number(changeRequest.event_id)
                    : null,
                status: "rejected",
              }),
            ]
          );

          await client.query("COMMIT");
          response = {
            success: true,
            request_id,
            message: "Request rejected successfully",
          };
        } else {
          let newEventId: number | null =
            changeRequest.event_id !== null
              ? Number(changeRequest.event_id)
              : null;

          if (changeRequest.action_type === "create") {
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
                changeRequest.organizer_id,
                proposedData?.max_capacity ?? null,
                proposedData?.is_featured ?? false,
                proposedData?.is_commission_based ?? false,
                proposedData?.commission_rate ?? null,
                "published",
                proposedData?.require_guest_details ?? false,
              ]
            );
            newEventId = Number(insertedRows[0].id);
          } else if (changeRequest.action_type === "update") {
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
                 status = 'published',
                 require_guest_details = COALESCE($14, require_guest_details),
                 updated_at = NOW()
               WHERE id = $15`,
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
                proposedData?.require_guest_details ?? null,
                changeRequest.event_id,
              ]
            );
          } else {
            await client.query(`DELETE FROM events WHERE id = $1`, [
              changeRequest.event_id,
            ]);
          }

          await client.query(
            `UPDATE event_change_requests
             SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), review_notes = $2, updated_at = NOW()
             WHERE id = $3`,
            [session.userId, review_notes ?? null, request_id]
          );

          await client.query(
            `INSERT INTO notifications (recipient_id, role_scope, category_slug, title, body, cta_url, cta_label, metadata, priority)
             VALUES ($1, 'organizer', 'event_updates', $2, $3, '/dashboard/events', 'View Events', $4, 'normal')`,
            [
              changeRequest.organizer_id,
              changeRequest.action_type === "create"
                ? "Event Creation Approved"
                : changeRequest.action_type === "update"
                  ? "Event Update Approved"
                  : "Event Deletion Approved",
              changeRequest.action_type === "create"
                ? "Your event has been created and is now live!"
                : changeRequest.action_type === "update"
                  ? "Your event changes have been applied!"
                  : "Your event has been deleted as requested.",
              JSON.stringify({
                request_id,
                action_type: changeRequest.action_type,
                event_id: newEventId,
                status: "approved",
              }),
            ]
          );

          await client.query("COMMIT");
          response = {
            success: true,
            request_id,
            event_id: newEventId ?? undefined,
            message: "Request approved and changes applied successfully",
          };
        }
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      console.error("Error processing change request:", error);
      return NextResponse.json(
        { success: false, error: "Failed to process change request" },
        { status: 500 }
      );
    } finally {
      client.release();
    }

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: 400 }
      );
    }

    const proposedData = changeRequestDetails?.proposed_data ?? null;

    // If approved and there are temp images, migrate them to permanent storage.
    if (action === "approve" && response.event_id && proposedData?.temp_images) {
      try {
        const tempImages = proposedData.temp_images as Array<{
          url: string;
          alt_text?: string;
          is_primary?: boolean;
          display_order?: number;
        }>;
        const tempSessionId = proposedData.temp_session_id as
          | string
          | undefined;

        if (tempImages.length > 0 && tempSessionId) {
          for (let i = 0; i < tempImages.length; i++) {
            const img = tempImages[i];
            const tempKey = getKeyFromPublicUrl(img.url);

            if (tempKey && tempKey.startsWith("event-images/temp/")) {
              const filename = tempKey.split("/").pop();
              const permanentKey = `event-images/${response.event_id}/${filename}`;

              try {
                await copyFile(tempKey, permanentKey);
                await deleteFile(tempKey);

                const newUrl = getPublicUrl(permanentKey);

                await query(
                  `INSERT INTO event_images (event_id, url, alt_text, is_primary, display_order)
                   VALUES ($1, $2, $3, $4, $5)`,
                  [
                    response.event_id,
                    newUrl,
                    img.alt_text || "",
                    img.is_primary || i === 0,
                    img.display_order ?? i,
                  ]
                );
              } catch (moveError) {
                console.error("Error moving temp image:", moveError);
              }
            }
          }
        }
      } catch (imageError) {
        console.error("Error migrating temp images:", imageError);
        // Don't fail the approval if image migration fails
      }
    }

    // If approved and there are proposed ticket types, handle them (create/update/delete)
    if (action === "approve" && response.event_id && proposedData?.temp_tickets) {
      try {
        const tempTickets = proposedData.temp_tickets as Array<{
          id?: number;
          name: string;
          description?: string | null;
          price: number;
          quantity_available: number | null;
          sale_starts_at: string;
          sale_ends_at: string;
          max_per_person?: number;
        }>;

        if (tempTickets.length > 0) {
          console.log(
            `Processing ${tempTickets.length} tickets for event ${response.event_id}`
          );

          // 1. Get existing tickets to identify deletions
          const { rows: existingTickets } = await query(
            `SELECT id FROM ticket_types WHERE event_id = $1`,
            [response.event_id]
          );

          const existingIds = new Set(
            existingTickets.map((t) => Number(t.id))
          );
          const proposedIds = new Set(
            tempTickets.map((t) => t.id).filter((id): id is number => !!id)
          );

          // 2. Delete tickets that are not in the proposed list
          // (Only if it's an update request - for create, existingIds is empty)
          const idsToDelete = [...existingIds].filter(
            (id) => !proposedIds.has(id)
          );

          for (const id of idsToDelete) {
            await query(`DELETE FROM ticket_passes WHERE ticket_type_id = $1`, [id]);
            await query(`DELETE FROM booking_items WHERE ticket_type_id = $1`, [id]);
            await query(`DELETE FROM ticket_types WHERE id = $1`, [id]);
            console.log(`Deleted ticket ${id}`);
          }

          // 3. Upsert (Update existing or Insert new)
          for (const ticket of tempTickets) {
            const description = ticket.description || null;

            if (ticket.id) {
              try {
                await query(
                  `UPDATE ticket_types SET name = $1, description = $2, price = $3, quantity_available = $4,
                     sale_starts_at = $5, sale_ends_at = $6, max_per_person = $7
                   WHERE id = $8`,
                  [
                    ticket.name,
                    description,
                    ticket.price,
                    ticket.quantity_available,
                    ticket.sale_starts_at,
                    ticket.sale_ends_at,
                    ticket.max_per_person || 10,
                    ticket.id,
                  ]
                );
                console.log(`Successfully updated ticket ${ticket.id}`);
              } catch (error) {
                console.error(`Error updating ticket ${ticket.id}:`, error);
              }
            } else {
              try {
                await query(
                  `INSERT INTO ticket_types (event_id, name, description, price, quantity_available, sale_starts_at, sale_ends_at, max_per_person)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                  [
                    response.event_id,
                    ticket.name,
                    description,
                    ticket.price,
                    ticket.quantity_available,
                    ticket.sale_starts_at,
                    ticket.sale_ends_at,
                    ticket.max_per_person || 10,
                  ]
                );
                console.log(`Created new ticket: ${ticket.name}`);
              } catch (error) {
                console.error(`Error inserting ticket "${ticket.name}":`, error);
              }
            }
          }
        }
      } catch (ticketError) {
        console.error("Error processing ticket types:", ticketError);
        // Don't fail the approval if ticket processing fails
      }
    }

    // If rejected and there are temp images, clean them up
    if (action === "reject" && proposedData?.temp_images) {
      try {
        const tempImages = proposedData.temp_images as Array<{ url: string }>;
        const tempSessionId = proposedData.temp_session_id as
          | string
          | undefined;

        if (tempImages.length > 0 && tempSessionId) {
          // Delete the entire temp session folder
          const tempFolderPath = `event-images/temp/${tempSessionId}/`;
          const filePaths = await listFiles(tempFolderPath);

          if (filePaths.length > 0) {
            await Promise.all(filePaths.map((filePath) => deleteFile(filePath)));
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp images:", cleanupError);
        // Don't fail the rejection if cleanup fails
      }
    }

    // Log the admin action with detailed change information
    try {
      const { logAuditEvent } = await import("@/lib/audit");
      await logAuditEvent({
        action:
          action === "approve"
            ? changeRequestDetails?.action_type === "delete"
              ? "event_deleted"
              : "event_updated"
            : "event_updated",
        entity_type: "event_change_request",
        entity_id: request_id.toString(),
        admin_id: session.userId,
        old_values: changeRequestDetails
          ? {
              original_data:
                changeRequestDetails.action_type !== "create"
                  ? "See change request"
                  : null,
              action_type: changeRequestDetails.action_type,
            }
          : undefined,
        new_values: changeRequestDetails
          ? {
              proposed_data:
                changeRequestDetails.action_type !== "delete"
                  ? "Applied"
                  : null,
              decision: action,
              review_notes: review_notes || "No notes provided",
            }
          : undefined,
        metadata: {
          change_action: action,
          request_action_type: changeRequestDetails?.action_type,
          review_notes,
          event_id: response.event_id,
          organizer_id: changeRequestDetails?.organizer_id,
        },
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        user_agent: request.headers.get("user-agent") || undefined,
      });
    } catch (logError) {
      console.error("Failed to log action:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: response.request_id,
        event_id: response.event_id,
        message: response.message,
      },
    });
  } catch (error) {
    console.error("Error in event approvals POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
