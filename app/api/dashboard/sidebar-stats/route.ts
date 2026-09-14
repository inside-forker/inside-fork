import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/dashboard/sidebar-stats
 * Returns role-based statistics for the sidebar
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile and role
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    const role = profile?.role;

    // Admin or Super Admin: Get system-wide stats
    if (role === "admin" || role === "super_admin") {
      const [usersResult, eventsResult, listingsResult] = await Promise.all([
        query(`SELECT COUNT(*) FROM profiles`),
        query(`SELECT COUNT(*) FROM events`),
        query(`SELECT COUNT(*) FROM listings`),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          users: parseInt(usersResult.rows[0].count, 10) || 0,
          events: parseInt(eventsResult.rows[0].count, 10) || 0,
          listings: parseInt(listingsResult.rows[0].count, 10) || 0,
        },
      });
    }

    // Lister: Get content stats
    if (role === "lister") {
      const [listingsResult, eventsResult, reviewsResult] = await Promise.all([
        query(`SELECT COUNT(*) FROM listings`),
        query(`SELECT COUNT(*) FROM events`),
        query(`SELECT COUNT(*) FROM reviews`),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          listings: parseInt(listingsResult.rows[0].count, 10) || 0,
          events: parseInt(eventsResult.rows[0].count, 10) || 0,
          reviews: parseInt(reviewsResult.rows[0].count, 10) || 0,
        },
      });
    }

    // Organizer: Get organizer-specific stats
    if (role === "organizer") {
      const [eventsResult, bookingsResult, ticketsResult] = await Promise.all([
        query(`SELECT COUNT(*) FROM events WHERE organizer_id = $1`, [
          session.userId,
        ]),
        query(`SELECT COUNT(*) FROM bookings WHERE user_id = $1`, [
          session.userId,
        ]),
        query(
          `SELECT COUNT(*) FROM ticket_passes tp
           JOIN bookings b ON b.id = tp.booking_id
           WHERE b.user_id = $1`,
          [session.userId],
        ),
      ]);

      return NextResponse.json({
        success: true,
        role: role,
        stats: {
          events: parseInt(eventsResult.rows[0].count, 10) || 0,
          bookings: parseInt(bookingsResult.rows[0].count, 10) || 0,
          tickets: parseInt(ticketsResult.rows[0].count, 10) || 0,
        },
      });
    }

    // Regular User: Get personal stats
    const [reviewsResult, bookingsResult, favoritesResult] = await Promise.all([
      query(`SELECT COUNT(*) FROM reviews WHERE user_id = $1`, [
        session.userId,
      ]),
      query(`SELECT COUNT(*) FROM bookings WHERE user_id = $1`, [
        session.userId,
      ]),
      query(
        `SELECT COUNT(*) FROM favorite_listings fl
         JOIN listings_with_details l ON l.id = fl.listing_id AND l.status = 'published'
         WHERE fl.user_id = $1`,
        [session.userId],
      ),
    ]);

    return NextResponse.json({
      success: true,
      role: role || "user",
      stats: {
        reviews: parseInt(reviewsResult.rows[0].count, 10) || 0,
        bookings: parseInt(bookingsResult.rows[0].count, 10) || 0,
        favorites: parseInt(favoritesResult.rows[0].count, 10) || 0,
      },
    });
  } catch (error) {
    console.error("Sidebar stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sidebar stats" },
      { status: 500 },
    );
  }
}
