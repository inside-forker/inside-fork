import { NextRequest, NextResponse } from "next/server";
import { pool, query } from "@/lib/db";
import {
  getAdminAuthErrorStatus,
  requireListingCapacityAccess,
} from "@/lib/auth/admin";
import { normalizeCategoryIds } from "@/lib/listings/sync-listing-categories";
import type { ListingCapacityFields } from "@/types/listing.types";

type CapacityFieldKey = keyof ListingCapacityFields;

const ALLOWED_FIELDS: Array<CapacityFieldKey | "category_id" | "status"> = [
  "min_price_per_person",
  "max_price_per_person",
  "min_guest_capacity",
  "max_guest_capacity",
  "category_id",
  "status",
];

const VALID_STATUSES = [
  "published",
  "draft",
  "pending_approval",
  "rejected",
  "archived",
] as const;

function parseNullableNumber(
  value: unknown,
  field: string,
  opts: { integer?: boolean; min?: number } = {},
): number | null | { error: string } {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return { error: `${field} must be a valid number` };
  }
  if (opts.integer && !Number.isInteger(num)) {
    return { error: `${field} must be a whole number` };
  }
  if (opts.min !== undefined && num < opts.min) {
    return { error: `${field} must be at least ${opts.min}` };
  }
  return num;
}

function validateCapacityPayload(body: Record<string, unknown>):
  | {
      ok: true;
      updates: Partial<
        ListingCapacityFields & {
          category_id: number | null;
          category_ids?: number[];
          status?: string;
        }
      >;
    }
  | { ok: false; error: string } {
  const updates: Partial<
    ListingCapacityFields & {
      category_id: number | null;
      category_ids?: number[];
      status?: string;
    }
  > = {};

  if ("category_ids" in body && Array.isArray(body.category_ids)) {
    const { categoryIds, primaryCategoryId } = normalizeCategoryIds(
      body.category_ids,
    );
    updates.category_ids = categoryIds;
    updates.category_id = primaryCategoryId;
  }

  for (const field of ALLOWED_FIELDS) {
    if (!(field in body)) continue;

    if (field === "status") {
      const val = body.status;
      if (
        typeof val !== "string" ||
        !VALID_STATUSES.includes(val as (typeof VALID_STATUSES)[number])
      ) {
        return {
          ok: false,
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        };
      }
      updates.status = val;
      continue;
    }

    if (field === "category_id") {
      if (!("category_ids" in body)) {
        const val = body[field];
        if (val === null || val === undefined || val === "") {
          updates.category_id = null;
          updates.category_ids = [];
        } else {
          const num = Number(val);
          if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
            return { ok: false, error: "category_id must be a positive integer" };
          }
          updates.category_id = num;
          updates.category_ids = [num];
        }
      }
      continue;
    }

    const isPrice = field.includes("price");
    const parsed = parseNullableNumber(body[field], field, {
      integer: !isPrice,
      min: isPrice ? 0 : 1,
    });

    if (parsed && typeof parsed === "object" && "error" in parsed) {
      return { ok: false, error: parsed.error };
    }

    updates[field] = parsed as number | null;
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      error: "Provide at least one field to update",
    };
  }

  return { ok: true, updates };
}

