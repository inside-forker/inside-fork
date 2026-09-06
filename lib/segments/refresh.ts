import { query } from "@/lib/db";
import { ALL_SEGMENT_QUERIES, type SegmentQuery } from "@/lib/segments/definitions";

export interface SegmentRefreshResult {
  segmentSlug: string;
  qualified: number;
  added: number;
  removed: number;
}

/**
 * Reconciles a single segment's membership against who currently
 * qualifies: upserts current members (preserving first_qualified_at,
 * bumping last_confirmed_at), and deletes membership rows for users who no
 * longer qualify. One statement per segment, SQL-side (CTEs), no Node-side
 * row reduction (see lib/analytics/admin.ts for the pattern this
 * deliberately avoids - these tables will outgrow that approach).
 */
async function reconcileSegment(spec: SegmentQuery): Promise<SegmentRefreshResult> {
  const slugParamIndex = spec.params.length + 1;

  const sql = `
    WITH qualifying AS (${spec.sql}),
    upserted AS (
      INSERT INTO public.segment_membership (user_id, segment_slug, first_qualified_at, last_confirmed_at)
      SELECT user_id, $${slugParamIndex}, now(), now()
      FROM qualifying
      ON CONFLICT (user_id, segment_slug) DO UPDATE
        SET last_confirmed_at = EXCLUDED.last_confirmed_at
      RETURNING (xmax = 0) AS is_new
    ),
    removed AS (
      DELETE FROM public.segment_membership sm
      WHERE sm.segment_slug = $${slugParamIndex}
        AND NOT EXISTS (SELECT 1 FROM qualifying q WHERE q.user_id = sm.user_id)
      RETURNING sm.user_id
    )
    SELECT
      (SELECT COUNT(*) FROM upserted)::int AS qualified,
      (SELECT COUNT(*) FROM upserted WHERE is_new)::int AS added,
      (SELECT COUNT(*) FROM removed)::int AS removed
  `;

  const { rows } = await query(sql, [...spec.params, spec.slug]);
  const row = rows[0] ?? { qualified: 0, added: 0, removed: 0 };

  return {
    segmentSlug: spec.slug,
    qualified: Number(row.qualified ?? 0),
    added: Number(row.added ?? 0),
    removed: Number(row.removed ?? 0),
  };
}

/** Refreshes all defined segments. Each segment reconciles independently. */
export async function refreshSegments(): Promise<SegmentRefreshResult[]> {
  const results: SegmentRefreshResult[] = [];
  for (const spec of ALL_SEGMENT_QUERIES) {
    results.push(await reconcileSegment(spec));
  }
  return results;
}
