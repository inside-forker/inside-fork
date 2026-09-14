import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { getFriendlyActivityName } from "@/lib/gamification";

export const dynamic = "force-dynamic";

/**
 * One entry in the app's Activity feed. Shape is fixed by the RN client
 * (`ActivityFeedItem` in insidekhi-reactnative/src/types/api.ts) — keep in sync.
 */
type ActivityFeedType =
  | "booking"
  | "checkin"
  | "review"
  | "review_helpful"
  | "favourite"
  | "badge"
  | "rank_up"
  | "streak"
  | "deal"
  | "referral"
  | "xp";

type ActivityFeedItem = {
  id: string;
  type: ActivityFeedType;
  title: string;
  subtitle: string | null;
  href: string | null;
  xp: number | null;
  occurred_at: string;
  /** Listing/event thumbnail for rows that resolve to one — favourites, a
   * booked event, and points_log rows tied to a listing (leave_review,
   * react_review, comment_review, and a listing QR scan). null for kinds with
   * no photo to show (badges, rank-ups, daily logins) — the client falls back
   * to its type icon there. */
  image_url: string | null;
};

/**
 * A row from the UNION feed query. `kind` is the discriminator: every branch
 * emits the same columns, most of them null outside the one branch that fills
 * them (see FEED_UNION_SQL).
 */
type FeedRow = {
  id: string;
  kind: "xp" | "favourite" | "booking" | "badge" | "rank_up";
  reason: string | null;
  points: string | number | null;
  /** Entity name — listing / event / badge / rank, by kind. */
  name: string | null;
  /** Listing slug for the `/listing/{slug}` tap target (xp + favourite). */
  slug: string | null;
  /** Secondary line — currently the badge description. */
  detail: string | null;
  /** `xp_activities.activity_name` (xp kind only). */
  activity_name: string | null;
  image_url: string | null;
  occurred_at: string;
  total_count?: string | number;
};

/**
 * Per-slug feed metadata for `points_log` rows. `title` overrides the joined
 * `activity_name` where a warmer sentence reads better; anything not listed
 * falls back to that name (and then to `getFriendlyActivityName`) with a
 * generic `xp` type.
 *
 * Slugs are the `xp_activities.activity_slug` values passed to `awardXP()` —
 * grep `awardXP(` in this repo before adding one.
 */
const SLUG_META: Record<
  string,
  { type: ActivityFeedType; title?: string; withName?: (name: string) => string }
> = {
  leave_review: {
    type: "review",
    title: "Wrote a review",
    withName: (name) => `Reviewed ${name}`,
  },
  react_review: {
    type: "review_helpful",
    title: "Reacted to a review",
    withName: (name) => `Reacted to a review of ${name}`,
  },
  comment_review: {
    type: "review",
    title: "Commented on a review",
    withName: (name) => `Commented on a review of ${name}`,
  },
  check_in: {
    type: "checkin",
    title: "Checked in",
    withName: (name) => `Checked in at ${name}`,
  },
  visit_location: {
    type: "checkin",
    title: "Visited a location",
    withName: (name) => `Visited ${name}`,
  },
  attend_event: { type: "booking", title: "Attended an event" },
  daily_login: { type: "streak", title: "Claimed a daily login reward" },
  refer_friend: { type: "referral", title: "Referred a friend" },
  share_listing: { type: "xp", title: "Shared a listing" },
  suggest_place: { type: "xp", title: "Suggested a place" },
  report_info: { type: "xp", title: "Reported a listing update" },
  profile_complete: { type: "xp", title: "Completed your profile" },
};

/**
 * Fallback tap target per type, used when a `points_log` row can't resolve a
 * more specific destination (e.g. a listing). Routes must exist in the RN app's
 * router. `null` types render as non-tappable rows.
 */
const HREF_BY_TYPE: Record<ActivityFeedType, string | null> = {
  booking: "/dashboard/bookings",
  checkin: null,
  review: "/dashboard/reviews",
  review_helpful: "/dashboard/reviews",
  favourite: "/dashboard/favorites",
  badge: "/dashboard/achievements",
  rank_up: "/leaderboard",
  streak: "/dashboard/achievements",
  deal: null,
  referral: null,
  xp: null,
};

const PROFILE_SLUGS = new Set(["profile_complete"]);

