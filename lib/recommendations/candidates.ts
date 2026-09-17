/**
 * Candidate gathering for "Recommended For You": geo-sorted via
 * get_nearby_listings when coords are known, else freshness-ordered.
 * Hard-filters to published listings with >=1 image (49k+ images available,
 * so this is nearly free and prevents blank cards) and >=1 category link
 * (required for the affinity term).
 */
import { query } from "@/lib/db";
import { getListingCategoryIdsMap } from "@/lib/listings/sync-listing-categories";
import { RECS_TIMEZONE } from "./constants";
import type { CandidateInput, OpenState } from "./scoring";

const CANDIDATE_POOL_SIZE = 150;
const NEARBY_RADIUS_METERS = 20_000;

type OpeningHourRow = {
  listing_id: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
};

let categoryParentIdCache: Promise<Map<number, number | null>> | null = null;

/** Process-lifetime cache of category id -> parent id, for the diversity re-rank's parent cap. */
export function getCategoryParentIdMap(): Promise<Map<number, number | null>> {
  if (!categoryParentIdCache) {
    categoryParentIdCache = query(`SELECT id, parent_id FROM categories`)
      .then(
        ({ rows }) =>
          new Map(
            (rows as Array<{ id: number | string; parent_id: number | string | null }>).map(
              (r) => [Number(r.id), r.parent_id != null ? Number(r.parent_id) : null],
            ),
          ),
      )
      .catch((error) => {
        categoryParentIdCache = null;
        throw error;
      });
  }
  return categoryParentIdCache;
}

function getKarachiWeekdayAndTime(now: Date): { dayOfWeek: number; timeStr: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RECS_TIMEZONE,
    weekday: "short",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const second = parts.find((p) => p.type === "second")?.value ?? "00";
  return { dayOfWeek: weekdayMap[weekday] ?? 0, timeStr: `${hour}:${minute}:${second}` };
}

/**
 * `rows` undefined/empty (no opening_hours rows at all) returns null, which
 * gates the open-now scoring term off entirely. A day with no matching row
 * (data gap) returns "unknown"; a matched row outside its time range (or
 * explicitly `is_closed`) returns "closed".
 */
export function computeOpenState(
  rows: OpeningHourRow[] | undefined,
  now: Date,
): OpenState | null {
  if (!rows || rows.length === 0) return null;
  const { dayOfWeek, timeStr } = getKarachiWeekdayAndTime(now);
  const today = rows.filter((r) => r.day_of_week === dayOfWeek);
  if (today.length === 0) return "unknown";

  const isOpen = today.some((r) => {
    if (r.is_closed) return false;
    if (!r.open_time || !r.close_time) return false;
    if (r.close_time <= r.open_time) {
      // Overnight range crossing midnight, e.g. 18:00:00-02:00:00.
      return timeStr >= r.open_time || timeStr < r.close_time;
    }
    return timeStr >= r.open_time && timeStr < r.close_time;
  });
  return isOpen ? "open" : "closed";
}

/**
 * Structural "stays open late" signal for the Late Night discovery intent
 * (lib/discovery/intents.ts) - true if any day's hours cross midnight or
 * fall within 23:00-05:00, regardless of what time it is right now. This is
 * independent of {@link computeOpenState} ("is it open right now"): a
 * listing that closes at 2am is a late-night venue at 6pm just as much as
 * at 1am, it just isn't *open* at 6pm.
 */
export function computeClosesLate(rows: OpeningHourRow[] | undefined): boolean {
  if (!rows || rows.length === 0) return false;
  return rows.some((r) => {
    if (r.is_closed) return false;
    if (!r.open_time || !r.close_time) return false;
    return r.close_time <= r.open_time || r.close_time <= "05:00:00" || r.close_time >= "23:00:00";
  });
}

export type CandidateContext = {
  lat: number | null;
  lng: number | null;
  now: Date;
  poolSize?: number;
  /** Hard-filters out any candidate whose openState isn't exactly "open" -
   * both "closed" and "unknown"/no-data listings are dropped. Only "For You"
   * sets this; Discovery Intents leaves it unset since it deliberately still
   * shows closed listings with a "Closed now" label. */
  onlyOpen?: boolean;
};

export type RawCandidate = CandidateInput;

