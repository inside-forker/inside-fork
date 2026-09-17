/**
 * Category Helper Functions
 * Provides utilities for checking category types based on database hierarchy
 */

import { query } from "@/lib/db";

// Cache for category lookups (in-memory, resets per request)
const categoryCache = new Map<
  number,
  {
    slug: string;
    parentSlug: string | null;
    isRestaurant: boolean;
  }
>();

const FOOD_RELATED_SLUGS = [
  "eat-drink",
  "eat-and-drink",
  "food",
  "restaurants",
  "dining",
];

/**
 * Check if any of a listing's categories are restaurant/food-related.
 * Handles both direct categories and subcategories via parent lookup. A
 * listing tagged as food-related only via a secondary category (not its
 * legacy primary one) should still match, so this takes the full set of
 * category ids for the listing rather than a single id.
 *
 * @param categoryIds - All category IDs for the listing (see getListingCategoryIds)
 * @returns Promise<boolean> - True if any category or its parent is food-related
 */
export async function isRestaurantCategory(
  categoryIds: Array<number | string | null | undefined> | null | undefined,
): Promise<boolean> {
  const ids = [
    ...new Set(
      (categoryIds ?? [])
        .map((id) => (typeof id === "number" ? id : parseInt(String(id), 10)))
        .filter((id): id is number => Number.isFinite(id) && id > 0),
    ),
  ];
  if (ids.length === 0) return false;

  const uncached = ids.filter((id) => !categoryCache.has(id));

  if (uncached.length > 0) {
    try {
      const { rows } = await query(
        `SELECT c.id, c.slug, p.slug AS parent_slug
         FROM categories c
         LEFT JOIN categories p ON p.id = c.parent_id
         WHERE c.id = ANY($1::int[])`,
        [uncached],
      );

      for (const category of rows) {
        const categorySlug = String(category.slug).toLowerCase();
        const parentSlug = category.parent_slug
          ? String(category.parent_slug).toLowerCase()
          : null;

        const isRestaurant =
          FOOD_RELATED_SLUGS.some((slug) => categorySlug.includes(slug)) ||
          (parentSlug !== null &&
            FOOD_RELATED_SLUGS.some((slug) => parentSlug.includes(slug)));

        categoryCache.set(Number(category.id), {
          slug: categorySlug,
          parentSlug,
          isRestaurant,
        });
      }
    } catch (error) {
      console.error("[CATEGORY] Error checking restaurant category:", error);
      return false;
    }
  }

  return ids.some((id) => categoryCache.get(id)?.isRestaurant === true);
}

/**
 * Clear the category cache (useful for testing or server restarts)
 */
export function clearCategoryCache(): void {
  categoryCache.clear();
}
