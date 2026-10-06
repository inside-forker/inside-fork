import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { query } from "@/lib/db";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import {
  clampPlacesLimit,
  parseCoord,
  PlacesSearchValidationError,
  queryPlaces,
} from "@/lib/search/query-places";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/search/places?q=&limit=&offset=&lat=&lng=&type=
 *
 * Thin wrapper around shared queryPlaces. Resolves saved-location coords when
 * the client omits lat/lng.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const searchType = (searchParams.get("type") ?? "all").toLowerCase();
  const limit = clampPlacesLimit(
    parseInt(searchParams.get("limit") ?? "", 10),
  );
  const offset = Math.max(
    0,
    parseInt(searchParams.get("offset") ?? "0", 10) || 0,
  );

  let lat = parseCoord(searchParams.get("lat"), -90, 90);
  let lng = parseCoord(searchParams.get("lng"), -180, 180);

  if (lat == null || lng == null) {
    const { user } = await getOptionalMobileUser(request);
    if (user) {
      try {
        const { rows } = await query(
          `SELECT latitude, longitude FROM public.user_saved_locations
           WHERE user_id = $1 AND is_active = true LIMIT 1`,
          [user.id],
        );
        const active = rows[0];
        if (active?.latitude != null && active?.longitude != null) {
          lat = Number(active.latitude);
          lng = Number(active.longitude);
        }
      } catch {
        // ignore
      }
    }
  }

  try {
    const result = await queryPlaces({
      q: rawQuery,
      limit,
      offset,
      type: searchType,
      lat,
      lng,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof PlacesSearchValidationError) {
      throw new MobileApiError("validation_error", error.message, 400, "q");
    }
    console.error("[mobile-api] places search failed:", error);
    throw new MobileApiError("internal_error", "Failed to search places.", 500);
  }
});
