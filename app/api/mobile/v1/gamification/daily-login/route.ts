import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { checkAndProcessRankUp } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/** Canonical "game day" string (YYYY-MM-DD) in Asia/Karachi. */
function karachiDay(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

async function activityXp(slug: string, fallback: number): Promise<number> {
  const { rows } = await query(
    `SELECT xp_value FROM public.xp_activities WHERE activity_slug = $1 LIMIT 1`,
    [slug],
  );
  return rows[0]?.xp_value ?? fallback;
}

const alreadyClaimed = () =>
  new MobileApiError(
    "already_claimed_today",
    "You have already claimed your daily login today.",
    409,
    undefined,
    { can_claim: false },
  );

/**
 * GET /api/mobile/v1/gamification/daily-login - streak status (auth).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  // `last_claimed_date` is a DATE column: pg parses it to a JS Date, which
  // never `===` a "YYYY-MM-DD" string. Cast to text so `hasClaimedToday` works.
  const { rows: streakRows } = await query(
    `SELECT current_streak, longest_streak, total_logins,
            to_char(last_claimed_date, 'YYYY-MM-DD') AS last_claimed_date
     FROM public.daily_login_streaks
     WHERE user_id = $1
     LIMIT 1`,
    [user.id],
  );
  const streak = streakRows[0] as
    | {
        current_streak: number | null;
        longest_streak: number | null;
        total_logins: number | null;
        last_claimed_date: string | null;
      }
    | undefined;

  const today = karachiDay();
  const hasClaimedToday = streak?.last_claimed_date === today;
  const dailyXp = await activityXp("daily_login", 5);

  return ok({
    has_logged_in_today: hasClaimedToday,
    current_streak: streak?.current_streak ?? 0,
    longest_streak: streak?.longest_streak ?? 0,
    total_logins: streak?.total_logins ?? 0,
    can_claim: !hasClaimedToday,
    xp_earned_today: dailyXp,
    next_claim_at: hasClaimedToday
      ? new Date(
          new Date(today + "T00:00:00+05:00").getTime() + 24 * 60 * 60 * 1000,
        ).toISOString()
      : null,
  });
});

/**
 * POST /api/mobile/v1/gamification/daily-login - claim daily XP (auth).
 *
 * Awards via a `points_log` insert (the SECURITY DEFINER trigger updates
 * `profiles.points`). Concurrency-safe: an optimistic lock on the streak
 * row's `updated_at`, plus the DB's per-UTC-day dedupe trigger, both normalize
 * an already-claimed state to 409 `already_claimed_today`. Mirrors
 * `app/api/gamification/daily-login` (POST).
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request); // IP-keyed before auth (unauth-flood guard)
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const now = new Date();
  const today = karachiDay();

  // Ensure a streak row exists without racing on first-claim creation.
  try {
    await query(
      `INSERT INTO public.daily_login_streaks
         (user_id, current_streak, longest_streak, total_logins, last_login_date, streak_started_at, updated_at)
       VALUES ($1, 0, 0, 0, $2, $3, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, today, now.toISOString()],
    );
  } catch (upsertError) {
    console.error(
      "[mobile-api] streak init failed:",
      upsertError instanceof Error ? upsertError.message : upsertError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }

  let streak:
    | {
        current_streak: number | null;
        longest_streak: number | null;
        total_logins: number | null;
        last_login_date: string | null;
        last_claimed_date: string | null;
        streak_started_at: string | null;
        updated_at: string | null;
      }
    | undefined;
  try {
    const { rows } = await query(
      `SELECT current_streak, longest_streak, total_logins,
              to_char(last_login_date, 'YYYY-MM-DD') AS last_login_date,
              to_char(last_claimed_date, 'YYYY-MM-DD') AS last_claimed_date,
              streak_started_at, updated_at
       FROM public.daily_login_streaks
       WHERE user_id = $1
       LIMIT 1`,
      [user.id],
    );
    streak = rows[0];
  } catch (readError) {
    console.error(
      "[mobile-api] streak read failed:",
      readError instanceof Error ? readError.message : readError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }
  if (!streak) {
    console.error("[mobile-api] streak read failed: no row found");
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }

  if (streak.last_claimed_date === today) throw alreadyClaimed();

  // Streak math via Karachi date strings (no TZ ambiguity).
  const yesterday = new Date(today + "T00:00:00+05:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", {
    timeZone: "Asia/Karachi",
  });

  let newStreak = 1;
  let streakBroken = false;
  if (streak.last_login_date === yesterdayStr) {
    newStreak = (streak.current_streak ?? 0) + 1;
  } else if (streak.last_login_date === today) {
    // `|| 1` (not `??`): a fresh-upsert row has current_streak 0, which must
    // count as day 1, not 0.
    newStreak = streak.current_streak || 1;
  } else {
    newStreak = 1;
    streakBroken = true;
  }

  const earnedBonus = newStreak === 7;
  const dailyXp = await activityXp("daily_login", 5);
  const bonusXp = earnedBonus ? await activityXp("streak_7day", 20) : 0;

  // Optimistic lock on updated_at: a concurrent winner changes it -> 0 rows -> 409.
  let claimed: { user_id: string } | undefined;
  try {
    const { rows } = await query(
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
        Math.max(newStreak, streak.longest_streak ?? 0),
        (streak.total_logins ?? 0) + 1,
        today,
        streakBroken ? now.toISOString() : streak.streak_started_at,
        now.toISOString(),
        user.id,
        streak.updated_at,
      ],
    );
    claimed = rows[0];
  } catch (updateError) {
    console.error(
      "[mobile-api] streak claim update failed:",
      updateError instanceof Error ? updateError.message : updateError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to claim daily login.",
      500,
    );
  }
  if (!claimed) throw alreadyClaimed();

  try {
    const values: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    values.push(`($${idx++}, $${idx++}, $${idx++})`);
    params.push(user.id, dailyXp, "daily_login");
    if (earnedBonus) {
      values.push(`($${idx++}, $${idx++}, $${idx++})`);
      params.push(user.id, bonusXp, "streak_7day");
    }
    await query(
      `INSERT INTO public.points_log (user_id, points, reason) VALUES ${values.join(", ")}`,
      params,
    );
  } catch (logError) {
    // Roll back the claim so the user can retry; the DB per-UTC-day dedupe
    // raising 23505 means the day is genuinely already claimed (Karachi/UTC edge).
    try {
      await query(
        `UPDATE public.daily_login_streaks
         SET current_streak = $1,
             longest_streak = $2,
             total_logins = $3,
             last_login_date = $4,
             last_claimed_date = $5,
             streak_started_at = $6,
             updated_at = $7
         WHERE user_id = $8 AND last_claimed_date = $9`,
        [
          streak.current_streak ?? 0,
          streak.longest_streak ?? 0,
          streak.total_logins ?? 0,
          streak.last_login_date ?? null,
          streak.last_claimed_date,
          streak.streak_started_at ?? null,
          streak.updated_at ?? null,
          user.id,
          today,
        ],
      );
    } catch (rollbackError) {
      console.error("[mobile-api] streak claim rollback failed:", rollbackError);
    }

    const code = (logError as { code?: string })?.code;
    if (code === "23505") throw alreadyClaimed();
    console.error(
      "[mobile-api] points_log insert failed:",
      logError instanceof Error ? logError.message : logError,
    );
    throw new MobileApiError(
      "internal_error",
      "Failed to award daily login XP.",
      500,
    );
  }

  const { rows: profileRows } = await query(
    `SELECT points FROM public.profiles WHERE id = $1`,
    [user.id],
  );
  const newTotalXP = (profileRows[0]?.points as number) ?? 0;
  const newRank = await checkAndProcessRankUp(user.id, newTotalXP);

  return ok({
    xp_awarded: dailyXp + bonusXp,
    new_streak: newStreak,
    streak_bonus: earnedBonus
      ? { earned: true, xp_bonus: bonusXp, days_in_streak: 7 }
      : null,
    rank_up: !!newRank,
    new_rank: newRank ?? null,
  });
});
