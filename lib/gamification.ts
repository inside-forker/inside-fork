import { query } from "@/lib/db";
import { createNotification } from "@/lib/notifications/service";
import {
  type ActivityCheckResponse,
  type XPAwardResult,
} from "@/types/gamification.types";

type XPActivity = {
  id: number;
  activity_slug: string;
  xp_value: number;
  cooldown_type: string;
  max_per_day: number | null;
};

/**
 * Check if user can perform an activity (respects cooldowns)
 */
export async function checkActivityEligibility(
  userId: string,
  activitySlug: string,
): Promise<ActivityCheckResponse> {
  try {
    // Get activity definition
    const { rows: activityRows } = await query(
      `SELECT id, activity_slug, cooldown_type, max_per_day
       FROM public.xp_activities
       WHERE activity_slug = $1 AND is_active = true
       LIMIT 1`,
      [activitySlug],
    );
    const activity = activityRows[0] as
      | Pick<XPActivity, "id" | "activity_slug" | "cooldown_type" | "max_per_day">
      | undefined;

    if (!activity) {
      return { can_perform: false, reason: "Activity not found or inactive" };
    }

    // One-time activities - check if already claimed
    if (activity.cooldown_type === "once") {
      const { rows: existing } = await query(
        `SELECT id FROM public.points_log
         WHERE user_id = $1 AND reason = $2
         LIMIT 1`,
        [userId, activitySlug],
      );

      if (existing.length > 0) {
        return { can_perform: false, reason: "Activity already claimed" };
      }
    }

    // Daily activities - check if already done today
    if (activity.cooldown_type === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { rows: todaysLog } = await query(
        `SELECT id FROM public.points_log
         WHERE user_id = $1 AND reason = $2 AND created_at >= $3
         LIMIT 1`,
        [userId, activitySlug, today.toISOString()],
      );

      if (todaysLog.length > 0) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return {
          can_perform: false,
          reason: "Already claimed today",
          next_available_at: tomorrow.toISOString(),
        };
      }
    }

    // Weekly activities - check if already done this week
    if (activity.cooldown_type === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { rows: weeklyLog } = await query(
        `SELECT id FROM public.points_log
         WHERE user_id = $1 AND reason = $2 AND created_at >= $3
         LIMIT 1`,
        [userId, activitySlug, weekAgo.toISOString()],
      );

      if (weeklyLog.length > 0) {
        return { can_perform: false, reason: "Already claimed this week" };
      }
    }

    // Unlimited with daily cap - check daily count
    if (activity.cooldown_type === "unlimited" && activity.max_per_day) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { rows: dailyActivities } = await query(
        `SELECT id FROM public.points_log
         WHERE user_id = $1 AND reason = $2 AND created_at >= $3`,
        [userId, activitySlug, today.toISOString()],
      );

      if (dailyActivities.length >= activity.max_per_day) {
        return {
          can_perform: false,
          reason: `Daily limit reached (${activity.max_per_day}/day)`,
          daily_count: dailyActivities.length,
          max_per_day: activity.max_per_day,
        };
      }

      return {
        can_perform: true,
        daily_count: dailyActivities.length,
        max_per_day: activity.max_per_day,
      };
    }

    // Per-target activities (e.g. per listing, per event): duplicate checking is
    // handled at the call site, which passes the related_id.

    return { can_perform: true };
  } catch (error) {
    console.error("Error checking activity eligibility:", error);
    return { can_perform: false, reason: "Error checking eligibility" };
  }
}

/**
 * Check if user ranked up and award badge if applicable
 */
