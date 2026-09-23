import { NextRequest, NextResponse } from "next/server";
import { query, pool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type {
  EventFormData,
  SubmitEventChangeResponse,
  OrganizerManagedEvent,
} from "@/types/event-change-request.types";
import { mergeEventUpdateProposed } from "@/lib/events/mergeEventUpdateProposed";

export const dynamic = "force-dynamic";

const ORGANIZER_ROLES = ["organizer", "lister", "admin", "super_admin"];

async function getUserRole(userId: string): Promise<string | null> {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  return rows[0]?.role ?? null;
}

// =============================================================================
// GET - Get organizer's managed events with pending change status
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user has organizer role or higher
    const role = await getUserRole(session.userId);

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    if (!ORGANIZER_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 }
      );
    }

    // Get managed events with pending status. Replicated directly from
    // get_organizer_managed_events(): that function's own p_user_id
    // parameter is dead code - it actually reads auth.uid() internally,
    // which is always null over a direct pg connection, so it would
    // always return zero rows if called as-is.
    let events: OrganizerManagedEvent[] = [];
    try {
      const { rows } = await query(
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
        [session.userId]
      );
      events = rows.map((row) => ({
        ...row,
        event_id: Number(row.event_id),
        category_id: row.category_id !== null ? Number(row.category_id) : null,
        pending_request_id:
          row.pending_request_id !== null ? Number(row.pending_request_id) : null,
      })) as OrganizerManagedEvent[];
    } catch (error) {
      console.error("Error fetching organizer events:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // Also fetch pending create requests (no event_id yet)
    let pendingCreates;
    try {
      const { rows } = await query(
        `SELECT id, event_id, organizer_id, action_type, proposed_data, original_data,
           status, reviewed_by,
           to_json(reviewed_at) #>> '{}' AS reviewed_at,
           review_notes,
           to_json(created_at) #>> '{}' AS created_at,
           to_json(updated_at) #>> '{}' AS updated_at
         FROM event_change_requests
         WHERE organizer_id = $1 AND action_type = 'create' AND status = 'pending'
         ORDER BY created_at DESC`,
        [session.userId]
      );
      pendingCreates = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: row.event_id !== null ? Number(row.event_id) : null,
      }));
    } catch (error) {
      console.error("Error fetching pending creates:", error);
      pendingCreates = [];
    }

    // Fetch rejected change requests so organizer can edit and resubmit
    let rejectedRequests;
    try {
      const { rows } = await query(
        `SELECT id, event_id, organizer_id, action_type, proposed_data, original_data,
           status, reviewed_by,
           to_json(reviewed_at) #>> '{}' AS reviewed_at,
           review_notes,
           to_json(created_at) #>> '{}' AS created_at,
           to_json(updated_at) #>> '{}' AS updated_at
         FROM event_change_requests
         WHERE organizer_id = $1 AND status = 'rejected'
         ORDER BY updated_at DESC`,
        [session.userId]
      );
      rejectedRequests = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        event_id: row.event_id !== null ? Number(row.event_id) : null,
      }));
    } catch (error) {
      console.error("Error fetching rejected requests:", error);
      rejectedRequests = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        events,
        pendingCreates,
        rejectedRequests,
      },
    });
  } catch (error) {
    console.error("Error in organizer events GET:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Submit event change request (create/update/delete)
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

    // Verify user has organizer role or higher
    const role = await getUserRole(session.userId);

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 }
      );
    }

    if (!ORGANIZER_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Organizer access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      action_type,
      event_id,
      event_data,
    }: {
      action_type: "create" | "update" | "delete";
      event_id?: number;
      event_data?: EventFormData;
    } = body;

    if (!["create", "update", "delete"].includes(action_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid action type" },
        { status: 400 }
      );
    }

    if (action_type === "create" && !event_data) {
      return NextResponse.json(
        { success: false, error: "Event data required for create action" },
        { status: 400 }
      );
    }

    if (
      action_type === "create" &&
      (!event_data?.temp_images || event_data.temp_images.length === 0)
    ) {
      return NextResponse.json(
        { success: false, error: "At least one event photo is required" },
        { status: 400 }
      );
    }

    if (action_type !== "create" && !event_id) {
      return NextResponse.json(
        { success: false, error: "Event ID required for update/delete action" },
        { status: 400 }
      );
    }

    if (action_type === "update" && !event_data) {
      return NextResponse.json(
        { success: false, error: "Event data required for update action" },
        { status: 400 }
      );
    }

    // Replicated directly from submit_event_change_request(): that function
    // has no fallback parameter at all and reads auth.uid() exclusively,
    // which is always null over a direct pg connection - it would always
    // return {success:false, error:'Authentication required'} if called
    // as-is, so the entire body is reimplemented here using session.userId.
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
            [event_id]
          );
          const existingEvent = eventRows[0];
          if (existingEvent) {
            // latitude/longitude/commission_rate are numeric columns; node-pg
            // returns them as strings by default (no custom type parser is
            // configured), unlike the old PostgREST path which serialized
            // them as JSON numbers.
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
            response = { success: false, error: "Event not found" };
            await client.query("ROLLBACK");
            return NextResponse.json(
              { success: false, error: response.error },
              { status: 400 }
            );
          }

          if (role === "organizer" && existingEvent.organizer_id !== session.userId) {
            response = {
              success: false,
              error: "You can only modify your own events",
            };
            await client.query("ROLLBACK");
            return NextResponse.json(
              { success: false, error: response.error },
              { status: 400 }
            );
          }

          const { rows: pendingRows } = await client.query(
            `SELECT id FROM event_change_requests WHERE event_id = $1 AND status = 'pending' LIMIT 1`,
            [event_id]
          );

          if (pendingRows[0]) {
            response = {
              success: false,
              error:
                "A pending change request already exists for this event. Cancel it first or wait for review.",
            };
            await client.query("ROLLBACK");
            return NextResponse.json(
              { success: false, error: response.error },
              { status: 400 }
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

        if (["lister", "admin", "super_admin"].includes(role)) {
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
                session.userId,
                proposedData?.max_capacity ?? null,
                proposedData?.is_featured ?? false,
                proposedData?.is_commission_based ?? false,
                proposedData?.commission_rate ?? null,
                proposedData?.status ?? "draft",
                proposedData?.require_guest_details ?? false,
              ]
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
                    ]
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
              ]
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
              session.userId,
              action_type,
              proposedData ? JSON.stringify(proposedData) : null,
              originalData ? JSON.stringify(originalData) : null,
            ]
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

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        request_id: response.request_id,
        event_id: response.event_id,
        message: response.message,
        requires_approval: response.requires_approval,
      },
    });
  } catch (error) {
    console.error("Error in organizer events POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Cancel a pending change request
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("request_id");

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Request ID is required" },
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

    // Check if the request exists and belongs to this user
    const { rows: changeRequestRows } = await query(
      `SELECT id, organizer_id, status FROM event_change_requests WHERE id = $1`,
      [parseInt(requestId, 10)]
    );
    const changeRequest = changeRequestRows[0];

    if (!changeRequest) {
      return NextResponse.json(
        { success: false, error: "Change request not found" },
        { status: 404 }
      );
    }

    // Only allow cancellation of own pending or rejected requests
    if (changeRequest.organizer_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: "You can only cancel your own requests" },
        { status: 403 }
      );
    }

    // Allow deleting pending or rejected requests (not approved ones)
    if (
      changeRequest.status !== "pending" &&
      changeRequest.status !== "rejected"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending or rejected requests can be cancelled",
        },
        { status: 400 }
      );
    }

    // Delete the request
    try {
      await query(`DELETE FROM event_change_requests WHERE id = $1`, [
        parseInt(requestId, 10),
      ]);
    } catch (error) {
      console.error("Error deleting change request:", error);
      return NextResponse.json(
        { success: false, error: "Failed to cancel request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Change request cancelled successfully",
    });
  } catch (error) {
    console.error("Error in organizer events DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
