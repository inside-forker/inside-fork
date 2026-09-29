import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin", "lister"];

async function requireAdminRole(userId: string) {
  const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
    userId,
  ]);
  const profile = rows[0];
  if (!profile) {
    return { error: "Profile not found", status: 403 } as const;
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    return { error: "Access denied", status: 403 } as const;
  }
  return { ok: true, role: profile.role } as const;
}

// GET: List eligible event organizers & current event organizers (primary + co-organizers)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    // Get current primary and co-organizers for this event
    const { rows: eventRow } = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [eventId]
    );
    const primaryOrganizerId = eventRow[0]?.organizer_id;

    const { rows: coOrgRows } = await query(
      `SELECT p.id, p.full_name, p.username, p.avatar_url, p.role
       FROM profiles p
       JOIN event_co_organizers eco ON eco.organizer_id = p.id
       WHERE eco.event_id = $1`,
      [eventId]
    );

    let primaryOrganizer = null;
    if (primaryOrganizerId) {
      const { rows: primaryRows } = await query(
        `SELECT id, full_name, username, avatar_url, role FROM profiles WHERE id = $1`,
        [primaryOrganizerId]
      );
      primaryOrganizer = primaryRows[0] || null;
    }

    // Search users by query param (for autocomplete)
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const ownerId = searchParams.get("organizerId")?.trim();

    const whereClauses: string[] = ["role != 'super_admin'"];
    const queryParams: unknown[] = [];

    if (q) {
      queryParams.push(`%${q}%`);
      const idx = queryParams.length;
      whereClauses.push(`(full_name ILIKE $${idx} OR username ILIKE $${idx})`);
    }

    if (ownerId) {
      queryParams.push(ownerId);
      whereClauses.push(`id = $${queryParams.length}`);
    }

    let users = [];
    try {
      const { rows } = await query(
        `SELECT id, full_name, username, avatar_url, role
         FROM profiles
         WHERE ${whereClauses.join(" AND ")}
         LIMIT 10`,
        queryParams
      );
      users = rows;
    } catch (error) {
      console.error("[API][GET] Failed to fetch users:", error);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      users,
      primaryOrganizer,
      coOrganizers: coOrgRows,
    });
  } catch (err) {
    console.error("[API][GET] Exception:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add a co-organizer to an event
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const { organizer_id } = await request.json();
    if (!organizer_id) {
      return NextResponse.json(
        { error: "organizer_id is required" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO public.event_co_organizers (event_id, organizer_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, organizer_id) DO NOTHING`,
      [eventId, organizer_id]
    );

    return NextResponse.json({ success: true, message: "Co-organizer added" });
  } catch (err) {
    console.error("[API][POST] Failed to add co-organizer:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a co-organizer from an event
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const organizer_id = searchParams.get("organizer_id");
    if (!organizer_id) {
      return NextResponse.json(
        { error: "organizer_id query param is required" },
        { status: 400 }
      );
    }

    await query(
      `DELETE FROM public.event_co_organizers WHERE event_id = $1 AND organizer_id = $2`,
      [eventId, organizer_id]
    );

    return NextResponse.json({ success: true, message: "Co-organizer removed" });
  } catch (err) {
    console.error("[API][DELETE] Failed to remove co-organizer:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Assign/Update primary organizer to an event
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await requireAdminRole(session.userId);
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    const eventId = parseInt(params.id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }

    // If lister, check ownership
    if (access.role === "lister") {
      const { rows } = await query(
        `SELECT id, organizer_id FROM events WHERE id = $1`,
        [eventId]
      );
      const event = rows[0];
      if (!event || event.organizer_id !== session.userId) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }

    // Parse new organizer from body
    const { organizer_id } = await request.json();
    if (!organizer_id) {
      return NextResponse.json(
        { error: "organizer_id is required" },
        { status: 400 }
      );
    }

    // Update event organizer
    try {
      await query(`UPDATE events SET organizer_id = $1 WHERE id = $2`, [
        organizer_id,
        eventId,
      ]);
    } catch (error) {
      console.error("Failed to update organizer:", error);
      return NextResponse.json(
        { error: "Failed to update organizer" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
