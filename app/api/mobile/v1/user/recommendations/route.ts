import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";
import {
  toListingCard,
  toListingImage,
  toNumericListingRow,
  LISTING_CARD_COLUMNS,
  type ListingImageDTO,
  type ListingRowLike,
} from "@/lib/mobile/mappers";
import { getRecommendationCandidates } from "@/lib/recommendations/candidates";
import { scoreCandidates, diversify, type ScoredCandidate } from "@/lib/recommendations/scoring";
import { getTimeIntentBoostsByCategoryId } from "@/lib/recommendations/time-intent";
import { getUserCategoryAffinity } from "@/lib/recommendations/affinity";

export const dynamic = "force-dynamic";

// Same Karachi bounding box used by the nearby-listings server action.
const LAT_BOUNDS = { min: 24.7, max: 25.0 };
const LNG_BOUNDS = { min: 66.9, max: 67.4 };

function parseCoord(raw: string | null, bounds: { min: number; max: number }): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < bounds.min || n > bounds.max) return null;
  return n;
}

function isAdmin(role?: string): boolean {
  return role === "admin" || role === "super_admin";
}

function buildReasonText(candidate: ScoredCandidate): string {
  const parts: string[] = [];
  if (candidate.openState === "open") parts.push("Open now");
  else if (candidate.openState === "closed") parts.push("Closed now");

  if (candidate.distanceMeters != null) {
    const km = candidate.distanceMeters / 1000;
    parts.push(km < 1 ? `${Math.round(candidate.distanceMeters)} m away` : `${km.toFixed(1)} km away`);
  }

  return parts.join(" · ") || "Recommended for you";
}

/**
 * GET /api/mobile/v1/user/recommendations?limit=&lat=&lng=&debug=
 *
 * Context-aware "Recommended For You": a weighted blend of category affinity
 * (time-of-day context, blended with learned per-user signal as it
 * accumulates), geo proximity, "open now", and freshness - see
 * lib/recommendations/scoring.ts for the model. No `category` param anymore
 * (the client no longer sends one; a themed category feed belongs on the
 * category browse screen, not here).
 *
 * Auth is optional: geo + time + open-now needs no account, and requiring
 * one meant a token expiry on Home mount silently logged the user out (see
 * src/lib/api.ts's 401 -> clearSession handling in the RN app). Signed-out
 * callers are identified by the `X-Anon-Id` header for affinity purposes.
 *
 * Location preference: `lat`/`lng` query params -> the caller's active saved
 * location -> none (time-of-day + freshness only).
 *
 * `?debug=1` (admin only) adds a per-term score breakdown to `meta.signals`.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await getOptionalMobileUser(request);
  await enforceMobileRateLimit(request, user?.id);

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 20 ? limitRaw : 6;
  const debug = searchParams.get("debug") === "1" && isAdmin(user?.role);
  const anonId = request.headers.get("x-anon-id");

  let lat = parseCoord(searchParams.get("lat"), LAT_BOUNDS);
  let lng = parseCoord(searchParams.get("lng"), LNG_BOUNDS);

  if ((lat == null || lng == null) && user) {
    const { rows } = await query(
      `SELECT latitude, longitude FROM public.user_saved_locations
       WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [user.id],
    );
    const active = rows[0];
    if (active) {
      lat = Number(active.latitude);
      lng = Number(active.longitude);
    }
  }

  const now = new Date();

  const [candidates, timeIntentByCategoryId, affinity] = await Promise.all([
    getRecommendationCandidates({ lat, lng, now, onlyOpen: true }),
    getTimeIntentBoostsByCategoryId(now),
    getUserCategoryAffinity({ userId: user?.id ?? null, anonId: user ? null : anonId }),
  ]);

  if (candidates.length === 0) {
    return ok([], { reason: "No listings available right now.", signals: {} });
  }

  const scored = scoreCandidates(candidates, {
    timeIntentByCategoryId,
    learnedAffinityByCategoryId: affinity.byCategoryId,
    eventCount: affinity.eventCount,
    now,
    actorKey: user?.id ?? anonId ?? "anon",
  });

  const ranked = diversify(scored, limit);
  const orderedIds = ranked.map((c) => c.id);

  const { rows: cardRows } = await query(
    `SELECT ${LISTING_CARD_COLUMNS} FROM listings_with_details WHERE id = ANY($1::int[])`,
    [orderedIds],
  );
  const byId = new Map<number, ListingRowLike>();
  for (const row of cardRows) {
    const normalized = toNumericListingRow(row);
    byId.set(normalized.id as number, normalized);
  }

  const imagesByListing: Record<number, ListingImageDTO[]> = {};
  const { rows: images } = await query(
    `SELECT id, listing_id, url, alt_text, display_order, is_primary
     FROM listing_images
     WHERE listing_id = ANY($1::int[])
     ORDER BY display_order ASC`,
    [orderedIds],
  );
  for (const img of images) {
    (imagesByListing[img.listing_id] ??= []).push(toListingImage(img));
  }

  const listings = orderedIds
    .map((id) => byId.get(id))
    .filter((r): r is ListingRowLike => r !== undefined)
    .map((r) => toListingCard(r, imagesByListing[r.id as number] ?? []));

  const signals: Record<
    number,
    {
      distanceMeters: number | null;
      openState: ScoredCandidate["openState"];
      reason: string;
      score?: number;
      breakdown?: ScoredCandidate["breakdown"];
    }
  > = {};
  for (const candidate of ranked) {
    signals[candidate.id] = {
      distanceMeters: candidate.distanceMeters,
      openState: candidate.openState,
      reason: buildReasonText(candidate),
      ...(debug ? { score: candidate.score, breakdown: candidate.breakdown } : {}),
    };
  }

  return ok(listings, {
    reason: lat != null && lng != null ? "Based on your location and time of day" : "Based on time of day",
    signals,
  });
});
