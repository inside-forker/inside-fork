import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

const STAFF_ROLES = new Set(["admin", "super_admin", "lister", "data_entry"]);

export class ListingRouteAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "ListingRouteAccessError";
    this.status = status;
  }
}

export interface ListingRouteAccessContext {
  userId: string;
  effectiveRole: string;
  isStaff: boolean;
}

export async function getListingRouteAccessContext(): Promise<ListingRouteAccessContext> {
  const session = await getSessionFromCookies();

  if (!session) {
    throw new ListingRouteAccessError("Unauthorized", 401);
  }

  const { rows } = await query(
    `SELECT role, active_role FROM profiles WHERE id = $1`,
    [session.userId],
  );
  const profile = rows[0];

  if (!profile) {
    throw new ListingRouteAccessError("Profile not found", 404);
  }

  const effectiveRole = profile.active_role || profile.role;

  return {
    userId: session.userId,
    effectiveRole,
    isStaff: STAFF_ROLES.has(effectiveRole),
  };
}

export async function assertListingRouteAccess(options: {
  listingId: number;
  allowBusinessOwner?: boolean;
}): Promise<ListingRouteAccessContext> {
  const { listingId, allowBusinessOwner = false } = options;
  const context = await getListingRouteAccessContext();

  if (context.isStaff) {
    return context;
  }

  if (!allowBusinessOwner || context.effectiveRole !== "business_owner") {
    throw new ListingRouteAccessError("Access denied", 403);
  }

  const { rows } = await query(
    `SELECT owner_id, created_by FROM listings WHERE id = $1`,
    [listingId],
  );
  const listing = rows[0];

  if (!listing) {
    throw new ListingRouteAccessError("Listing not found", 404);
  }

  const isOwner =
    listing.owner_id === context.userId || listing.created_by === context.userId;

  if (!isOwner) {
    throw new ListingRouteAccessError("You can only manage your own listings", 403);
  }

  return context;
}

export function toListingAccessResponse(error: unknown) {
  if (error instanceof ListingRouteAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "Internal server error" }, { status: 500 });
}