export async function checkAndProcessRankUp(
  userId: string,
  newTotalXP: number,
): Promise<XPAwardResult["new_rank"] | undefined> {
  try {
    // Get all active ranks ordered by XP requirement
    const { rows: ranks } = await query(
      `SELECT id, name, slug, color, benefits, min_xp_required
       FROM public.ranks
       WHERE is_active = true
       ORDER BY min_xp_required ASC`,
    );

    if (ranks.length === 0) return undefined;

    // Find the highest rank user qualifies for
    let newRank = ranks[0]; // At least Explorer (0 XP)
    for (const rank of ranks) {
      if (newTotalXP >= rank.min_xp_required) {
        newRank = rank;
      } else {
        break;
      }
    }

    // Check current rank
    const { rows: currentRankRows } = await query(
      `SELECT rank_id FROM public.user_ranks
       WHERE user_id = $1 AND current_rank = true
       LIMIT 1`,
      [userId],
    );
    const currentRankEntry = currentRankRows[0] as { rank_id: number } | undefined;

    // Rank up detected
    if (!currentRankEntry || currentRankEntry.rank_id !== newRank.id) {
      // Keep rank transition idempotent under concurrent writes.
      await query(
        `UPDATE public.user_ranks
         SET current_rank = false
         WHERE user_id = $1 AND current_rank = true AND rank_id != $2`,
        [userId, newRank.id],
      );

      try {
        await query(
          `INSERT INTO public.user_ranks (user_id, rank_id, current_rank)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id, rank_id)
           DO UPDATE SET current_rank = true`,
          [userId, newRank.id],
        );
      } catch (upsertRankError) {
        console.error("Rank upsert warning:", upsertRankError);
      }

      await query(
        `UPDATE public.user_ranks
         SET current_rank = false
         WHERE user_id = $1 AND current_rank = true AND rank_id != $2`,
        [userId, newRank.id],
      );

      // Get or create badge for this rank
      const { rows: badgeRows } = await query(
        `SELECT id FROM public.badges WHERE name = $1 LIMIT 1`,
        [`${newRank.name} Badge`],
      );
      const rankBadge = badgeRows[0] as { id: number } | undefined;

      // Award badge (ignore if already awarded - composite PK conflict handled gracefully)
      if (rankBadge) {
        try {
          await query(
            `INSERT INTO public.user_badges (user_id, badge_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [userId, rankBadge.id],
          );
        } catch (_e) {
          // Already has badge - that's okay
          console.log("User already has this badge");
        }
      }

      try {
        await createNotification({
          recipientId: userId,
          roleScope: "public_user",
          categorySlug: "public_rank_up",
          title: `🎉 You've reached ${newRank.name}!`,
          body: `Your new rank unlocks fresh perks — check them out.`,
          priority: "high",
          ctaLabel: "View leaderboard",
          ctaUrl: "/leaderboard",
          metadata: {
            rank_id: newRank.id,
            rank_slug: newRank.slug,
            xp_total: newTotalXP,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send rank-up notification:", notifyError);
      }

      return {
        id: newRank.id,
        name: newRank.name,
        slug: newRank.slug,
        color: newRank.color || "#000000",
        benefits: (newRank.benefits as string[]) || [],
      };
    }

    return undefined;
  } catch (error) {
    console.error("Error checking rank-up:", error);
    return undefined;
  }
}

/**
 * Award XP to a user
 */
export async function awardXP(
  userId: string,
  activitySlug: string,
  relatedId?: string | number,
  customPoints?: number,
): Promise<
  XPAwardResult | { error: string; details?: string; status?: number }
> {
  // Get activity definition and validate
  const { rows: activityRows } = await query(
    `SELECT id, xp_value, cooldown_type, max_per_day
     FROM public.xp_activities
     WHERE activity_slug = $1 AND is_active = true
     LIMIT 1`,
    [activitySlug],
  );
  const activity = activityRows[0] as
    | Pick<XPActivity, "id" | "xp_value" | "cooldown_type" | "max_per_day">
    | undefined;

  if (!activity) {
    return {
      error: "Activity not found or inactive",
      status: 404,
    };
  }

  // Check eligibility
  // Note: For per_target, we assume the caller has verified uniqueness if needed (e.g. one review per listing)
  // Or we could implement it here if we query points_log by related_id
  if (activity.cooldown_type === "per_target" && relatedId) {
    const relatedIdInt =
      typeof relatedId === "string" ? parseInt(relatedId) : relatedId;

    const { rows: existing } = await query(
      `SELECT id FROM public.points_log
       WHERE user_id = $1 AND reason = $2 AND related_id = $3
       LIMIT 1`,
      [userId, activitySlug, relatedIdInt],
    );

    if (existing.length > 0) {
      return {
        error: "Activity already performed for this target",
        status: 409, // Conflict
      };
    }
  }

  const eligibility = await checkActivityEligibility(userId, activitySlug);
  if (!eligibility.can_perform) {
    return {
      error: eligibility.reason || "Not eligible",
      status: 403,
    };
  }

  // Determine points to award
  const pointsToAward =
    customPoints !== undefined ? customPoints : activity.xp_value;

  // Log to points_log - this will trigger the profile update
  // NOTE: points_log table does NOT have a metadata column
  try {
    await query(
      `INSERT INTO public.points_log (user_id, points, reason, related_id)
       VALUES ($1, $2, $3, $4)`,
      [
        userId,
        pointsToAward,
        activitySlug,
        relatedId
          ? typeof relatedId === "string"
            ? parseInt(relatedId)
            : relatedId
          : null,
      ],
    );
  } catch (logError) {
    console.error("Warning: Failed to log XP activity:", logError);

    if ((logError as { code?: string }).code === "23505") {
      return {
        error: "Activity already recorded",
        details: (logError as { message?: string }).message,
        status: 409,
      };
    }

    return {
      error: "Failed to award XP",
      details: (logError as { message?: string }).message,
      status: 500,
    };
  }

  // Get updated user XP (updated by trigger)
  const { rows: profileRows } = await query(
    `SELECT points FROM public.profiles WHERE id = $1 LIMIT 1`,
    [userId],
  );
  const profile = profileRows[0] as { points: number } | undefined;

  if (!profile) {
    return {
      error: "User profile not found",
      status: 404,
    };
  }

  const newXP = profile.points || 0;

  // Check for rank-up
  const newRank = await checkAndProcessRankUp(userId, newXP);

  return {
    success: true,
    xp_awarded: pointsToAward,
    new_total: newXP,
    rank_up: !!newRank,
    new_rank: newRank || undefined,
  };
}

/**
 * Get user-friendly name for an activity slug
 */
export function getFriendlyActivityName(slug: string): string {
  const mapping: Record<string, string> = {
    // Review related
    react_review: "Reacted to a review",
    leave_review: "Wrote a review",

    // Visit/Location related
    visit_location: "Visited a location",
    check_in: "Checked in",

    // Auth/Profile related
    daily_login: "Daily login reward",
    complete_profile: "Completed profile",

    // Engagement
    share_listing: "Shared a listing",
    refer_friend: "Referred a friend",
  };

  return mapping[slug] || slug;
}
