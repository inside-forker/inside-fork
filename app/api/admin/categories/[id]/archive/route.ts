import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/categories/[id]/archive
 * Archive or unarchive a category (parent or subcategory) and all listings within its hierarchy.
 *
 * Body: {
 *   action: "archive" | "unarchive",
 *   archiveListings?: boolean,
 *   unarchiveListings?: boolean
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id, 10);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: "Invalid category ID" },
        { status: 400 }
      );
    }

    // Verify authentication
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin / super_admin role
    const { rows: profileRows } = await query(
      "SELECT role FROM profiles WHERE id = $1 LIMIT 1",
      [session.userId]
    );
    const profile = profileRows[0] as { role: string } | undefined;

    if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
      return NextResponse.json(
        { error: "Access denied. Admin role required." },
        { status: 403 }
      );
    }

    // Fetch category
    const { rows: catRows } = await query(
      "SELECT id, name, slug, parent_id, is_enabled FROM public.categories WHERE id = $1 LIMIT 1",
      [categoryId]
    );
    const category = catRows[0] as { id: number; name: string; slug: string; parent_id: number | null; is_enabled: boolean } | undefined;

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action === "unarchive" ? "unarchive" : "archive";
    const shouldArchiveListings = body.archiveListings !== false;
    const shouldUnarchiveListings = body.unarchiveListings === true;

    // Resolve all category IDs in scope (self + all descendant subcategories)
    const { rows: treeRows } = await query(
      `WITH RECURSIVE cat_tree AS (
        SELECT id FROM public.categories WHERE id = $1
        UNION ALL
        SELECT c.id FROM public.categories c JOIN cat_tree ct ON c.parent_id = ct.id
      )
      SELECT id FROM cat_tree`,
      [categoryId]
    );
    const categoryIdsInScope = treeRows.map((r) => Number(r.id));

    if (action === "archive") {
      let archivedListingsCount = 0;

      if (shouldArchiveListings && categoryIdsInScope.length > 0) {
        // Find all published or draft listings in this category or any junction
        const { rows: listingMatches } = await query(
          `SELECT DISTINCT l.id
           FROM public.listings l
           LEFT JOIN public.listing_categories lc ON lc.listing_id = l.id
           WHERE (l.category_id = ANY($1) OR lc.category_id = ANY($1))
             AND l.status != 'archived'`,
          [categoryIdsInScope]
        );

        const listingIdsToArchive = listingMatches.map((r) => Number(r.id));

        if (listingIdsToArchive.length > 0) {
          const { rowCount } = await query(
            `UPDATE public.listings
             SET status = 'archived', updated_at = NOW()
             WHERE id = ANY($1) AND status != 'archived'`,
            [listingIdsToArchive]
          );
          archivedListingsCount = rowCount || listingIdsToArchive.length;
        }
      }

      // Mark the category and its subcategories disabled
      const { rowCount: categoriesArchivedCount } = await query(
        `UPDATE public.categories
         SET is_enabled = false
         WHERE id = ANY($1)`,
        [categoryIdsInScope]
      );

      // Log audit
      await logAuditEvent({
        admin_id: session.userId,
        action: "category_archived",
        entity_type: "category",
        entity_id: categoryId.toString(),
        new_values: {
          category_id: categoryId,
          name: category.name,
          categories_affected: categoryIdsInScope,
          archived_listings_count: archivedListingsCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully archived "${category.name}"${
          archivedListingsCount > 0 ? ` and ${archivedListingsCount} listings` : ""
        }.`,
        archivedListingsCount,
        archivedCategoriesCount: categoriesArchivedCount || categoryIdsInScope.length,
      });
    } else {
      // UNARCHIVE
      let unarchivedListingsCount = 0;

      if (shouldUnarchiveListings && categoryIdsInScope.length > 0) {
        const { rows: listingMatches } = await query(
          `SELECT DISTINCT l.id
           FROM public.listings l
           LEFT JOIN public.listing_categories lc ON lc.listing_id = l.id
           WHERE (l.category_id = ANY($1) OR lc.category_id = ANY($1))
             AND l.status = 'archived'`,
          [categoryIdsInScope]
        );

        const listingIdsToUnarchive = listingMatches.map((r) => Number(r.id));

        if (listingIdsToUnarchive.length > 0) {
          const { rowCount } = await query(
            `UPDATE public.listings
             SET status = 'published', updated_at = NOW()
             WHERE id = ANY($1) AND status = 'archived'`,
            [listingIdsToUnarchive]
          );
          unarchivedListingsCount = rowCount || listingIdsToUnarchive.length;
        }
      }

      // Re-enable the category and its subcategories
      const { rowCount: categoriesUnarchivedCount } = await query(
        `UPDATE public.categories
         SET is_enabled = true
         WHERE id = ANY($1)`,
        [categoryIdsInScope]
      );

      // If unarchiving a subcategory, ensure all parent/ancestor categories are also enabled
      await query(
        `WITH RECURSIVE cat_ancestors AS (
          SELECT parent_id FROM public.categories WHERE id = $1 AND parent_id IS NOT NULL
          UNION ALL
          SELECT c.parent_id FROM public.categories c JOIN cat_ancestors ca ON c.id = ca.parent_id WHERE c.parent_id IS NOT NULL
        )
        UPDATE public.categories
        SET is_enabled = true
        WHERE id IN (SELECT parent_id FROM cat_ancestors)`,
        [categoryId]
      );

      // Log audit
      await logAuditEvent({
        admin_id: session.userId,
        action: "category_unarchived",
        entity_type: "category",
        entity_id: categoryId.toString(),
        new_values: {
          category_id: categoryId,
          name: category.name,
          categories_affected: categoryIdsInScope,
          unarchived_listings_count: unarchivedListingsCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully unarchived "${category.name}"${
          unarchivedListingsCount > 0 ? ` and restored ${unarchivedListingsCount} listings to published` : ""
        }.`,
        unarchivedListingsCount,
        unarchivedCategoriesCount: categoriesUnarchivedCount || categoryIdsInScope.length,
      });
    }
  } catch (error) {
    console.error("Error archiving category:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process category archive request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
