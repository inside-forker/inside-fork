import { requireMobileUser } from "./auth";
import { MobileApiError } from "./errors";
import { query } from "@/lib/db";

/**
 * Roles allowed to use the mobile organizer surface.
 */
export const ORGANIZER_ROLES = ["organizer", "lister", "admin", "super_admin"];
export const SCANNER_ROLES = [
  "organizer",
  "eo_gate_pass",
  "lister",
  "admin",
  "super_admin",
];
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
 * immediately) has organizer or gate pass permissions. When `eventId` is passed,
 * additionally requires the user to own that event, be a linked gate-pass
 * operator for its organizer, or be assigned a lane in event_device_operators.
 */
export async function requireMobileOrganizer(
  request: Request,
  opts?: { eventId?: number; allowGatePass?: boolean },
): Promise<MobileOrganizerContext> {
  const { user } = await requireMobileUser(request);
  const allowGatePass = opts?.allowGatePass ?? true;
  const userId = String(user.id);

  const { rows } = await query(
    `SELECT role, linked_organizer_id FROM profiles WHERE id = $1`,
    [userId],
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

  if (opts?.eventId !== undefined && !isAdmin) {
    // Single access check aligned with GET /organizer/events visibility:
    // owner, lane-assigned operator, or linked EO gate-pass for this event's organizer.
    const { rows: accessRows } = await query(
      `SELECT 1
       FROM public.events e
       WHERE e.id = $1
         AND (
           e.organizer_id::text = $2
           OR EXISTS (
             SELECT 1 FROM public.event_device_operators edo
             WHERE edo.event_id = e.id AND edo.operator_id::text = $2
           )
           OR (
             $3::text IS NOT NULL
             AND e.organizer_id::text = $3
           )
         )
       LIMIT 1`,
      [opts.eventId, userId, isGatePass ? linkedOrganizerId : null],
    );

    if (accessRows.length === 0) {
      // Distinguish missing event vs forbidden for clearer client handling
      const { rows: existsRows } = await query(
        `SELECT 1 FROM public.events WHERE id = $1 LIMIT 1`,
        [opts.eventId],
      );
      if (existsRows.length === 0) {
        throw new MobileApiError("not_found", "Event not found.", 404);
      }
      console.warn(
        `[mobile-api] organizer access denied user=${userId} event=${opts.eventId} role=${role} linked=${linkedOrganizerId}`,
      );
      throw new MobileApiError(
        "forbidden",
        "You do not have access to this event.",
        403,
      );
    }
  }

  return {
    user: { ...user, id: userId, role },
    isAdmin,
    isGatePass,
    linkedOrganizerId,
  };
}