/**
 * The feed is a UNION ALL over every per-user history source, newest first.
 * All branches take `$1 = user_id`; the outer query adds the window count and
 * `$2 = limit` / `$3 = offset`. Kept as one statement because the production
 * pool is capped at one connection per instance (see lib/db.ts) — parallel
 * `query()` calls queue on the sole connection and race the connect timeout.
 *
 * `related_id` semantics on `points_log` (integers, set by `awardXP()`):
 *   - `leave_review` → a `listings.id`
 *   - `react_review` → a `reviews.id` (→ its `listing_id`)
 *   - `comment_review` → a `review_comments.id` (→ its review's `listing_id`)
 *   - `visit_location` → a `qr_codes.id` (→ its `related_id` when the code is
 *     a listing code; listing QR codes store 0 when no listing was picked)
 * Other slugs leave the listing columns null and fall back to `HREF_BY_TYPE`.
 */
const FEED_UNION_SQL = `
  SELECT
    'points_log:' || pl.id                          AS id,
    'xp'                                            AS kind,
    pl.reason                                       AS reason,
    pl.points                                       AS points,
    COALESCE(lrev.name, lreact.name,
             lcmt.name, lqr.name)                   AS name,
    COALESCE(lrev.slug, lreact.slug,
             lcmt.slug, lqr.slug)                   AS slug,
    NULL::text                                      AS detail,
    (SELECT xa.activity_name FROM public.xp_activities xa
      WHERE xa.activity_slug = pl.reason LIMIT 1)   AS activity_name,
    (SELECT li.url FROM public.listing_images li
      WHERE li.listing_id = COALESCE(lrev.id, lreact.id, lcmt.id, lqr.id)
      ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC
      LIMIT 1)                                      AS image_url,
    pl.created_at                                   AS occurred_at
  FROM public.points_log pl
  LEFT JOIN public.listings lrev
         ON pl.reason = 'leave_review' AND lrev.id = pl.related_id
  LEFT JOIN public.reviews rv
         ON pl.reason = 'react_review' AND rv.id = pl.related_id
  LEFT JOIN public.listings lreact
         ON lreact.id = rv.listing_id
  LEFT JOIN public.review_comments rc
         ON pl.reason = 'comment_review' AND rc.id = pl.related_id
  LEFT JOIN public.reviews rvc
         ON rvc.id = rc.review_id
  LEFT JOIN public.listings lcmt
         ON lcmt.id = rvc.listing_id
  LEFT JOIN public.qr_codes qr
         ON pl.reason = 'visit_location' AND qr.id = pl.related_id
        AND qr.qr_type = 'listing' AND qr.related_id > 0
  LEFT JOIN public.listings lqr
         ON lqr.id = qr.related_id
  WHERE pl.user_id = $1

  UNION ALL

  SELECT
    'favorite:' || fl.listing_id, 'favourite',
    NULL::text, NULL::numeric,
    l.name, l.slug, NULL::text, NULL::text,
    (SELECT li.url FROM public.listing_images li
      WHERE li.listing_id = l.id
      ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC
      LIMIT 1),
    fl.created_at
  FROM public.favorite_listings fl
  JOIN public.listings l ON l.id = fl.listing_id
  WHERE fl.user_id = $1

  UNION ALL

  SELECT
    'booking:' || b.id, 'booking',
    NULL::text, NULL::numeric,
    e.name, NULL::text, NULL::text, NULL::text,
    (SELECT ei.url FROM public.event_images ei
      WHERE ei.event_id = e.id
      ORDER BY ei.display_order ASC
      LIMIT 1),
    b.created_at
  FROM public.bookings b
  LEFT JOIN public.events e ON e.id = b.event_id
  WHERE b.user_id = $1 AND b.status IN ('confirmed', 'completed')

  UNION ALL

  SELECT
    'badge:' || ub.badge_id, 'badge',
    NULL::text, NULL::numeric,
    bd.name, NULL::text, bd.description, NULL::text,
    NULL::text,
    ub.awarded_at
  FROM public.user_badges ub
  JOIN public.badges bd ON bd.id = ub.badge_id
  WHERE ub.user_id = $1

  UNION ALL

  SELECT
    'rank:' || ur.id, 'rank_up',
    NULL::text, NULL::numeric,
    rk.name, NULL::text, NULL::text, NULL::text,
    NULL::text,
    ur.achieved_at
  FROM public.user_ranks ur
  JOIN public.ranks rk ON rk.id = ur.rank_id
  WHERE ur.user_id = $1 AND rk.min_xp_required > 0
`;

