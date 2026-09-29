import { query } from "@/lib/db";

export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
};

/** Expands a category id to itself plus all descendant subcategory ids when it has children. */
export async function resolveCategoryIdScope(
  categoryId: number,
): Promise<number[]> {
  const { rows } = await query(
    `WITH RECURSIVE cat_tree AS (
       SELECT id FROM categories WHERE id = $1
       UNION ALL
       SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id
     )
     SELECT id FROM cat_tree`,
    [categoryId],
  );
  return rows.map((r) => Number(r.id));
}

/**
 * Resolves a category slug (as used in URLs / query params) to the category
 * row plus the id scope (self + subcategories when it's a parent). Returns
 * null for a missing/unknown/"all" slug.
 */
export async function resolveCategoryBySlugWithScope(
  slug: string | null | undefined,
): Promise<{ category: CategoryRow; categoryIds: number[] } | null> {
  if (!slug || slug === "all") return null;

  const { rows } = await query(
    `SELECT id, name, slug, parent_id FROM categories WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  const category = rows[0] as CategoryRow | undefined;
  if (!category) return null;

  const categoryIds = await resolveCategoryIdScope(category.id);
  return { category, categoryIds };
}

/**
 * SQL EXISTS clause matching a listing (by `idColumn`) against any of the
 * given category ids via the listing_categories junction table.
 *
 * By default this matches primary OR secondary category links, which is
 * right for general browse/search (a mall's food court should surface under
 * both "Food & Dining" and "Shopping & Fashion"). Pass `primaryOnly: true`
 * for curated single-identity surfaces (e.g. themed home-feed carousels)
 * where a listing's secondary tags shouldn't be enough to qualify it - a
 * restaurant secondarily tagged "Shopping Malls & Outlets" belongs under
 * "Late Night & Desi Vibes", not "Retail Therapy".
 */
export function listingCategoriesExistsClause(
  idColumn: string,
  paramIndex: number,
  options?: { primaryOnly?: boolean },
): string {
  const primaryClause = options?.primaryOnly ? " AND lc.is_primary = true" : "";
  return `EXISTS (
    SELECT 1 FROM listing_categories lc
    WHERE lc.listing_id = ${idColumn} AND lc.category_id = ANY($${paramIndex}::int[])${primaryClause}
  )`;
}
