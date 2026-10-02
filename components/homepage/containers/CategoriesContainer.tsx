import { query } from "@/lib/db";
import { FeaturedCategoriesSection } from "@/components/homepage/FeaturedCategoriesSection";
import type { GradientStyle } from "@/lib/utils/gradientStyles";

export async function CategoriesContainer() {
  try {
    const [viewResult, tableResult] = await Promise.all([
      query(
        `SELECT id, name, slug, parent_id, icon_name, published_listing_count
       FROM categories_with_published_listing_count
       ORDER BY name ASC`,
      ),
      query(
        `SELECT id, parent_id, show_in_featured, is_enabled, icon_name, category_type, display_order, slug, gradient_style
       FROM categories
       WHERE show_in_featured = true AND is_enabled = true AND category_type = ANY($1) AND slug != 'events'
       ORDER BY display_order ASC NULLS LAST, name ASC`,
        [["listing", "both"]],
      ),
    ]);

    const categoriesView = viewResult.rows.map((row) => ({
      ...row,
      id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
      parent_id:
        row.parent_id !== null && row.parent_id !== undefined
          ? Number(row.parent_id)
          : row.parent_id,
      published_listing_count:
        row.published_listing_count !== null &&
        row.published_listing_count !== undefined
          ? Number(row.published_listing_count)
          : row.published_listing_count,
    }));
    const categoriesTable = tableResult.rows.map((row) => ({
      ...row,
      id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
      parent_id:
        row.parent_id !== null && row.parent_id !== undefined
          ? Number(row.parent_id)
          : row.parent_id,
    }));

    // Build a map of category counts including subcategory aggregation
    const categoryCountMap = new Map<number, number>();

    // First, populate direct counts from the view
    (categoriesView || []).forEach((cat) => {
      if (cat.id !== null && cat.published_listing_count !== null) {
        categoryCountMap.set(
          cat.id as number,
          cat.published_listing_count as number,
        );
      }
    });

    // Then, aggregate subcategory counts for parent categories
    // This matches the behavior in app/listings/[slug]/page.tsx (lines 53-64)
    (categoriesView || []).forEach((cat) => {
      if (cat.id !== null && cat.parent_id === null) {
        // This is a parent category - sum up its own count + all subcategory counts
        const parentId = cat.id as number;
        let totalCount = categoryCountMap.get(parentId) || 0;

        // Add counts from all subcategories
        (categoriesView || []).forEach((subCat) => {
          if (subCat.parent_id === parentId && subCat.id !== null) {
            totalCount += categoryCountMap.get(subCat.id as number) || 0;
          }
        });

        categoryCountMap.set(parentId, totalCount);
      }
    });

    const categories = (categoriesView || [])
      .map((cat) => {
        // Find matching row in categories table for filtering fields
        const meta = (categoriesTable || []).find((c) => c.id === cat.id);
        return meta &&
          cat.id !== null &&
          cat.name !== null &&
          cat.slug !== null &&
          cat.published_listing_count !== null
          ? {
              id: cat.id as number,
              name: cat.name as string,
              slug: cat.slug as string,
              published_listing_count:
                categoryCountMap.get(cat.id as number) || 0,
              icon_name: meta.icon_name,
              category_type: meta.category_type,
              gradient_style:
                (meta.gradient_style as GradientStyle | null) || null,
            }
          : null;
      })
      .filter(
        (
          c,
        ): c is {
          id: number;
          name: string;
          slug: string;
          published_listing_count: number;
          icon_name: string | null;
          category_type: string;
          gradient_style: GradientStyle | null;
        } => !!c && c.published_listing_count > 0,
      );

    return <FeaturedCategoriesSection categories={categories} />;
  } catch (error) {
    console.error("Featured categories fetch failed:", error);
    return <FeaturedCategoriesSection categories={[]} />;
  }
}
