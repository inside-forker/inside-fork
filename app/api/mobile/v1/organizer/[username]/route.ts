import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/v1/organizer/{username}  (public; auth optional)
 *
 * An organizer's public profile: safe profile fields (never email, role,
 * points, or any other private column) plus their published events (with
 * images), a total-attendees count, follower count, and (when the caller is
 * authenticated) whether they follow this organizer. Mirrors what
 * `OrganizerPublicProfile`/`EventCard` in the app expect.
 */
export const GET = mobileRoute(async (request: NextRequest, { params }) => {
  await enforceMobileRateLimit(request);
  const username = (await params).username;
  const { user } = await getOptionalMobileUser(request);

  if (!username || typeof username !== "string") {
    throw new MobileApiError("validation_error", "A username is required.", 400);
  }

  const { rows: profileRows } = await query(
    `SELECT id, full_name, username, avatar_url, organizer_bio, organizer_company,
            organizer_website, is_verified_organizer, phone
     FROM profiles
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [username],
  );
  const organizer = profileRows[0];
  if (!organizer) {
    throw new MobileApiError("not_found", "Organizer not found.", 404);
  }

  const { rows: eventRows } = await query(
    `SELECT id, name, slug, start_time, end_time, location_name
     FROM events
     WHERE organizer_id = $1 AND status = 'published'
     ORDER BY start_time DESC`,
    [organizer.id],
  );
  const eventIds = eventRows.map((e) => e.id);

  const imagesByEvent: Record<number, { url: string; is_primary: boolean }[]> = {};
  if (eventIds.length > 0) {
    const { rows: imageRows } = await query(
      `SELECT event_id, url, is_primary
       FROM event_images
       WHERE event_id = ANY($1::bigint[])
       ORDER BY display_order ASC`,
      [eventIds],
    );
    for (const img of imageRows) {
      const eventId = Number(img.event_id);
      (imagesByEvent[eventId] ??= []).push({
        url: img.url,
        is_primary: img.is_primary ?? false,
      });
    }
  }

  let totalAttendees = 0;
  if (eventIds.length > 0) {
    const { rows: attendeeRows } = await query(
      `SELECT COUNT(*) AS count
       FROM ticket_passes tp
       JOIN bookings b ON b.id = tp.booking_id
       WHERE b.event_id = ANY($1::bigint[]) AND b.payment_status = 'paid'`,
      [eventIds],
    );
    totalAttendees = parseInt(attendeeRows[0]?.count ?? "0", 10) || 0;
  }

  const { rows: followerRows } = await query(
    `SELECT COUNT(*) AS count FROM organizer_follows WHERE organizer_id = $1`,
    [organizer.id],
  );
  const followersCount = parseInt(followerRows[0]?.count ?? "0", 10) || 0;

  let isFollowing = false;
  if (user) {
    const { rows: followingRows } = await query(
      `SELECT 1 FROM organizer_follows WHERE follower_id = $1 AND organizer_id = $2 LIMIT 1`,
      [user.id, organizer.id],
    );
    isFollowing = followingRows.length > 0;
  }

  // Approval Rate stands in for the mockup's "Response Rate" - there's no
  // inquiry/messaging system to measure actual responsiveness from, so this
  // is deliberately a different (real) signal: how often this organizer's
  // submitted events/edits get approved by moderation vs. rejected, from
  // event_change_requests. Pending requests are excluded from both sides -
  // an undecided request shouldn't pad or drag the rate. Omitted entirely
  // (not 0%) when the organizer has no decided requests yet - a fabricated
  // 0% would read as "bad track record" for someone with no track record.
  const { rows: changeRequestRows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'approved') AS approved,
       COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) AS decided
     FROM event_change_requests
     WHERE organizer_id = $1`,
    [organizer.id],
  );
  const approved = parseInt(changeRequestRows[0]?.approved ?? "0", 10) || 0;
  const decided = parseInt(changeRequestRows[0]?.decided ?? "0", 10) || 0;
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : null;

  const events = eventRows.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    start_time: e.start_time,
    end_time: e.end_time,
    location_name: e.location_name,
    images: imagesByEvent[e.id] ?? [],
  }));

  return ok({
    organizer: {
      id: organizer.id,
      full_name: organizer.full_name,
      username: organizer.username,
      avatar_url: organizer.avatar_url,
      organizer_bio: organizer.organizer_bio,
      organizer_company: organizer.organizer_company,
      organizer_website: organizer.organizer_website,
      is_verified_organizer: organizer.is_verified_organizer,
      phone: organizer.phone,
    },
    events,
    total_attendees: totalAttendees,
    followers_count: followersCount,
    is_following: isFollowing,
    ...(approvalRate != null ? { approval_rate: approvalRate } : {}),
  });
});
