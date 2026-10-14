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

/**
 * Today's closing time ("HH:MM") for each listing that's open right now, from
 * the same branch timings / opening hours as {@link getOpenListingIds}. With
 * several spans covering now (branches), the one that runs latest wins; if any
 * of them is round-the-clock there's no closing time and the listing is left
 * out.
 */
export async function getClosingTimes(
  listingIds: number[],
): Promise<Map<number, string>> {
  const closes = new Map<number, string>();
  if (listingIds.length === 0) return closes;

  const { rows } = await query(
    `WITH now_local AS (
       SELECT (now() AT TIME ZONE 'Asia/Karachi')::time AS t,
              EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Karachi'))::int AS dow
     ),
     spans AS (
       SELECT lb.listing_id,
              split_part(lb.timings, '-', 1)::time AS open_time,
              split_part(lb.timings, '-', 2)::time AS close_time
       FROM listing_branches lb
       WHERE lb.listing_id = ANY($1::bigint[])
         AND lb.timings ~ '^[0-9]{2}:[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}:[0-9]{2}$'
       UNION ALL
       SELECT oh.listing_id, oh.open_time, oh.close_time
       FROM opening_hours oh, now_local n
       WHERE oh.listing_id = ANY($1::bigint[])
         AND oh.day_of_week = n.dow
         AND oh.is_closed = false
         AND oh.open_time IS NOT NULL
         AND oh.close_time IS NOT NULL
     )
     SELECT DISTINCT ON (s.listing_id)
            s.listing_id,
            to_char(s.close_time, 'HH24:MI') AS close_time,
            -- Same open/close, or 00:00–23:59 (how all-day places are entered).
            (s.open_time = s.close_time
              OR (s.open_time = '00:00'::time AND s.close_time >= '23:59'::time)) AS all_day
     FROM spans s, now_local n
     WHERE CASE
             WHEN s.open_time <= s.close_time THEN n.t BETWEEN s.open_time AND s.close_time
             ELSE n.t >= s.open_time OR n.t <= s.close_time
           END
     ORDER BY s.listing_id,
              all_day DESC,
              -- Time left until close, wrapping past midnight.
              (EXTRACT(EPOCH FROM (s.close_time - n.t)) + 86400)::bigint % 86400 DESC`,
    [listingIds],
  );

  for (const row of rows) {
    const id = Number(row.listing_id);
    if (Number.isFinite(id) && !row.all_day && row.close_time) {
      closes.set(id, String(row.close_time));
    }
  }
  return closes;
}