function xpItem(row: FeedRow): ActivityFeedItem {
  const slug = row.reason ?? "";
  const meta = SLUG_META[slug];
  const type = meta?.type ?? "xp";
  const points = Number(row.points);

  // A resolved listing folds into the headline ("Visited Café Flo"), so the
  // subtitle that used to carry the name would only repeat it.
  const named = row.name && meta?.withName ? meta.withName(row.name) : null;
  const title = named ?? meta?.title ?? row.activity_name ?? getFriendlyActivityName(slug);

  // A resolved listing gives us both the warmer subtitle and a real tap target;
  // otherwise fall back to the per-type destination.
  const listingHref = row.slug ? `/listing/${row.slug}` : null;
  const href =
    listingHref ?? (PROFILE_SLUGS.has(slug) ? "/profile" : HREF_BY_TYPE[type]);

  return {
    id: row.id,
    type,
    title,
    subtitle: named ? null : (row.name ?? null),
    href,
    // Only surface positive awards — the client renders this as a "+N" pill, and
    // negative rows (moderation clawbacks) shouldn't read as an achievement.
    xp: Number.isFinite(points) && points > 0 ? points : null,
    occurred_at: row.occurred_at,
    image_url: row.image_url ?? null,
  };
}

function toItem(row: FeedRow): ActivityFeedItem {
  switch (row.kind) {
    case "favourite":
      return {
        id: row.id,
        type: "favourite",
        title: row.name ? `Saved ${row.name}` : "Saved a place",
        subtitle: null,
        href: row.slug ? `/listing/${row.slug}` : "/dashboard/favorites",
        xp: null,
        occurred_at: row.occurred_at,
        image_url: row.image_url ?? null,
      };
    case "booking":
      return {
        id: row.id,
        type: "booking",
        title: row.name ? `Booked ${row.name}` : "Booked an event",
        subtitle: null,
        href: "/dashboard/bookings",
        xp: null,
        occurred_at: row.occurred_at,
        image_url: row.image_url ?? null,
      };
    case "badge":
      return {
        id: row.id,
        type: "badge",
        title: row.name ? `Earned the ${row.name} badge` : "Earned a badge",
        subtitle: row.detail ?? null,
        href: "/dashboard/achievements",
        xp: null,
        occurred_at: row.occurred_at,
        image_url: null,
      };
    case "rank_up":
      return {
        id: row.id,
        type: "rank_up",
        title: row.name ? `Reached ${row.name}` : "Ranked up",
        subtitle: null,
        href: "/leaderboard",
        xp: null,
        occurred_at: row.occurred_at,
        image_url: null,
      };
    default:
      return xpItem(row);
  }
}

/**
 * GET /api/mobile/v1/activity?page=&limit=
 *
 * The caller's own activity feed, newest first — a UNION over `points_log`
 * (XP-annotated logins / reviews / check-ins / shares / referrals / …),
 * favourited listings, confirmed bookings, earned badges and rank-ups. See
 * FEED_UNION_SQL for the per-source projection and the one-connection rationale.
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);
  await enforceMobileRateLimit(request, user.id);

  const { searchParams } = new URL(request.url);
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 20,
    maxLimit: 50,
  });

  let rows: FeedRow[];
  try {
    const res = await query(
      `SELECT feed.id, feed.kind, feed.reason, feed.points, feed.name,
              feed.slug, feed.detail, feed.activity_name, feed.image_url,
              to_json(feed.occurred_at) #>> '{}' AS occurred_at,
              COUNT(*) OVER () AS total_count
       FROM (${FEED_UNION_SQL}) feed
       ORDER BY feed.occurred_at DESC, feed.id DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset],
    );
    rows = res.rows as FeedRow[];
  } catch (error) {
    console.error(
      "[mobile-api] activity feed query failed:",
      error instanceof Error ? error.message : error,
    );
    throw new MobileApiError("internal_error", "Failed to load your activity.", 500);
  }

  // `COUNT(*) OVER ()` only rides along on returned rows, so an empty page (no
  // history, or an offset past the end) needs its own total lookup.
  let total: number;
  if (rows.length > 0) {
    total = Number(rows[0].total_count ?? 0);
  } else {
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM (${FEED_UNION_SQL}) feed`,
      [user.id],
    );
    total = Number(countRows[0]?.count ?? 0);
  }

  return ok(rows.map(toItem), {
    pagination: buildPaginationMeta(page, limit, total),
  });
});