function validateMinMaxOrder(
  current: ListingCapacityFields,
  updates: Partial<ListingCapacityFields>,
): string | null {
  const minPrice =
    updates.min_price_per_person !== undefined
      ? updates.min_price_per_person
      : current.min_price_per_person;
  const maxPrice =
    updates.max_price_per_person !== undefined
      ? updates.max_price_per_person
      : current.max_price_per_person;
  const minCapacity =
    updates.min_guest_capacity !== undefined
      ? updates.min_guest_capacity
      : current.min_guest_capacity;
  const maxCapacity =
    updates.max_guest_capacity !== undefined
      ? updates.max_guest_capacity
      : current.max_guest_capacity;

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return "Minimum price per person cannot exceed maximum price per person";
  }

  if (
    minCapacity !== null &&
    maxCapacity !== null &&
    minCapacity > maxCapacity
  ) {
    return "Minimum guest capacity cannot exceed maximum guest capacity";
  }

  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireListingCapacityAccess(request);

    const { id: idParam } = await params;
    const listingId = parseInt(idParam, 10);
    if (Number.isNaN(listingId)) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validated = validateCapacityPayload(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { rows: existingRows } = await query(
      `SELECT
         id,
         min_price_per_person,
         max_price_per_person,
         min_guest_capacity,
         max_guest_capacity,
         category_id
       FROM listings
       WHERE id = $1
       LIMIT 1`,
      [listingId],
    );

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const current = existingRows[0] as ListingCapacityFields & {
      id: number;
      category_id: number | null;
    };
    const orderError = validateMinMaxOrder(current, validated.updates);
    if (orderError) {
      return NextResponse.json({ error: orderError }, { status: 400 });
    }

    const { category_ids, ...capacityAndCategoryUpdates } = validated.updates;

    // Single transaction: capacity update + category sync (no N+1 inserts)
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const setClauses: string[] = [];
      const values: unknown[] = [];
      for (const [key, value] of Object.entries(capacityAndCategoryUpdates)) {
        values.push(value);
        setClauses.push(`${key} = $${values.length}`);
      }

      let updatedListing: Record<string, unknown>;

      if (setClauses.length > 0) {
        values.push(listingId);
        const { rows } = await client.query(
          `UPDATE listings
           SET ${setClauses.join(", ")}, updated_at = NOW()
           WHERE id = $${values.length}
           RETURNING
             id,
             name,
             slug,
             status,
             category_id,
             address,
             min_price_per_person,
             max_price_per_person,
             min_guest_capacity,
             max_guest_capacity`,
          values,
        );
        updatedListing = rows[0];
      } else {
        const { rows } = await client.query(
          `SELECT
             id,
             name,
             slug,
             status,
             category_id,
             address,
             min_price_per_person,
             max_price_per_person,
             min_guest_capacity,
             max_guest_capacity
           FROM listings
           WHERE id = $1`,
          [listingId],
        );
        updatedListing = rows[0];
      }

      let finalCategoryIds: number[] = [];

      if (category_ids !== undefined) {
        await client.query(
          `DELETE FROM listing_categories WHERE listing_id = $1`,
          [listingId],
        );

        if (category_ids.length > 0) {
          const insertValues: unknown[] = [];
          const placeholders: string[] = [];
          const primaryId = capacityAndCategoryUpdates.category_id ?? category_ids[0];

          category_ids.forEach((categoryId, i) => {
            const base = i * 3;
            placeholders.push(
              `($${base + 1}, $${base + 2}, $${base + 3})`,
            );
            insertValues.push(
              listingId,
              categoryId,
              categoryId === primaryId,
            );
          });

          await client.query(
            `INSERT INTO listing_categories (listing_id, category_id, is_primary)
             VALUES ${placeholders.join(", ")}`,
            insertValues,
          );
        }

        // Keep listings.category_id in sync even if only category_ids changed
        // and category_id was already included in the UPDATE above.
        if (!("category_id" in capacityAndCategoryUpdates)) {
          const primary =
            category_ids.length > 0 ? category_ids[0] : null;
          await client.query(
            `UPDATE listings SET category_id = $1, updated_at = NOW() WHERE id = $2`,
            [primary, listingId],
          );
          updatedListing = { ...updatedListing, category_id: primary };
        }

        finalCategoryIds = category_ids;
      } else {
        const { rows: lcRows } = await client.query(
          `SELECT category_id
           FROM listing_categories
           WHERE listing_id = $1
           ORDER BY is_primary DESC, category_id ASC`,
          [listingId],
        );
        finalCategoryIds = lcRows.map((r) => Number(r.category_id));
      }

      let category_name: string | null = null;
      if (updatedListing.category_id != null) {
        const { rows: categoryRows } = await client.query(
          `SELECT name FROM categories WHERE id = $1 LIMIT 1`,
          [updatedListing.category_id],
        );
        category_name = (categoryRows[0]?.name as string | undefined) ?? null;
      }

      await client.query("COMMIT");

      return NextResponse.json({
        listing: {
          ...updatedListing,
          category_ids: finalCategoryIds,
          category_name,
        },
      });
    } catch (txError) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    const status = getAdminAuthErrorStatus(error);
    if (status) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unauthorized" },
        { status },
      );
    }

    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    const message = error instanceof Error ? error.message : "";

    // Invalid category FK
    if (code === "23503") {
      return NextResponse.json(
        { error: "One or more selected categories are invalid" },
        { status: 400 },
      );
    }

    if (
      message.includes("listings_price_per_person_order") ||
      message.includes("listings_guest_capacity_order") ||
      message.includes("listings_min_price_per_person_nonneg") ||
      message.includes("listings_max_price_per_person_nonneg") ||
      message.includes("listings_min_guest_capacity_positive") ||
      message.includes("listings_max_guest_capacity_positive")
    ) {
      return NextResponse.json(
        { error: "Invalid capacity values for this listing" },
        { status: 400 },
      );
    }

    console.error("Error updating listing capacity:", error);
    return NextResponse.json(
      { error: "Failed to update listing capacity" },
      { status: 500 },
    );
  }
}
