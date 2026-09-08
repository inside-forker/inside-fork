/**
 * GET and POST /api/gamification/daily-login
 * Daily login system with streak tracking using direct PostgreSQL queries
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { query } from "@/lib/db";
import { checkAndProcessRankUp } from "@/lib/gamification";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import type {
  DailyLoginClaimResult,
  DailyLoginStatus,
} from "@/types/gamification.types";

const ROUTE = "/api/gamification/daily-login";

function getKarachiDateStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

type StreakSnapshot = {
  current_streak: number | null;
  longest_streak: number | null;
  total_logins: number | null;
  last_login_date: string | null;
  last_claimed_date: string | null;
  streak_started_at: string | null;
  updated_at: string | null;
};

/**
 * GET - Check daily login status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // `last_claimed_date` / `last_login_date` are DATE columns: pg parses them
    // into JS Date objects, which never `===` a "YYYY-MM-DD" string. Cast to
    // text so the day comparisons below actually work.
    const { rows: streaks } = await query(
      `SELECT current_streak, longest_streak, total_logins,
              to_char(last_login_date, 'YYYY-MM-DD') AS last_login_date,
              to_char(last_claimed_date, 'YYYY-MM-DD') AS last_claimed_date
       FROM public.daily_login_streaks WHERE user_id = $1 LIMIT 1`,
      [session.userId]
    );
    const streakData = streaks[0];

    const { rows: activities } = await query(
      "SELECT xp_value FROM public.xp_activities WHERE activity_slug = $1 LIMIT 1",
      ["daily_login"]
    );
    const dailyLoginXP = activities[0]?.xp_value || 5;

    const todayStr = getKarachiDateStr();
    const hasLoggedInToday = streakData?.last_claimed_date === todayStr;
    const canClaim = !hasLoggedInToday;

    const status: DailyLoginStatus = {
      has_logged_in_today: hasLoggedInToday,
      current_streak: streakData?.current_streak || 0,
      longest_streak: streakData?.longest_streak || 0,
      total_logins: streakData?.total_logins || 0,
      can_claim_xp: canClaim,
      xp_earned_today: dailyLoginXP,
      next_claim_at: hasLoggedInToday
        ? new Date(
            new Date(todayStr + "T00:00:00+05:00").getTime() +
              24 * 60 * 60 * 1000,
          ).toISOString()
        : undefined,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("Daily login GET error:", error);
    captureRouteError(error, { route: ROUTE, method: "GET" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST - Claim daily login XP
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStr = getKarachiDateStr();

    // Initialize streak data if it does not exist
    await query(
      `INSERT INTO public.daily_login_streaks (user_id, current_streak, longest_streak, total_logins, last_login_date, streak_started_at, updated_at)
       VALUES ($1, 0, 0, 0, $2, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [session.userId, todayStr, now.toISOString()]
    );

    // DATE columns cast to text (see GET) so the day-string comparisons and
    // streak math below don't silently fail against JS Date objects.
    const { rows: streaks } = await query(
      `SELECT current_streak, longest_streak, total_logins,
              to_char(last_login_date, 'YYYY-MM-DD') AS last_login_date,
              to_char(last_claimed_date, 'YYYY-MM-DD') AS last_claimed_date,
              streak_started_at, updated_at
       FROM public.daily_login_streaks WHERE user_id = $1 LIMIT 1`,
      [session.userId]
    );
    const streakData = streaks[0];

    if (!streakData) {
      return NextResponse.json(
        { error: "Failed to fetch streak data" },
        { status: 500 }
      );
    }

    if (streakData.last_claimed_date === todayStr) {
      return NextResponse.json(
        { error: "Already claimed today", can_claim: false },
        { status: 400 },
      );
    }

    const lastLoginStr = streakData.last_login_date;
    const yesterdayDate = new Date(todayStr + "T00:00:00+05:00");
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });

    let newStreak = 1;
    let streakBroken = false;

    if (lastLoginStr === yesterdayStr) {
      newStreak = (streakData.current_streak || 0) + 1;
    } else if (lastLoginStr === todayStr) {
      newStreak = streakData.current_streak || 1;
    } else {
      newStreak = 1;
      streakBroken = true;
    }

    const earned7DayBonus = newStreak === 7;
    let bonusXP = 0;

    const { rows: activities } = await query(
      "SELECT activity_slug, xp_value FROM public.xp_activities WHERE activity_slug = ANY($1)",
      [["daily_login", "streak_7day"]]
    );

    const dailyLoginXP =
      activities.find((a) => a.activity_slug === "daily_login")?.xp_value || 5;
    const streakBonusXP =
      activities.find((a) => a.activity_slug === "streak_7day")?.xp_value || 20;

    if (earned7DayBonus) {
      bonusXP = streakBonusXP;
    }

    // Optimistic lock via updated_at
    const { rows: updatedStreaks } = await query(
      `UPDATE public.daily_login_streaks
       SET current_streak = $1,
           longest_streak = $2,
           total_logins = $3,
           last_login_date = $4,
           last_claimed_date = $4,
           streak_started_at = $5,
           updated_at = $6
       WHERE user_id = $7 AND updated_at = $8
       RETURNING user_id`,
      [
        newStreak,
        Math.max(newStreak, streakData.longest_streak || 0),
        (streakData.total_logins || 0) + 1,
        todayStr,
        streakBroken ? now.toISOString() : streakData.streak_started_at,
        now.toISOString(),
        session.userId,
        streakData.updated_at
      ]
    );

    const claimedRow = updatedStreaks[0];

    if (!claimedRow) {
      return NextResponse.json(
        { error: "Already claimed today", can_claim: false },
        { status: 409 },
      );
    }

    const totalXP = dailyLoginXP + bonusXP;

    try {
      await query(
        "INSERT INTO public.points_log (user_id, points, reason) VALUES ($1, $2, $3)",
        [session.userId, dailyLoginXP, "daily_login"]
      );

      if (earned7DayBonus) {
        await query(
          "INSERT INTO public.points_log (user_id, points, reason) VALUES ($1, $2, $3)",
          [session.userId, bonusXP, "streak_7day"]
        );
      }
    } catch (logError) {
      console.error("Failed to log points - rolling back streak claim:", logError);
      
      // Rollback streak
      await query(
        `UPDATE public.daily_login_streaks
         SET current_streak = $1,
             longest_streak = $2,
             total_logins = $3,
             last_login_date = $4,
             last_claimed_date = $5,
             streak_started_at = $6,
             updated_at = $7
         WHERE user_id = $8`,
        [
          streakData.current_streak ?? 0,
          streakData.longest_streak ?? 0,
          streakData.total_logins ?? 0,
          streakData.last_login_date,
          streakData.last_claimed_date,
          streakData.streak_started_at,
          streakData.updated_at,
          session.userId
        ]
      );

      captureRouteError(logError, {
        route: ROUTE,
        method: "POST",
        extra: { stage: "points_log_insert" },
      });

      return NextResponse.json(
        { error: "Failed to award daily login XP", can_claim: true },
        { status: 500 }
      );
    }

    const { rows: profileRows } = await query(
      `SELECT points FROM public.profiles WHERE id = $1`,
      [session.userId],
    );
    const newTotalXP = (profileRows[0]?.points as number) ?? 0;
    const newRank = await checkAndProcessRankUp(session.userId, newTotalXP);

    const result: DailyLoginClaimResult = {
      success: true,
      xp_awarded: totalXP,
      new_streak: newStreak,
      streak_bonus: earned7DayBonus
        ? { earned: true, xp_bonus: bonusXP, days_in_streak: 7 }
        : undefined,
      message: earned7DayBonus
        ? `7-Day Streak Bonus! +${totalXP} XP total`
        : `+${dailyLoginXP} XP! Day ${newStreak} streak`,
      rank_up: !!newRank,
      new_rank: newRank,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Daily login POST error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
