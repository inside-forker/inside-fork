import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
 
type RankRow = {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  icon_url: string | null;
  min_xp_required: number;
  max_slots: number | null;
  benefits: unknown;
  display_order: number;
};

function toNumericRankRow(row: Record<string, unknown>): RankRow {
  return {
    ...row,
    id: Number(row.id),
    min_xp_required: Number(row.min_xp_required ?? 0),
    max_slots: row.max_slots != null ? Number(row.max_slots) : null,
    display_order: Number(row.display_order ?? 0),
  } as RankRow;
}

let ranksLadderCache: { rows: RankRow[]; expiresAt: number } | null = null;
const RANKS_CACHE_TTL_MS = 60_000;

/**
 * GET /api/mobile/v1/gamification/ranks
 *
 * The active rank ladder (ascending by required XP). When authenticated, also
 * returns the caller's current rank + progress to the next. Mirrors
 * `app/api/gamification/ranks` (GET).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await getOptionalMobileUser(request);

  let rankList: RankRow[];
  if (ranksLadderCache && ranksLadderCache.expiresAt > Date.now()) {
    rankList = ranksLadderCache.rows;
  } else {
    try {
      const { rows } = await query(
        `SELECT id, name, slug, color, icon_url, min_xp_required, max_slots, benefits, display_order
         FROM ranks
         WHERE is_active = true
         ORDER BY min_xp_required ASC`,
      );
      rankList = rows.map(toNumericRankRow);
      ranksLadderCache = { rows: rankList, expiresAt: Date.now() + RANKS_CACHE_TTL_MS };
    } catch (error) {
      console.error(
        "[mobile-api] ranks query failed:",
        error instanceof Error ? error.message : error,
      );
      throw new MobileApiError("internal_error", "Failed to load ranks.", 500);
    }
  }

  let userRankInfo: {
    current_rank: RankRow | null;
    next_rank: RankRow | null;
    current_xp: number;
    xp_to_next_rank: number;
    progress_percent: number;
  } | null = null;

  if (user) {
    // Points + current rank in one round trip (was two sequential queries).
    const { rows: userRows } = await query(
      `SELECT p.points, ur.rank_id, ur.achieved_at
       FROM profiles p
       LEFT JOIN user_ranks ur ON ur.user_id = p.id AND ur.current_rank = true
       WHERE p.id = $1`,
      [user.id],
    );
    const userXP = Number(userRows[0]?.points ?? 0);
    const userRankData = userRows[0]?.rank_id != null ? userRows[0] : undefined;

    if (userRankData) {
      const currentRank =
        rankList.find((r) => r.id === Number(userRankData.rank_id)) ?? null;
      const nextRank =
        rankList.find((r) => (r.min_xp_required ?? 0) > userXP) ?? null;
      const currentMin = currentRank?.min_xp_required ?? 0;
      userRankInfo = {
        current_rank: currentRank,
        next_rank: nextRank,
        current_xp: userXP,
        xp_to_next_rank: nextRank
          ? Math.max((nextRank.min_xp_required ?? 0) - userXP, 0)
          : 0,
        progress_percent: nextRank
          ? Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((userXP - currentMin) /
                    Math.max((nextRank.min_xp_required ?? 0) - currentMin, 1)) *
                    100,
                ),
              ),
            )
          : 100,
      };
    }
  }

  return ok({ ranks: rankList, user_rank_info: userRankInfo });
});
