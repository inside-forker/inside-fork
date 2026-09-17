import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { syncListingCategories, normalizeCategoryIds, getListingCategoryIdsMap } from "@/lib/listings/sync-listing-categories";
import { deleteListingsBulk } from "@/lib/utils/listing-deletion";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { rows: profileRows } = await query(
      `SELECT role, full_name FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const categoryId = searchParams.get("category_id") || "";

    const offset = (page - 1) * limit;

    const whereParams: unknown[] = [];
    const whereClauses: string[] = [];

    if (search) {
      whereParams.push(`%${search}%`);
      whereClauses.push(
        `(name ILIKE $${whereParams.length} OR description ILIKE $${whereParams.length})`,
      );
    }

    if (status && status !== "all") {
      whereParams.push(status);
      whereClauses.push(`status = $${whereParams.length}`);
    }

    if (categoryId && categoryId !== "all") {
      const categoryIdNum = parseInt(categoryId);
      if (!isNaN(categoryIdNum)) {
        whereParams.push(categoryIdNum);
        whereClauses.push(
          `EXISTS (
             SELECT 1 FROM listing_categories lc
             WHERE lc.listing_id = listings.id AND lc.category_id = $${whereParams.length}
           )`,
        );
      }
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    let listings, count;
    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM listings ${whereSql}`,
        whereParams,
      );
      count = parseInt(countResult.rows[0].count, 10);

      const listParams = [...whereParams, limit, offset];
      const listingsResult = await query(
        `SELECT * FROM listings ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );
      listings = listingsResult.rows;
    } catch (error) {
      console.error("Error fetching listings:", error);
      return NextResponse.json(
        { error: "Failed to fetch listings" },
        { status: 500 },
      );
    }

    const creatorIds = [
      ...new Set(listings.map((l) => l.created_by).filter((id) => id != null)),
    ];
    const listingIds = listings.map((l) => l.id);
    const categoryIdsByListing = await getListingCategoryIdsMap(listingIds);
    const allCategoryIds = new Set<number>();
    for (const ids of categoryIdsByListing.values()) {
      ids.forEach((id) => allCategoryIds.add(id));
    }
    listings.forEach((l) => {
      if (l.category_id != null) allCategoryIds.add(l.category_id);
    });

    const [creatorsResult, categoriesResult] = await Promise.all([
      creatorIds.length > 0
        ? query(`SELECT id, full_name FROM profiles WHERE id = ANY($1::uuid[])`, [
            creatorIds,
          ])
        : { rows: [] },
      allCategoryIds.size > 0
        ? query(`SELECT id, name FROM categories WHERE id = ANY($1::int[])`, [
            [...allCategoryIds],
          ])
        : { rows: [] },
    ]);

    const creatorById = new Map(creatorsResult.rows.map((c) => [c.id, c]));
    const categoryById = new Map(categoriesResult.rows.map((c) => [c.id, c]));

    // Get accurate stats counts using database count queries
    const [totalResult, publishedResult, draftResult, featuredResult, archivedResult] =
      await Promise.all([
        query(`SELECT COUNT(*) FROM listings`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'published'`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'draft'`),
        query(`SELECT COUNT(*) FROM listings WHERE is_featured = true`),
        query(`SELECT COUNT(*) FROM listings WHERE status = 'archived'`),
      ]);

    const stats = {
      total: parseInt(totalResult.rows[0].count, 10) || 0,
      published: parseInt(publishedResult.rows[0].count, 10) || 0,
      draft: parseInt(draftResult.rows[0].count, 10) || 0,
      featured: parseInt(featuredResult.rows[0].count, 10) || 0,
      archived: parseInt(archivedResult.rows[0].count, 10) || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        listings: listings.map((l) => {
          const creator = creatorById.get(l.created_by);
          const ids =
            categoryIdsByListing.get(l.id) ??
            (l.category_id != null ? [l.category_id] : []);
          const categoryNames = ids
            .map((id) => categoryById.get(id)?.name)
            .filter((name): name is string => !!name);

          return {
            ...l,
            creator_full_name: creator?.full_name || null,
            category_name: categoryNames.join(", ") || null,
          };
        }),
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
        stats,
        currentUser: {
          id: session.userId,
          full_name: profile.full_name || session.email || "Staff",
          role: profile.role,
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      address,
      phone_number,
      email,
      website,
      category_id,
      category_ids,
      latitude,
      longitude,
      is_featured,
      status,
      facebook_url,
      instagram_url,
      whatsapp_number,
      youtube_url,
      google_maps_url,
      place_id,
      owner_id, // allow owner_id to be set explicitly, but do not default
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Listing name is required" },
        { status: 400 },
      );
    }

    const hasCategories =
      (Array.isArray(category_ids) && category_ids.length > 0) ||
      category_id != null;
    if (!hasCategories) {
      return NextResponse.json(
        { error: "At least one category is required" },
        { status: 400 },
      );
    }

    const normalized = normalizeCategoryIds(
      category_ids ?? (category_id != null ? [category_id] : []),
      category_id,
    );
    if (!normalized.primaryCategoryId) {
      return NextResponse.json(
        { error: "At least one category is required" },
        { status: 400 },
      );
    }

    // Generate slug from name
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Insert new listing
    let listing;
    try {
      const { rows } = await query(
        `INSERT INTO listings (
           name, slug, description, address, phone_number, email, website,
           category_id, latitude, longitude, is_featured, status, owner_id,
           created_by, facebook_url, instagram_url, whatsapp_number,
           youtube_url, google_maps_url, place_id, parking_information, parking_amenities
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
           $16, $17, $18, $19, $20, $21, $22
         )
         RETURNING *`,
        [
          name.trim(),
          slug,
          description?.trim() || null,
          address?.trim() || null,
          phone_number?.trim() || null,
          email?.trim() || null,
          website?.trim() || null,
          normalized.primaryCategoryId,
          latitude ? parseFloat(latitude) : null,
          longitude ? parseFloat(longitude) : null,
          is_featured || false,
          status || "draft",
          owner_id || null,
          session.userId,
          facebook_url?.trim() || null,
          instagram_url?.trim() || null,
          whatsapp_number?.trim() || null,
          youtube_url?.trim() || null,
          google_maps_url?.trim() || null,
          place_id?.trim() || null,
          body.parking_information?.trim() || null,
          body.parking_amenities || null,
        ],
      );
      listing = rows[0];
    } catch (error) {
      console.error("Error creating listing:", error);
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 },
      );
    }

    try {
      await syncListingCategories(
        listing.id,
        normalized.categoryIds,
        normalized.primaryCategoryId,
      );
    } catch (syncError) {
      console.error("Failed to sync listing categories on create:", syncError);
      return NextResponse.json(
        { error: "Listing created but failed to save categories" },
        { status: 500 },
      );
    }

    // Log the admin action
    try {
      const { logListingCreation } = await import("@/lib/audit");
      await logListingCreation(
        session.userId,
        listing.id.toString(),
        listing,
        request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
        request.headers.get("user-agent") || undefined,
      );
    } catch (logError) {
      console.error("Failed to log listing creation:", logError);
      // Don't fail the operation if logging fails
    }

    return NextResponse.json(
      { success: true, data: { listing } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }

    if (![
      "admin",
      "super_admin",
      "lister",
    ].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: ids array is required" },
        { status: 400 },
      );
    }

    const validIds = ids.filter((id) => typeof id === "number" && !isNaN(id));
    if (validIds.length !== ids.length) {
      return NextResponse.json(
        { error: "Invalid request: all ids must be valid numbers" },
        { status: 400 },
      );
    }

    const allowedStatuses = ["published", "draft"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid request: status must be 'published' or 'draft'" },
        { status: 400 },
      );
    }

    let existingListings;
    try {
      const result = await query(
        `SELECT * FROM listings WHERE id = ANY($1::int[])`,
        [validIds],
      );
      existingListings = result.rows;
    } catch (fetchError) {
      console.error("Error fetching listings for bulk status update:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch listings for update" },
        { status: 500 },
      );
    }

    if (!existingListings || existingListings.length === 0) {
      return NextResponse.json(
        { error: "No listings found for provided ids" },
        { status: 404 },
      );
    }

    let updatedListings;
    try {
      const result = await query(
        `UPDATE listings SET status = $1 WHERE id = ANY($2::int[]) RETURNING id, status`,
        [status, validIds],
      );
      updatedListings = result.rows;
    } catch (updateError) {
      console.error("Error bulk updating listing status:", updateError);
      return NextResponse.json(
        { error: "Failed to update listing status" },
        { status: 500 },
      );
    }

    try {
      const { logListingUpdate } = await import("@/lib/audit");
      for (const listing of existingListings) {
        await logListingUpdate(
          session.userId,
          listing.id.toString(),
          listing,
          {
            ...listing,
            status,
          },
          request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
          request.headers.get("user-agent") || undefined,
        );
      }
    } catch (logError) {
      console.error("Failed to log bulk listing status updates:", logError);
    }

    return NextResponse.json({
      success: true,
      message: `${updatedListings?.length || 0} listing(s) moved to ${status}`,
      updatedCount: updatedListings?.length || 0,
      status,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { rows: profileRows } = await query(
      `SELECT role FROM profiles WHERE id = $1`,
      [session.userId],
    );
    const profile = profileRows[0];
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 403 });
    }
    if (!["admin", "super_admin", "lister", "data_entry"].includes(profile.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: ids array is required" },
        { status: 400 },
      );
    }

    // Validate all IDs are numbers
    const validIds = ids.filter((id) => typeof id === "number" && !isNaN(id));
    if (validIds.length !== ids.length) {
      return NextResponse.json(
        { error: "Invalid request: all ids must be valid numbers" },
        { status: 400 },
      );
    }

    // Get listing data before deletion for logging
    let listingsToDelete;
    try {
      const result = await query(
        `SELECT * FROM listings WHERE id = ANY($1::int[])`,
        [validIds],
      );
      listingsToDelete = result.rows;
    } catch (fetchError) {
      console.error("Error fetching listings for deletion:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch listings for deletion" },
        { status: 500 },
      );
    }

    // Use centralized deletion utility
    const deletionResult = await deleteListingsBulk(validIds);

    if (!deletionResult.success) {
      // Check if partial success (some deleted, some blocked)
      if (deletionResult.deletedCount && deletionResult.deletedCount > 0) {
        console.warn(
          `[BULK DELETE] Partial success: ${deletionResult.deletedCount} deleted, ${deletionResult.failedIds?.length || 0} failed`,
        );
        // Continue to logging for successfully deleted ones
      } else {
        return NextResponse.json(
          {
            error: deletionResult.error || "Failed to delete listings",
            details: deletionResult.restrictionErrors,
          },
          { status: 400 },
        );
      }
    }

    const successfullyDeletedIds = deletionResult.failedIds
      ? validIds.filter((id) => !deletionResult.failedIds!.includes(id))
      : validIds;

    // Log the admin actions for successfully deleted listings
    try {
      const { logListingDeletion } = await import("@/lib/audit");
      for (const listing of listingsToDelete || []) {
        if (successfullyDeletedIds.includes(listing.id)) {
          await logListingDeletion(
            session.userId,
            listing.id.toString(),
            listing,
            request.headers.get("x-forwarded-for") ||
              request.headers.get("x-real-ip") ||
              "unknown",
            request.headers.get("user-agent") || undefined,
          );
        }
      }
    } catch (logError) {
      console.error("Failed to log listing deletions:", logError);
    }

    const responseMessage = deletionResult.failedIds?.length
      ? `${deletionResult.deletedCount} listing(s) deleted. ${deletionResult.failedIds.length} skipped due to active change requests.`
      : `${deletionResult.deletedCount} listing(s) deleted successfully`;

    return NextResponse.json({
      success: true,
      message: responseMessage,
      deletedCount: deletionResult.deletedCount,
      failedCount: deletionResult.failedIds?.length || 0,
      failedIds: deletionResult.failedIds,
      warnings: deletionResult.restrictionErrors,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
