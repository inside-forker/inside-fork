import { NextRequest, NextResponse } from "next/server";
import {
  assertListingRouteAccess,
  toListingAccessResponse,
} from "@/lib/listings/route-access";
import { query } from "@/lib/db";

/**
 * Opening Hours Input Type
 *
 * The frontend sends hours with dayOfWeek in database format (0=Sunday)
 * but displays them Monday-first using transformation functions.
 */
type OpeningHoursInput = {
  dayOfWeek: number; // Database format: 0=Sunday, 1=Monday, ..., 6=Saturday
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  branch_id?: number | null; // FK to listing_branches (preserve branch association)
};

// GET: Fetch opening hours for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    // Check if requesting hours for a specific branch
    const { searchParams } = new URL(request.url);
    const branchIdParam = searchParams.get("branch_id");

    const whereParams: unknown[] = [listingId];
    let whereSql = "listing_id = $1";

    if (branchIdParam) {
      const branchId = parseInt(branchIdParam);
      if (!isNaN(branchId)) {
        whereParams.push(branchId);
        whereSql += ` AND branch_id = $${whereParams.length}`;
      }
    }

    let hours;
    try {
      const result = await query(
        `SELECT * FROM opening_hours WHERE ${whereSql} ORDER BY day_of_week ASC`,
        whereParams,
      );
      hours = result.rows;
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch opening hours" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: hours });
  } catch (_error) {
    if (_error instanceof Error && _error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH: Update opening hours for a listing
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json(
        { error: "Invalid listing ID" },
        { status: 400 },
      );
    }

    await assertListingRouteAccess({
      listingId,
      allowBusinessOwner: true,
    });

    const body = await request.json();

    if (!Array.isArray(body.opening_hours)) {
      console.error(
        "PATCH /opening-hours: opening_hours is not an array",
        body,
      );
      return NextResponse.json(
        { error: "Invalid opening hours format" },
        { status: 400 },
      );
    }

    // Determine which branch we're updating
    // If all hours have the same branch_id, we're editing a specific branch
    // If branch_ids are null/undefined, we're editing legacy single-location hours
    const branchIds = body.opening_hours
      .map((h: OpeningHoursInput) => h.branch_id)
      .filter(
        (id: number | null | undefined) => id !== null && id !== undefined,
      );

    const uniqueBranchIds = [...new Set(branchIds)];
    const isEditingSingleBranch = uniqueBranchIds.length === 1;
    const branchIdToUpdate: number | null = isEditingSingleBranch
      ? (uniqueBranchIds[0] as number)
      : null;

    // Check if payload is ALL legacy (branch_id = null)
    const allLegacy = body.opening_hours.every(
      (h: OpeningHoursInput) =>
        h.branch_id === null || h.branch_id === undefined,
    );

    // Check listing status to determine validation requirements
    let listing;
    try {
      const { rows } = await query(
        `SELECT status FROM listings WHERE id = $1`,
        [listingId],
      );
      listing = rows[0];
    } catch (listingError) {
      console.error(
        "PATCH /opening-hours: Failed to fetch listing",
        listingError,
      );
      return NextResponse.json(
        { error: "Failed to fetch listing status" },
        { status: 500 },
      );
    }

    // Validate each row - only require times for published listings
    // dayOfWeek should be in database format: 0=Sunday through 6=Saturday
    for (const [i, row] of body.opening_hours.entries()) {
      if (
        typeof row.dayOfWeek !== "number" ||
        row.dayOfWeek < 0 ||
        row.dayOfWeek > 6
      ) {
        console.error(
          `PATCH /opening-hours: Invalid dayOfWeek at index ${i}`,
          row,
        );
        return NextResponse.json(
          { error: `Invalid opening hour at index ${i}` },
          { status: 400 },
        );
      }

      // If the listing is published, validate times if provided
      if (listing?.status === "published" && !row.isClosed) {
        const openStr = typeof row.openTime === "string" ? row.openTime.trim() : "";
        const closeStr = typeof row.closeTime === "string" ? row.closeTime.trim() : "";

        // If both empty -> allowed
        if (!openStr && !closeStr) continue;

        // If one is provided and one is missing -> invalid for published
        if ((!openStr && closeStr) || (openStr && !closeStr)) {
          console.error(
            `PATCH /opening-hours: Incomplete times at index ${i}`,
            row,
          );
          return NextResponse.json(
            { error: `Invalid opening hour at index ${i}` },
            { status: 400 },
          );
        }
      }
    }

    // Delete existing opening hours for this listing
    // CRITICAL: Only delete hours for the branch being edited to avoid data loss!
    const deleteParams: unknown[] = [listingId];
    let deleteWhereSql = "listing_id = $1";

    if (isEditingSingleBranch && branchIdToUpdate !== null) {
      deleteParams.push(branchIdToUpdate);
      deleteWhereSql += ` AND branch_id = $${deleteParams.length}`;
    } else if (allLegacy) {
      // Legacy mode: Only delete hours with branch_id = null
      deleteWhereSql += " AND branch_id IS NULL";
    }

    try {
      await query(`DELETE FROM opening_hours WHERE ${deleteWhereSql}`, deleteParams);
    } catch (deleteError) {
      console.error("[OPENING HOURS API] Delete failed:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete existing opening hours" },
        { status: 500 },
      );
    }

    // Helper to sanitize time input (convert empty strings/whitespace to null)
    const sanitizeTime = (val: unknown): string | null => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
      // Basic check for time format (e.g. HH:MM or HH:MM:SS)
      return trimmed;
    };

    // Insert new opening hours
    // Data is already in correct database format (0=Sunday) from frontend
    const insertRows = body.opening_hours.map((row: OpeningHoursInput) => {
      const isClosed = Boolean(row.isClosed);
      const openTime = isClosed ? null : sanitizeTime(row.openTime);
      const closeTime = isClosed ? null : sanitizeTime(row.closeTime);

      return {
        listing_id: listingId,
        day_of_week: row.dayOfWeek,
        open_time: openTime,
        close_time: closeTime,
        is_closed: isClosed || (!openTime && !closeTime),
        branch_id: row.branch_id ?? null,
      };
    });

    let insertedData;
    try {
      const valueRows: string[] = [];
      const insertParams: unknown[] = [];
      insertRows.forEach(
        (row: {
          listing_id: number;
          day_of_week: number;
          open_time: string | null;
          close_time: string | null;
          is_closed: boolean;
          branch_id: number | null;
        }) => {
          insertParams.push(
            row.listing_id,
            row.day_of_week,
            row.open_time,
            row.close_time,
            row.is_closed,
            row.branch_id,
          );
          const base = insertParams.length - 6;
          valueRows.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`,
          );
        },
      );

      if (valueRows.length > 0) {
        const { rows } = await query(
          `INSERT INTO opening_hours (listing_id, day_of_week, open_time, close_time, is_closed, branch_id)
           VALUES ${valueRows.join(", ")}
           RETURNING *`,
          insertParams,
        );
        insertedData = rows;
      } else {
        insertedData = [];
      }
    } catch (insertError) {
      console.error(
        "PATCH /opening-hours: Failed to insert rows",
        insertError,
        insertRows,
      );
      return NextResponse.json(
        { error: "Failed to update opening hours" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      inserted: insertedData?.length || 0,
    });
  } catch (_error) {
    if (_error instanceof Error && _error.name === "ListingRouteAccessError") {
      return toListingAccessResponse(_error);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
