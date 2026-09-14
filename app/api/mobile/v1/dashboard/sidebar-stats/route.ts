import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Role-aware sidebar counters. admin/super_admin -> platform totals;
// lister -> global content counts; organizer -> own events/bookings/tickets;
// everyone else -> own reviews/bookings/favorites.
export const GET = mobileRoute(async (request: NextRequest) => {
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { rows: profileRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [user.id],
  );
  const role = profileRows[0]?.role ?? null;

  // Every counter below is fetched as scalar subqueries in ONE statement.
  //
  // These used to be separate `query()` calls inside a `Promise.all`, which
  // looked parallel but is actively harmful here: the production pool is
  // capped at `max: 1` connection per serverless instance (see lib/db.ts), so
  // the calls can't overlap - they queue on the single connection, and every
  // queued call is racing `connectionTimeoutMillis` (10s) while it waits. The
  // six-query user branch was the worst case: under any slowness the tail
  // queries timed out acquiring a connection, which surfaced to the app as a
  // 500 and left Bookings/Favorites/Reviews blank while other screens loaded
  // fine. One statement = one connection acquisition = nothing to queue.
  const num = (v: unknown): number => Number(v) || 0;

  if (role === "admin" || role === "super_admin") {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*) FROM profiles) AS users,
         (SELECT COUNT(*) FROM events) AS events,
         (SELECT COUNT(*) FROM listings) AS listings`,
    );
    return ok({
      role,
      stats: {
        users: num(rows[0]?.users),
        events: num(rows[0]?.events),
        listings: num(rows[0]?.listings),
      },
    });
  }

  if (role === "lister") {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*) FROM listings) AS listings,
         (SELECT COUNT(*) FROM events) AS events,
         (SELECT COUNT(*) FROM reviews) AS reviews`,
    );
    return ok({
      role,
      stats: {
        listings: num(rows[0]?.listings),
        events: num(rows[0]?.events),
        reviews: num(rows[0]?.reviews),
      },
    });
  }

  if (role === "organizer") {
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*) FROM events WHERE organizer_id = $1) AS events,
         (SELECT COUNT(*) FROM bookings WHERE user_id = $1) AS bookings,
         (SELECT COUNT(*) FROM ticket_passes tp
            JOIN bookings b ON b.id = tp.booking_id
            WHERE b.user_id = $1) AS tickets`,
      [user.id],
    );
    return ok({
      role,
      stats: {
        events: num(rows[0]?.events),
        bookings: num(rows[0]?.bookings),
        tickets: num(rows[0]?.tickets),
      },
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM reviews WHERE user_id = $1) AS reviews,
       (SELECT COUNT(*) FROM bookings WHERE user_id = $1) AS bookings,
       (SELECT COUNT(*) FROM favorite_listings fl
          JOIN listings_with_details l ON l.id = fl.listing_id AND l.status = 'published'
          WHERE fl.user_id = $1) AS favorites,
       -- "Visits" on the profile screen: every place the user has physically
       -- turned up at. Check-ins are not their own table - they land in
       -- points_log under the two check-in XP slugs, the same pair the
       -- activity feed maps to its checkin rows.
       (SELECT COUNT(*) FROM points_log
          WHERE user_id = $1 AND reason IN ('check_in', 'visit_location')) AS visits,
       (SELECT COALESCE(SUM(points), 0) FROM points_log
          WHERE user_id = $1 AND created_at >= $2) AS weekly_xp,
       (SELECT COUNT(*) FROM bookings
          WHERE user_id = $1 AND payment_status = 'paid' AND created_at >= $2) AS weekly_bookings,
       (SELECT COUNT(*) FROM reviews
          WHERE user_id = $1 AND created_at >= $2) AS weekly_reviews`,
    [user.id, sevenDaysAgo],
  );
  return ok({
    role: role ?? "user",
    stats: {
      reviews: num(rows[0]?.reviews),
      bookings: num(rows[0]?.bookings),
      favorites: num(rows[0]?.favorites),
      visits: num(rows[0]?.visits),
    },
    weekly: {
      xp_earned: num(rows[0]?.weekly_xp),
      events_attended: num(rows[0]?.weekly_bookings),
      reviews_written: num(rows[0]?.weekly_reviews),
    },
  });
});
