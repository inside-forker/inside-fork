import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { captureRouteError } from "@/lib/sentry/captureRouteError";
import { z } from "zod";
import { validateReviewContent } from "@/lib/reviews/profanity-filter";
import { awardLeaveReviewXpOnApprove } from "@/lib/reviews/moderation-xp";

// Validation schema for review creation (with branch_id)
const createReviewSchema = z.object({
  listing_id: z.number().int().positive(),
  branch_id: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10).max(500).trim(),
});

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createReviewSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { listing_id, branch_id, rating, comment } = validationResult.data;

    // Verify that the listing exists and is published
    const { rows: listingRows } = await query(
      `SELECT id, name, status FROM listings_with_details WHERE id = $1 AND status = 'published'`,
      [listing_id]
    );
    const listing = listingRows[0];

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found or not available for reviews" },
        { status: 404 },
      );
    }

    // Verify branch belongs to this listing
    const { rows: branchRows } = await query(
      `SELECT id, name FROM listing_branches WHERE id = $1 AND listing_id = $2`,
      [branch_id, listing_id]
    );
    const branch = branchRows[0];

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found for this listing" },
        { status: 404 },
      );
    }

    // Check if user has reviewed this branch before (for image requirement).
    // Replicated directly from get_user_branch_review_count(): that RPC's
    // own `p_user_id IS DISTINCT FROM auth.uid()` self-check always fails
    // over a direct pg connection (auth.uid() is never set), so it can't be
    // called as-is. Non-critical - continue with submission on any failure.
    try {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) > 0 AS requires_image FROM reviews WHERE user_id = $1 AND branch_id = $2`,
        [session.userId, branch_id]
      );
      // Image requirement: First review = optional, 2nd+ = REQUIRED
      // Note: Enforced client-side. Admin moderation catches violations.
      void (countRows[0]?.requires_image ?? false);
    } catch (error) {
      console.error("Review count check error:", error);
    }

    // Check for suspicious patterns (auto-flag, but don't block). Replicated
    // directly from check_suspicious_review_pattern() (same reason above).
    let suspiciousPattern: { is_suspicious: boolean; reason: string } | undefined;
    try {
      const { rows: patternRows } = await query(
        `SELECT
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS reviews_last_24h,
           COUNT(*) AS total_reviews
         FROM reviews WHERE user_id = $1 AND branch_id = $2`,
        [session.userId, branch_id]
      );
      const reviewsLast24h = parseInt(patternRows[0].reviews_last_24h, 10);
      const totalReviews = parseInt(patternRows[0].total_reviews, 10);

      if (reviewsLast24h >= 3) {
        suspiciousPattern = {
          is_suspicious: true,
          reason: `User submitted ${reviewsLast24h} reviews in last 24 hours - possible spam`,
        };
      } else if (totalReviews >= 10) {
        suspiciousPattern = {
          is_suspicious: true,
          reason: `User has ${totalReviews} total reviews for this branch - may need verification`,
        };
      } else {
        suspiciousPattern = {
          is_suspicious: false,
          reason: "No suspicious pattern detected",
        };
      }
    } catch (error) {
      console.error("Suspicious pattern check error:", error);
    }

    // CRITICAL: Block staff from reviewing listings they manage. Replicated
    // directly from user_manages_listing() (same reason above) - this one
    // must NOT silently fail open, so its own errors propagate normally.
    const { rows: roleRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId]
    );
    const userRole = roleRows[0]?.role;
    const { rows: ownsRows } = await query(
      `SELECT EXISTS(SELECT 1 FROM listings WHERE id = $1 AND owner_id = $2) AS owns`,
      [listing_id, session.userId]
    );
    const managesListing =
      ownsRows[0]?.owns === true ||
      userRole === "admin" ||
      userRole === "super_admin" ||
      userRole === "lister";

    if (managesListing === true) {
      return NextResponse.json(
        {
          error: "Conflict of Interest",
          message:
            "Staff members cannot review listings they manage. Please switch to a personal account if you wish to leave a review as a customer.",
        },
        { status: 403 },
      );
    }

    // Check for prohibited/explicit language
    const contentValidation = validateReviewContent(comment);
    if (!contentValidation.isValid) {
      return NextResponse.json(
        {
          error: contentValidation.error,
          code: contentValidation.code,
        },
        { status: 400 },
      );
    }

    // Create the review (auto-approved)
    let review;
    try {
      const { rows: insertedRows } = await query(
        `WITH inserted AS (
           INSERT INTO reviews (listing_id, branch_id, user_id, rating, comment, status, is_flagged_suspicious, moderated_at, created_at)
           VALUES ($1, $2, $3, $4, $5, 'approved', $6, NOW(), NOW())
           RETURNING *
         )
         SELECT inserted.id, inserted.listing_id, inserted.branch_id, inserted.user_id,
           inserted.rating, inserted.comment, inserted.status, inserted.moderated_by,
           to_json(inserted.moderated_at) #>> '{}' AS moderated_at,
           to_json(inserted.updated_at) #>> '{}' AS updated_at,
           to_json(inserted.created_at) #>> '{}' AS created_at,
           inserted.helpful_count, inserted.is_flagged_suspicious,
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS profiles
         FROM inserted
         LEFT JOIN profiles p ON p.id = inserted.user_id`,
        [
          listing_id,
          branch_id,
          session.userId,
          rating,
          comment,
          suspiciousPattern?.is_suspicious || false,
        ]
      );
      const row = insertedRows[0];
      review = {
        ...row,
        id: Number(row.id),
        listing_id: Number(row.listing_id),
        branch_id: Number(row.branch_id),
      };
    } catch (error) {
      console.error("Error creating review:", error);
      captureRouteError(error, { route: "/api/reviews", method: "POST" });
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: 500 },
      );
    }

    // Log the review creation for audit purposes
    try {
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, user_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          "review_created",
          "review",
          review.id.toString(),
          session.userId,
          JSON.stringify({
            listing_id,
            listing_name: listing.name,
            rating,
            status: "approved",
          }),
        ]
      );
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("Audit logging failed:", auditError);
    }

    // Award XP immediately on auto-approved review creation (idempotent per user+listing)
    try {
      await awardLeaveReviewXpOnApprove({
        reviewId: review.id,
        userId: session.userId,
        listingId: listing_id,
      });
    } catch (xpError) {
      console.error("[POST /api/reviews] Failed to award review XP:", xpError);
    }

    // === SMART NOTIFICATIONS (Prevent Admin Spam) ===
    try {
      const { createNotification } = await import("@/lib/notifications");

      // 1. Notify listing owner (always)
      const { rows: ownerRows } = await query(
        `SELECT created_by FROM listings WHERE id = $1`,
        [listing_id]
      );
      const listingOwnerId = ownerRows[0]?.created_by;

      if (listingOwnerId && listingOwnerId !== session.userId) {
        await createNotification({
          recipientId: listingOwnerId,
          roleScope: "lister",
          categorySlug: "general",
          title: "New Review on Your Listing",
          body: `${listing.name} received a ${rating}-star review from a customer.`,
          priority: "normal",
          ctaLabel: "View Review",
          ctaUrl: `/admin/reviews`,
          metadata: {
            review_id: review.id,
            listing_id,
            listing_name: listing.name,
            rating,
          },
        });
      }

      // 2. Notify admins ONLY if flagged as suspicious (prevent spam)
      if (suspiciousPattern?.is_suspicious) {
        const { rows: adminRows } = await query(
          `SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')`
        );

        for (const admin of adminRows) {
          if (admin.id !== session.userId) {
            await createNotification({
              recipientId: admin.id,
              roleScope: "admin",
              categorySlug: "general",
              title: "⚠️ Suspicious Review Flagged",
              body: `Review for "${listing.name}" flagged as suspicious. Immediate moderation required.`,
              priority: "high",
              ctaLabel: "Review Now",
              ctaUrl: `/admin/reviews`,
              metadata: {
                review_id: review.id,
                listing_id,
                listing_name: listing.name,
                rating,
                reason: suspiciousPattern.reason,
              },
            });
          }
        }
      }
    } catch (notificationError) {
      // Don't fail review submission if notifications fail
      console.error("Review notification failed:", notificationError);
    }

    return NextResponse.json({
      success: true,
      message: "Review submitted successfully and is pending moderation.",
      review: {
        ...review,
        profiles: review.profiles || null,
      },
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/reviews:", error);
    captureRouteError(error, { route: "/api/reviews", method: "POST" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET method to fetch reviews for a listing (for potential future use)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listingId = searchParams.get("listing_id");

    if (!listingId) {
      return NextResponse.json(
        { error: "listing_id parameter is required" },
        { status: 400 },
      );
    }

    // Get authenticated user to check if they can see pending reviews
    const session = await getSession(request);
    const isAdmin = session ? await checkAdminStatus(session.userId) : false;

    // Build query based on user permissions
    const whereClauses = ["r.listing_id = $1"];
    const params: unknown[] = [parseInt(listingId, 10)];

    // Only show approved reviews to regular users
    if (!isAdmin) {
      whereClauses.push(`r.status = 'approved'`);
    }

    let reviews;
    try {
      const { rows } = await query(
        `SELECT r.id, r.listing_id, r.branch_id, r.user_id, r.rating, r.comment, r.status,
           r.moderated_by,
           to_json(r.moderated_at) #>> '{}' AS moderated_at,
           to_json(r.updated_at) #>> '{}' AS updated_at,
           to_json(r.created_at) #>> '{}' AS created_at,
           r.helpful_count, r.is_flagged_suspicious,
           CASE WHEN p.id IS NOT NULL
             THEN json_build_object('full_name', p.full_name, 'avatar_url', p.avatar_url)
             ELSE NULL
           END AS profiles
         FROM reviews r
         LEFT JOIN profiles p ON p.id = r.user_id
         WHERE ${whereClauses.join(" AND ")}
         ORDER BY r.created_at DESC`,
        params
      );
      reviews = rows.map((row) => ({
        ...row,
        id: Number(row.id),
        listing_id: Number(row.listing_id),
        branch_id: Number(row.branch_id),
      }));
    } catch (error) {
      console.error("Error fetching reviews:", error);
      captureRouteError(error, { route: "/api/reviews", method: "GET" });
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: 500 },
      );
    }

    // Get comment counts for each review
    if (reviews.length > 0) {
      const reviewIds = reviews.map((r) => r.id);

      // Matches the old code's leniency: a failure here was never checked
      // for an error, so it silently fell back to zero comments everywhere.
      let commentCountMap = new Map<number, number>();
      try {
        const { rows: commentRows } = await query(
          `SELECT review_id FROM review_comments WHERE review_id = ANY($1::bigint[]) AND status = 'approved'`,
          [reviewIds]
        );
        commentRows.forEach((c) => {
          const rid = Number(c.review_id);
          commentCountMap.set(rid, (commentCountMap.get(rid) || 0) + 1);
        });
      } catch (error) {
        console.error("Error fetching comment counts:", error);
        commentCountMap = new Map<number, number>();
      }

      let imagesByReview = new Map<
        number,
        Array<{ id: number; image_url: string; created_at: string }>
      >();
      try {
        const { rows: imageRows } = await query(
          `SELECT id, review_id, image_url, to_json(created_at) #>> '{}' AS created_at
           FROM review_images WHERE review_id = ANY($1::bigint[])`,
          [reviewIds]
        );
        imagesByReview = new Map();
        for (const img of imageRows) {
          const reviewId = Number(img.review_id);
          const list = imagesByReview.get(reviewId) ?? [];
          list.push({
            id: Number(img.id),
            image_url: img.image_url,
            created_at: img.created_at,
          });
          imagesByReview.set(reviewId, list);
        }
      } catch (error) {
        console.error("Error fetching review images:", error);
      }

      const reviewsWithCommentCount = reviews.map((review) => ({
        ...review,
        comment_count: commentCountMap.get(review.id) || 0,
        review_images: imagesByReview.get(review.id) ?? [],
      }));

      return NextResponse.json({
        reviews: reviewsWithCommentCount,
        total: reviewsWithCommentCount.length,
      });
    }

    return NextResponse.json({
      reviews: [],
      total: 0,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/reviews:", error);
    captureRouteError(error, { route: "/api/reviews", method: "GET" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Helper function to check admin status
async function checkAdminStatus(userId: string): Promise<boolean> {
  try {
    const { rows } = await query(`SELECT role FROM profiles WHERE id = $1`, [
      userId,
    ]);
    const role = rows[0]?.role;
    return role === "admin" || role === "super_admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}
