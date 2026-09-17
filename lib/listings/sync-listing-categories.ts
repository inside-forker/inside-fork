import { query } from "@/lib/db";

/**
 * Normalize category ID list: unique positive ints, primary first if provided.
 */
export function normalizeCategoryIds(
  categoryIds: unknown,
  primaryCategoryId?: unknown,
): { categoryIds: number[]; primaryCategoryId: number | null } {
  const raw = Array.isArray(categoryIds)
    ? categoryIds
    : categoryIds != null && categoryIds !== ""
      ? [categoryIds]
      : [];

  const ids = [
    ...new Set(
      raw
        .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];

  let primary: number | null =
    primaryCategoryId != null && primaryCategoryId !== ""
      ? typeof primaryCategoryId === "number"
        ? primaryCategoryId
        : parseInt(String(primaryCategoryId), 10)
      : null;

  if (primary != null && (!Number.isFinite(primary) || primary <= 0)) {
    primary = null;
  }

  if (primary != null && !ids.includes(primary)) {
    ids.unshift(primary);
  }

  if (primary == null && ids.length > 0) {
    primary = ids[0];
  }

  // Keep primary first for stable ordering
  if (primary != null && ids.length > 1) {
    const rest = ids.filter((id) => id !== primary);
    return { categoryIds: [primary, ...rest], primaryCategoryId: primary };
  }

  return { categoryIds: ids, primaryCategoryId: primary };
}

/**
 * Replace listing_categories rows and sync listings.category_id (primary).
 * Uses a single transaction so concurrent saves don't leave partial state.
 */
export async function syncListingCategories(
  listingId: number,
  categoryIdsInput: unknown,
  primaryCategoryIdInput?: unknown,
): Promise<{ categoryIds: number[]; primaryCategoryId: number | null }> {
  const { categoryIds, primaryCategoryId } = normalizeCategoryIds(
    categoryIdsInput,
    primaryCategoryIdInput,
  );

  const { pool } = await import("@/lib/db");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM listing_categories WHERE listing_id = $1`, [
      listingId,
    ]);

    if (categoryIds.length > 0) {
      const values: unknown[] = [];
      const placeholders: string[] = [];
      categoryIds.forEach((categoryId, i) => {
        const base = i * 3;
        placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        values.push(listingId, categoryId, categoryId === primaryCategoryId);
      });

      await client.query(
        `INSERT INTO listing_categories (listing_id, category_id, is_primary)
         VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    await client.query(`UPDATE listings SET category_id = $1 WHERE id = $2`, [
      primaryCategoryId,
      listingId,
    ]);

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }

  return { categoryIds, primaryCategoryId };
}

export async function getListingCategoryIds(
  listingId: number,
): Promise<number[]> {
  const { rows } = (await query(
    `SELECT category_id
     FROM listing_categories
     WHERE listing_id = $1
     ORDER BY is_primary DESC, category_id ASC`,
    [listingId],
  )) as { rows: Array<{ category_id: number | string }> };
  return rows
    .map((r) => Number(r.category_id))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export async function getListingCategoryIdsMap(
  listingIds: number[],
): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (listingIds.length === 0) return map;

  const { rows } = (await query(
    `SELECT listing_id, category_id
     FROM listing_categories
     WHERE listing_id = ANY($1::bigint[])
     ORDER BY listing_id, is_primary DESC, category_id ASC`,
    [listingIds],
  )) as { rows: Array<{ listing_id: number | string; category_id: number | string }> };

  for (const row of rows) {
    // listing_id is bigint - node-postgres returns bigint columns as strings,
    // so the map key must be normalized or every .get(number) lookup misses.
    const listingId = Number(row.listing_id);
    const list = map.get(listingId) ?? [];
    list.push(Number(row.category_id));
    map.set(listingId, list);
  }
  return map;
}