export async function getRecommendationCandidates(
  ctx: CandidateContext,
): Promise<RawCandidate[]> {
  const poolSize = ctx.poolSize ?? CANDIDATE_POOL_SIZE;

  let baseRows: Array<{ id: number; distanceMeters: number | null }>;
  if (ctx.lat != null && ctx.lng != null) {
    const { rows } = await query(
      `SELECT id, status, distance_meters FROM get_nearby_listings($1, $2, $3, $4)`,
      [ctx.lat, ctx.lng, NEARBY_RADIUS_METERS, poolSize],
    );
    baseRows = (rows as Array<{ id: number; status: string; distance_meters: number | string }>)
      .filter((r) => r.status === "published")
      .map((r) => ({ id: Number(r.id), distanceMeters: Number(r.distance_meters) }));
  } else {
    const { rows } = await query(
      `SELECT id FROM listings_with_details
       WHERE status = 'published'
         AND EXISTS (SELECT 1 FROM listing_images li WHERE li.listing_id = listings_with_details.id)
       ORDER BY created_at DESC NULLS LAST, id DESC
       LIMIT $1`,
      [poolSize],
    );
    baseRows = (rows as Array<{ id: number }>).map((r) => ({
      id: Number(r.id),
      distanceMeters: null,
    }));
  }

  if (baseRows.length === 0) return [];
  const ids = baseRows.map((r) => r.id);

  const [categoriesByListing, parentIdByCategory, { rows: imageRows }, { rows: hourRows }, { rows: metaRows }] =
    await Promise.all([
      getListingCategoryIdsMap(ids),
      getCategoryParentIdMap(),
      query(`SELECT DISTINCT listing_id FROM listing_images WHERE listing_id = ANY($1::int[])`, [ids]),
      query(
        // Most listings' hours live on their primary branch, not a listing-level
        // (branch_id IS NULL) row - verified live 2026-07-29: only 564 listings
        // have branch_id IS NULL rows vs. 13,577 with hours on their primary branch.
        `SELECT oh.listing_id, oh.day_of_week, oh.open_time, oh.close_time, oh.is_closed
         FROM opening_hours oh
         LEFT JOIN listing_branches lb ON lb.id = oh.branch_id
         WHERE oh.listing_id = ANY($1::int[]) AND (oh.branch_id IS NULL OR lb.is_primary = true)`,
        [ids],
      ),
      query(
        // top_rated_pinned isn't on the view, so it's reached by joining back
        // to `listings` - same join top-rated/route.ts already does to read
        // this same flag for its own cold-start fallback.
        `SELECT ld.id, ld.created_at, ld.avg_rating, l.top_rated_pinned
         FROM listings_with_details ld
         JOIN listings l ON l.id = ld.id
         WHERE ld.id = ANY($1::int[])`,
        [ids],
      ),
    ]);

  const hasImage = new Set(
    (imageRows as Array<{ listing_id: number }>).map((r) => Number(r.listing_id)),
  );
  const hoursByListing = new Map<number, OpeningHourRow[]>();
  for (const row of hourRows as OpeningHourRow[]) {
    const key = Number(row.listing_id);
    const list = hoursByListing.get(key) ?? [];
    list.push(row);
    hoursByListing.set(key, list);
  }
  const metaByListing = new Map<
    number,
    { createdAt: string | null; avgRating: number | null; topRatedPinned: boolean }
  >();
  for (const row of metaRows as Array<{
    id: number;
    created_at: string | null;
    avg_rating: number | string | null;
    top_rated_pinned: boolean | null;
  }>) {
    metaByListing.set(Number(row.id), {
      createdAt: row.created_at,
      avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
      topRatedPinned: row.top_rated_pinned === true,
    });
  }

  const candidates: RawCandidate[] = [];
  for (const base of baseRows) {
    if (!hasImage.has(base.id)) continue;

    const categoryIds = categoriesByListing.get(base.id) ?? [];
    if (categoryIds.length === 0) continue;
    const parentCategoryIds = [
      ...new Set(
        categoryIds
          .map((id) => parentIdByCategory.get(id))
          .filter((id): id is number => id != null),
      ),
    ];

    const openState = computeOpenState(hoursByListing.get(base.id), ctx.now);
    if (ctx.onlyOpen && openState !== "open") continue;

    const meta = metaByListing.get(base.id);
    const ageDays = meta?.createdAt
      ? (ctx.now.getTime() - new Date(meta.createdAt).getTime()) / 86_400_000
      : null;

    candidates.push({
      id: base.id,
      categoryIds,
      parentCategoryIds,
      distanceMeters: base.distanceMeters,
      openState,
      ageDays,
      avgRating: meta?.avgRating ?? null,
      topRatedPinned: meta?.topRatedPinned ?? false,
      closesLate: computeClosesLate(hoursByListing.get(base.id)),
    });
  }

  return candidates;
}
