import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { applyLeaveReviewXpForModeration } from "@/lib/reviews/moderation-xp";
import { notifyReviewStatus } from "@/lib/reviews/notifications";

const ROUTE = "/api/admin/reviews/[id]/moderate";

const MODERATION_STATUSES = new Set([
  "approved",
  "rejected",
  "pending",
  "flagged",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;    const session = await getSessionFromCookies();

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

    const reviewId = parseInt(id, 10);
    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid review ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { status, reason } = body;

    if (!status || !MODERATION_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    const { rows: reviewRows } = await query(
      "SELECT listing_id, user_id FROM public.reviews WHERE id = $1 LIMIT 1",
      [reviewId],
    );
    const reviewData = reviewRows[0] as
      | { listing_id: number; user_id: string }
      | undefined;

    if (!reviewData) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 },
      );
    }

    try {
      await query(
        `UPDATE public.reviews
         SET status = $1, moderated_by = $2, moderated_at = NOW()
         WHERE id = $3`,
        [status, session.userId, reviewId],
      );
    } catch (reviewError) {
      console.error("Database update error:", reviewError);
      captureRouteError(reviewError, { route: ROUTE, method: "POST" });
      return NextResponse.json(
        { success: false, error: "Failed to update review status" },
        { status: 500 },
      );
    }

    await applyLeaveReviewXpForModeration(
      {
        reviewId,
        userId: reviewData.user_id,
        listingId: reviewData.listing_id,
      },
      status,
    );

    if (status === "approved" || status === "rejected") {
      try {
        await notifyReviewStatus({
          review: {
            reviewId,
            userId: reviewData.user_id,
            listingId: reviewData.listing_id,
          },
          status,
        });
      } catch (notifyError) {
        console.error("Failed to notify reviewer of moderation outcome:", notifyError);
      }
    }

    // Acting on the content resolves any pending user reports against it -
    // best-effort, must never fail the moderation action itself.
    try {
      await query(
        `UPDATE public.content_reports
         SET status = 'resolved', resolved_by = $1, resolved_at = now()
         WHERE content_type = 'review' AND content_id = $2 AND status = 'pending'`,
        [session.userId, reviewId],
      );
    } catch (reportsError) {
      console.error("Failed to auto-resolve content reports:", reportsError);
    }

    return NextResponse.json({
      success: true,
      message: `Review ${status} successfully`,
      data: {
        review_id: reviewId,
        status,
        reason,
        moderated_by: session.userId,
        moderated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("POST /api/admin/reviews/[id]/moderate error:", error);
    captureRouteError(error, { route: ROUTE, method: "POST" });
    return NextResponse.json(
      { success: false, error: "Failed to moderate review" },
      { status: 500 },
    );
  }
}
