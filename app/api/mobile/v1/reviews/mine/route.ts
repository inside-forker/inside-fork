import { type NextRequest } from "next/server";
import { mobileRoute } from "@/lib/mobile/handler";
import { ok } from "@/lib/mobile/response";
import { requireMobileUser } from "@/lib/mobile/auth";
import { enforceMobileRateLimit } from "@/lib/mobile/rate-limit";
import { parsePagination, buildPaginationMeta } from "@/lib/mobile/pagination";
import { query } from "@/lib/db";
import { toReview, type ReviewRowLike } from "@/lib/mobile/mappers";

export const dynamic = "force-dynamic";

const REVIEW_SQL_COLUMNS =
  "r.id, r.listing_id, r.branch_id, r.user_id, r.rating, r.comment, r.status, r.helpful_count, " +
  "to_json(r.created_at) #>> '{}' AS created_at, " +
  "to_json(r.updated_at) #>> '{}' AS updated_at, " +
  "CASE WHEN p.id IS NOT NULL " +
  "THEN json_build_object('username', CASE WHEN p.deleted_at IS NOT NULL THEN 'Insider' ELSE p.username END, 'avatar_url', p.avatar_url) " +
  "ELSE NULL END AS profiles, " +
  "l.name AS listing_name, l.slug AS listing_slug, l.address AS listing_address, " +
  "(SELECT li.url FROM listing_images li WHERE li.listing_id = l.id " +
  " ORDER BY li.is_primary DESC NULLS LAST, li.display_order ASC LIMIT 1) AS listing_image_url";

function toNumericReviewRow(row: Record<string, unknown>): ReviewRowLike {
  return {
    ...row,
    id: Number(row.id),
    listing_id: row.listing_id !== null ? Number(row.listing_id) : null,
    branch_id: row.branch_id !== null ? Number(row.branch_id) : null,
  } as unknown as ReviewRowLike;
}

/**
 * GET /api/mobile/v1/reviews/mine?page=&limit=
 *
 * The caller's own reviews across every listing (all statuses - the author
 * can see their own pending/rejected reviews), newest first, with the
 * listing's name/slug joined on so the app can render a "My Reviews" list
 * without a listing_id per row like GET /reviews requires.
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

  const [rowsRes, countRes] = await Promise.all([
    query(
      `SELECT ${REVIEW_SQL_COLUMNS}
       FROM reviews r
       LEFT JOIN profiles p ON p.id = r.user_id
       LEFT JOIN listings_with_details l ON l.id = r.listing_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset],
    ),
    query(`SELECT COUNT(*) FROM reviews WHERE user_id = $1`, [user.id]),
  ]);

  const reviews = rowsRes.rows.map((row) => ({
    ...toReview(toNumericReviewRow(row), user.id),
    listing_name: row.listing_name ?? null,
    listing_slug: row.listing_slug ?? null,
    listing_address: row.listing_address ?? null,
    listing_image_url: row.listing_image_url ?? null,
  }));

  return ok(reviews, {
    pagination: buildPaginationMeta(page, limit, Number(countRes.rows[0]?.count ?? 0)),
  });
});
