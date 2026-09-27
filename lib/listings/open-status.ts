/**
 * Resolve listings that are open now / open tonight once per short TTL, then
 * filter with `id = ANY($ids)` instead of a correlated EXISTS over timings
 * regex for every row of `listings_with_details`.
 */
import { query } from "@/lib/db";

export type OpenMode = "now" | "tonight";

const TTL_MS = 45_000;
const cache = new Map<string, { ids: number[]; expiresAt: number }>();
const inflight = new Map<string, Promise<number[]>>();

/** Branch timings "HH:MM:SS-HH:MM:SS" currently covering Karachi local time. */
const BRANCH_OPEN_NOW_SQL = `
  SELECT DISTINCT lb.listing_id
  FROM listing_branches lb
  WHERE lb.timings ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}$'
    AND (
      CASE
        WHEN split_part(lb.timings, '-', 1)::time <= split_part(lb.timings, '-', 2)::time THEN
          (now() AT TIME ZONE 'Asia/Karachi')::time
            BETWEEN split_part(lb.timings, '-', 1)::time AND split_part(lb.timings, '-', 2)::time
        ELSE
          (now() AT TIME ZONE 'Asia/Karachi')::time >= split_part(lb.timings, '-', 1)::time
          OR (now() AT TIME ZONE 'Asia/Karachi')::time <= split_part(lb.timings, '-', 2)::time
      END
    )
`;

const HOURS_OPEN_NOW_SQL = `
  SELECT DISTINCT oh.listing_id
  FROM opening_hours oh
  WHERE oh.day_of_week = EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Karachi'))::int
    AND oh.is_closed = false
    AND oh.open_time IS NOT NULL
    AND oh.close_time IS NOT NULL
    AND (
      CASE
        WHEN oh.open_time <= oh.close_time THEN
          (now() AT TIME ZONE 'Asia/Karachi')::time BETWEEN oh.open_time AND oh.close_time
        ELSE
          (now() AT TIME ZONE 'Asia/Karachi')::time >= oh.open_time
          OR (now() AT TIME ZONE 'Asia/Karachi')::time <= oh.close_time
      END
    )
`;

/** Tonight: overnight spans or evening hours (≥20:00 close), branches + hours. */
const OPEN_TONIGHT_IDS_SQL = `
  SELECT DISTINCT listing_id FROM (
    SELECT lb.listing_id
    FROM listing_branches lb
    WHERE lb.timings ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}$'
      AND (
        split_part(lb.timings, '-', 1)::time > split_part(lb.timings, '-', 2)::time
        OR (
          split_part(lb.timings, '-', 2)::time >= '20:00:00'::time
          AND split_part(lb.timings, '-', 1)::time <= '22:00:00'::time
        )
      )
    UNION
    SELECT oh.listing_id
    FROM opening_hours oh
    WHERE oh.day_of_week = EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Karachi'))::int
      AND oh.is_closed = false
      AND oh.open_time IS NOT NULL
      AND oh.close_time IS NOT NULL
      AND (
        oh.close_time <= oh.open_time
        OR (
          oh.close_time >= '20:00:00'::time
          AND oh.open_time <= '22:00:00'::time
        )
      )
  ) t
`;

function cacheKey(mode: OpenMode): string {
  // Bucket by TTL window so neighbouring requests share one result.
  return `${mode}:${Math.floor(Date.now() / TTL_MS)}`;
}

async function fetchOpenListingIds(mode: OpenMode): Promise<number[]> {
  const sql =
    mode === "tonight"
      ? OPEN_TONIGHT_IDS_SQL
      : `${BRANCH_OPEN_NOW_SQL} UNION ${HOURS_OPEN_NOW_SQL}`;

  const { rows } = await query(sql);
  const ids: number[] = [];
  for (const row of rows) {
    const id = Number(row.listing_id);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}

/** Currently-open (or open-tonight) listing ids — process-local 45s TTL. */
export async function getOpenListingIds(mode: OpenMode): Promise<number[]> {
  const key = cacheKey(mode);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.ids;

  const pending = inflight.get(key);
  if (pending) return pending;

  const work = (async () => {
    const ids = await fetchOpenListingIds(mode);
    cache.set(key, { ids, expiresAt: Date.now() + TTL_MS });
    // Drop older buckets so the map cannot grow unbounded across minutes.
    for (const k of cache.keys()) {
      if (k !== key) cache.delete(k);
    }
    return ids;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, work);
  return work;
}
