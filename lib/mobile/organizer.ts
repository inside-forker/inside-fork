import { requireMobileUser } from "./auth";
import { MobileApiError } from "./errors";
import { query } from "@/lib/db";

/**
 * Roles allowed to use the mobile organizer surface.
 */
export const ORGANIZER_ROLES = ["organizer", "lister", "admin", "super_admin"];
export const SCANNER_ROLES = ["organizer", "eo_gate_pass", "lister", "admin", "super_admin"];
const ADMIN_ROLES = ["admin", "super_admin"];

export type MobileOrganizerContext = {
  user: { id: string; email?: string; role: string };
  isAdmin: boolean;
  isGatePass: boolean;
  linkedOrganizerId: string | null;
};

/**
 * Requires a Bearer-authenticated user whose current `profiles.role` (read
 * fresh from the DB, not the JWT claim, since a role change must take effect
 * immediately) has organizer or gate pass permissions. When `eventId` is passed, additionally
 * requires the user to own that event (or be a linked gate pass operator for the event's organizer)
 * unless they're an admin.
 */
export async function requireMobileOrganizer(
  request: Request,
  opts?: { eventId?: number; allowGatePass?: boolean },
): Promise<MobileOrganizerContext> {
  const { user } = await requireMobileUser(request);
  const allowGatePass = opts?.allowGatePass ?? true;

  const { rows } = await query(
    `SELECT role, linked_organizer_id FROM profiles WHERE id = $1`,
    [user.id],
  );
  const role: string | undefined = rows[0]?.role;
  const linkedOrganizerId: string | null = rows[0]?.linked_organizer_id
    ? String(rows[0].linked_organizer_id)
    : null;

  const allowedRoles = allowGatePass ? SCANNER_ROLES : ORGANIZER_ROLES;

  if (!role || !allowedRoles.includes(role)) {
    throw new MobileApiError(
      "forbidden",
      "Organizer or Gate Pass access required.",
      403,
    );
  }

  const isAdmin = ADMIN_ROLES.includes(role);
  const isGatePass = role === "eo_gate_pass";

  if (opts?.eventId !== undefined) {
    const { rows: eventRows } = await query(
      `SELECT organizer_id FROM events WHERE id = $1`,
      [opts.eventId],
    );
    const event = eventRows[0];
    if (!event) {
      throw new MobileApiError("not_found", "Event not found.", 404);
    }

    const organizerId = String(event.organizer_id);
    const userId = String(user.id);
    const isOwner = organizerId === userId;
    const isLinkedGatePass =
      isGatePass && !!linkedOrganizerId && organizerId === linkedOrganizerId;

    // Always check lane assignment for gate-pass users — linked_organizer_id can
    // be stale/null, and assignment is the source of truth for scanner access.
    let isAssignedDeviceOperator = false;
    if (isGatePass && !isOwner && !isAdmin) {
      const { rows: assignmentRows } = await query(
        `SELECT 1 FROM event_device_operators
         WHERE event_id = $1 AND operator_id = $2::uuid
         LIMIT 1`,
        [opts.eventId, userId],
      );
      isAssignedDeviceOperator = assignmentRows.length > 0;
    }

    if (!isAdmin && !isOwner && !isLinkedGatePass && !isAssignedDeviceOperator) {
      throw new MobileApiError(
        "forbidden",
        "You do not have access to this event.",
        403,
      );
    }
  }

  return {
    user: { ...user, role },
    isAdmin,
    isGatePass,
    linkedOrganizerId,
  };
}
