import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import {
  applyLeaveReviewXpForModeration,
  leaveReviewListingKey,
} from "@/lib/reviews/moderation-xp";
import { notifyReviewStatus } from "@/lib/reviews/notifications";

const ROUTE = "/api/admin/reviews/bulk-moderate";
const MAX_BULK_REVIEWS = 100;
const MODERATION_STATUSES = new Set([
  "approved",
  "rejected",
  "pending",
  "flagged",
]);

function parseReviewIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const parsed = raw
    .map((id) => parseInt(String(id), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(parsed)];
}

export async function POST(request: NextRequest) {
  try {    const session = await getSessionFromCookies();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const { rows: profileRows } = await query(
      "SELECT role FROM public.profiles WHERE id = $1 LIMIT 1",
      [session.userId],
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "super_admin" &&
      profile.role !== "lister"
    ) {
      return NextResponse.json(
        { success: false, error: "Admin or lister access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { reviewIds, status, reason } = body;

    const parsedIds = parseReviewIds(reviewIds);
    if (parsedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Valid review IDs are required" },
        { status: 400 },
      );
    }

    if (parsedIds.length > MAX_BULK_REVIEWS) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot moderate more than ${MAX_BULK_REVIEWS} reviews at once`,
        },
        { status: 400 },
      );
    }

    if (!status || !MODERATION_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    let reviews: { id: number; listing_id: number; user_id: string }[];
    try {
      const { rows } = await query(
        "SELECT id, listing_id, user_id FROM public.reviews WHERE id = ANY($1::bigint[])",
        [parsedIds],
      );
      reviews = rows as { id: number; listing_id: number; user_id: string }[];
    } catch (fetchError) {
      captureRouteError(fetchError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to load reviews" },
        { status: 500 },
      );
    }

    if (!reviews.length) {
      return NextResponse.json(
        { success: false, error: "No matching reviews found" },
        { status: 404 },
      );
    }

    const moderatedAt = new Date().toISOString();
    const idsToUpdate = reviews.map((r) => r.id);

    let updatedCount = 0;
    try {
      const { rows: updatedRows } = await query(
        `UPDATE public.reviews
         SET status = $1, moderated_by = $2, moderated_at = $3
         WHERE id = ANY($4::bigint[])
         RETURNING id`,
        [status, session.userId, moderatedAt, idsToUpdate],
      );
      updatedCount = updatedRows.length;
    } catch (reviewError) {
      console.error("Bulk database update error:", reviewError);
      captureRouteError(reviewError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to update review statuses" },
        { status: 500 },
      );
    }

    const awardedListingKeys = new Set<string>();

    for (const review of reviews) {
      if (status === "approved") {
        const key = leaveReviewListingKey(review.user_id, review.listing_id);
        if (awardedListingKeys.has(key)) {
          continue;
        }
        awardedListingKeys.add(key);
      }

      await applyLeaveReviewXpForModeration(
        {
          reviewId: review.id,
          userId: review.user_id,
          listingId: review.listing_id,
        },
        status,
      );

      if (status === "approved" || status === "rejected") {
        try {
          await notifyReviewStatus({
            review: {
              reviewId: review.id,
              userId: review.user_id,
              listingId: review.listing_id,
            },
            status,
          });
        } catch (notifyError) {
          console.error("Failed to notify reviewer of moderation outcome:", notifyError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} reviews ${status} successfully`,
      data: {
        review_ids: idsToUpdate,
        status,
        reason,
        moderated_by: session.userId,
        moderated_at: moderatedAt,
        count: updatedCount,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/reviews/bulk-moderate error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Failed to moderate reviews" },
      { status: 500 },
    );
  }
}
