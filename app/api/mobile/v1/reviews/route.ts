import { type NextRequest } from "next/server";
import { z } from "zod";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { getOptionalMobileUser, requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { MobileApiError } from "@/lib/mobile/errors";
import { query } from "@/lib/db";
import { toReview, type ReviewRowLike } from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["lister", "admin", "super_admin"];

const REVIEW_SQL_COLUMNS =
  "r.id, r.listing_id, r.branch_id, r.user_id, r.rating, r.comment, r.status, r.helpful_count, " +
  "to_json(r.created_at) #>> '{}' AS created_at, " +
  "to_json(r.updated_at) #>> '{}' AS updated_at, " +
  "CASE WHEN p.id IS NOT NULL " +
  "THEN json_build_object('username', CASE WHEN p.deleted_at IS NOT NULL THEN 'Insider' ELSE p.username END, 'avatar_url', p.avatar_url) " +
  "ELSE NULL END AS profiles";

const REVIEW_FROM_JOIN = "FROM reviews r LEFT JOIN profiles p ON p.id = r.user_id";

function toNumericReviewRow(row: Record<string, unknown>): ReviewRowLike {
  return {
    ...row,
    id: Number(row.id),
    listing_id: row.listing_id !== null ? Number(row.listing_id) : null,
    branch_id: row.branch_id !== null ? Number(row.branch_id) : null,
  } as unknown as ReviewRowLike;
}

/**
 * GET /api/mobile/v1/reviews?listing_id=&page=&limit=
 *
 * Approved reviews for a listing, paginated, each with a `comment_count` of its
 * approved comments. Admins/listers see all statuses. Mirrors `app/api/reviews`
 * (GET), normalized into the mobile envelope; reviewer auth UUIDs are never
 * exposed (only `is_own` + author handle).
 */
export const GET = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);

  const { searchParams } = new URL(request.url);
  const listingId = parseInt(searchParams.get("listing_id") ?? "", 10);
  if (Number.isNaN(listingId)) {
    throw new MobileApiError(
      "validation_error",
      "listing_id is required.",
      400,
      "listing_id",
    );
  }
  const { page, limit, offset } = parsePagination(searchParams, {
    defaultLimit: 10,
    maxLimit: 50,
  });

  const { user } = await getOptionalMobileUser(request);
  const currentUserId = user?.id ?? null;

  // Staff may see non-approved reviews; everyone else sees approved only.
  let isStaff = false;
  if (currentUserId) {
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [currentUserId],
    );
    const role = profileRows[0]?.role;
    isStaff = role != null && STAFF_ROLES.includes(role);
  }

  // Hide reviews from users the caller has blocked. The blocked-clause
  // placeholder index differs between the two queries below (they don't
  // share a param list), so each builds its own WHERE + params.
  const blockedClause = (paramIndex: number) =>
    `NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE bu.blocker_id = $${paramIndex} AND bu.blocked_id = r.user_id)`;

  const rowsWhereClauses = ["r.listing_id = $1"];
  if (!isStaff) rowsWhereClauses.push("r.status = 'approved'");
  const rowsParams: unknown[] = [listingId, limit, offset];
  if (currentUserId) {
    rowsParams.push(currentUserId);
    rowsWhereClauses.push(blockedClause(rowsParams.length));
  }
  const rowsWhereSql = rowsWhereClauses.join(" AND ");

  const countWhereClauses = ["r.listing_id = $1"];
  if (!isStaff) countWhereClauses.push("r.status = 'approved'");
  const countParams: unknown[] = [listingId];
  if (currentUserId) {
    countParams.push(currentUserId);
    countWhereClauses.push(blockedClause(countParams.length));
  }
  const countWhereSql = countWhereClauses.join(" AND ");

  let rows: Record<string, unknown>[];
  let total: number;
  try {
    const [rowsRes, countRes] = await Promise.all([
      query(
        `SELECT ${REVIEW_SQL_COLUMNS} ${REVIEW_FROM_JOIN}
         WHERE ${rowsWhereSql}
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        rowsParams,
      ),
      query(
        `SELECT COUNT(*) FROM reviews r WHERE ${countWhereSql}`,
        countParams,
      ),
    ]);
    rows = rowsRes.rows;
    total = Number(countRes.rows[0]?.count ?? 0);
  } catch (error) {
    console.error("[mobile-api] reviews query failed:", error);
    throw new MobileApiError("internal_error", "Failed to load reviews.", 500);
  }

  const reviewRows = rows.map(toNumericReviewRow);
  const reviewIds = reviewRows.map((r) => r.id);

  // Approved-comment counts for the returned reviews.
  const commentCounts: Record<number, number> = {};
  if (reviewIds.length > 0) {
    const { rows: commentRows } = await query(
      `SELECT review_id FROM review_comments WHERE review_id = ANY($1::bigint[]) AND status = 'approved'`,
      [reviewIds],
    );
    for (const c of commentRows) {
      const rid = Number(c.review_id);
      commentCounts[rid] = (commentCounts[rid] ?? 0) + 1;
    }
  }

  const reviews = reviewRows.map((r) => ({
    ...toReview(r, currentUserId),
    comment_count: commentCounts[r.id] ?? 0,
  }));

  return ok(reviews, {
    pagination: buildPaginationMeta(page, limit, total),
  });
});

const createReviewSchema = z.object({
  listing_id: z.number().int().positive(),
  branch_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500).trim(),
});

/**
 * POST /api/mobile/v1/reviews
 *
 * Create a review (-> `pending` moderation). Staff who manage the listing are
 * blocked (`conflict_of_interest`, 403). Mirrors `app/api/reviews` (POST). New
 * reviews are invisible in lists until approved - the app should show an
 * optimistic "pending review" state.
 */
export const POST = mobileRoute(async (request: NextRequest) => {
  await enforceMobileRateLimit(request);
  const { user } = await requireMobileUser(request);

  const parsed = createReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MobileApiError(
      "validation_error",
      first?.message ?? "Invalid review.",
      400,
      first?.path.join("."),
    );
  }
  const { listing_id, branch_id, rating, comment } = parsed.data;

  // Listing must exist and be published.
  const { rows: listingRows } = await query(
    `SELECT id FROM listings_with_details WHERE id = $1 AND status = 'published'`,
    [listing_id],
  );
  if (!listingRows[0]) {
    throw new MobileApiError(
      "not_found",
      "Listing not found or not available for reviews.",
      404,
    );
  }

  // Branch must belong to the listing.
  const { rows: branchRows } = await query(
    `SELECT id FROM listing_branches WHERE id = $1 AND listing_id = $2`,
    [branch_id, listing_id],
  );
  if (!branchRows[0]) {
    throw new MobileApiError(
      "not_found",
      "Branch not found for this listing.",
      404,
      "branch_id",
    );
  }

  // Staff cannot review listings they manage (conflict of interest).
  // Replicated directly from user_manages_listing(): that function's own
  // `p_user_id IS DISTINCT FROM auth.uid()` self-check always fails over a
  // direct pg connection (auth.uid() is never set), so it can't be called as-is.
  const { rows: roleRows } = await query(
    `SELECT role FROM profiles WHERE id = $1`,
    [user.id],
  );
  const userRole = roleRows[0]?.role;
  const { rows: ownsRows } = await query(
    `SELECT EXISTS(SELECT 1 FROM listings WHERE id = $1 AND owner_id = $2) AS owns`,
    [listing_id, user.id],
  );
  const managesListing =
    ownsRows[0]?.owns === true ||
    userRole === "admin" ||
    userRole === "super_admin" ||
    userRole === "lister";
  if (managesListing) {
    throw new MobileApiError(
      "conflict_of_interest",
      "Staff members cannot review listings they manage.",
      403,
    );
  }

  // Auto-flag suspicious patterns (does not block submission). Replicated
  // directly from check_suspicious_review_pattern() (same reason above).
  let isFlagged = false;
  try {
    const { rows: patternRows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS reviews_last_24h,
         COUNT(*) AS total_reviews
       FROM reviews WHERE user_id = $1 AND branch_id = $2`,
      [user.id, branch_id],
    );
    const reviewsLast24h = parseInt(patternRows[0].reviews_last_24h, 10);
    const totalReviews = parseInt(patternRows[0].total_reviews, 10);
    isFlagged = reviewsLast24h >= 3 || totalReviews >= 10;
  } catch (error) {
    console.error("[mobile-api] suspicious pattern check failed:", error);
  }

  let created: ReviewRowLike;
  try {
    const { rows } = await query(
      `WITH inserted AS (
         INSERT INTO reviews (listing_id, branch_id, user_id, rating, comment, status, is_flagged_suspicious, created_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW())
         RETURNING *
       )
       SELECT ${REVIEW_SQL_COLUMNS}
       FROM inserted r
       LEFT JOIN profiles p ON p.id = r.user_id`,
      [listing_id, branch_id, user.id, rating, comment, isFlagged],
    );
    created = toNumericReviewRow(rows[0]);
  } catch (error) {
    console.error("[mobile-api] review insert failed:", error);
    throw new MobileApiError("internal_error", "Failed to create review.", 500);
  }

  return ok(
    {
      ...toReview(created, user.id),
      comment_count: 0,
    },
    undefined,
    { status: 201 },
  );
});
