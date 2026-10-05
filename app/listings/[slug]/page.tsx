import { notFound, redirect } from "next/navigation";
import { PremiumListingsGrid } from "@/components/listings/PremiumListingsGrid";
import { FeaturedListingsCarousel } from "@/components/listings/FeaturedListingsCarousel";
import { PremiumListingsHeaderInline as PremiumListingsHeader } from "@/components/listings/PremiumListingsHeaderInline";
import { buildGridSearchParams } from "@/lib/utils/listings-filters";
import {
  queryPaginatedListings,
  attachListingImages,
} from "@/lib/listings/query-paginated-listings";
import {
  resolveCategoryIdScope,
  listingCategoriesExistsClause,
} from "@/lib/listings/category-scope";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth/session";

interface CategoryListingsPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    search?: string;
    sort?: string;
    rating?: string;
    sub?: string;
    deals?: string;
    bank?: string;
    card?: string;
    open_now?: string;
    near?: string;
    lat?: string;
    lng?: string;
  }>;
}

export default async function CategoryListingsPage({
  params,
  searchParams,
}: CategoryListingsPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  // 1. Fetch the category
  const { rows: categories } = await query(
    "SELECT * FROM categories WHERE slug = $1 LIMIT 1",
    [slug]
  );
  const category = categories[0];

  if (!category) {
    // Listing slugs sometimes land here via mistaken /listings/{slug} links.
    const decodedSlug = decodeURIComponent(slug);
    const { rows: listingMatches } = await query(
      "SELECT id, slug FROM listings WHERE slug = $1 OR slug = $2 LIMIT 1",
      [slug, decodedSlug],
    );
    if (listingMatches[0]) {
      redirect(`/listing/${listingMatches[0].slug || slug}`);
    }

    notFound();
  }

  const categorySlugForQuery = resolvedSearchParams.sub || slug;

  const isDealsFilterActive =
    resolvedSearchParams.deals === "true" ||
    resolvedSearchParams.deals === "1" ||
    resolvedSearchParams.deals === "";

  const hasActiveFilters = Boolean(
    resolvedSearchParams.search ||
      resolvedSearchParams.sub ||
      isDealsFilterActive ||
      resolvedSearchParams.bank ||
      resolvedSearchParams.card ||
      resolvedSearchParams.rating ||
      resolvedSearchParams.open_now === "true" ||
      resolvedSearchParams.near === "1",
  );
  const showFeaturedCarousel = !hasActiveFilters;

  const lat = resolvedSearchParams.lat
    ? parseFloat(resolvedSearchParams.lat)
    : undefined;
  const lng = resolvedSearchParams.lng
    ? parseFloat(resolvedSearchParams.lng)
    : undefined;

  const INITIAL_PAGE_SIZE = 12;

  const mainResult = await queryPaginatedListings({
    page: 1,
    limit: INITIAL_PAGE_SIZE,
    categorySlug: categorySlugForQuery,
    search: resolvedSearchParams.search,
    sort: resolvedSearchParams.sort,
    minRating: resolvedSearchParams.rating,
    dealsOnly: isDealsFilterActive,
    bankParam: resolvedSearchParams.bank,
    cardParam: resolvedSearchParams.card,
    openNow: resolvedSearchParams.open_now === "true",
    excludeFeatured: showFeaturedCarousel,
    lat: Number.isNaN(lat) ? undefined : lat,
    lng: Number.isNaN(lng) ? undefined : lng,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gridListings: any[] = mainResult.listings as any[];
  const totalCount = mainResult.totalItems;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let featuredListings: any[] = [];
  if (showFeaturedCarousel) {
    const categoryIdsForFilter = await resolveCategoryIdScope(category.id);
    const { rows: featuredRows } = await query(
      `SELECT * FROM listings_with_details
       WHERE status = 'published' AND is_featured = true AND ${listingCategoriesExistsClause("listings_with_details.id", 1)}
       ORDER BY avg_rating DESC LIMIT 20`,
      [categoryIdsForFilter]
    );
    const normalizedFeaturedRows = featuredRows.map((row) => ({
      ...row,
      id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
    }));
    featuredListings = (await attachListingImages(
      normalizedFeaturedRows as Array<Record<string, unknown> & { id?: number | null }>,
    )) as unknown as any[];
  }

  // Hydrate favorites
  try {
    const session = await getSessionFromCookies();
    const allListingIds = [
      ...gridListings.map((l) => l.id),
      ...featuredListings.map((l) => l.id),
    ].filter(Boolean);
    if (session && allListingIds.length > 0) {
      const { rows: favRows } = await query(
        "SELECT listing_id FROM favorite_listings WHERE user_id = $1 AND listing_id = ANY($2)",
        [session.userId, allListingIds]
      );
      const favSet = new Set(favRows.map((f) => f.listing_id));
      gridListings = gridListings.map((l) => ({ ...l, favorited: favSet.has(l.id) }));
      featuredListings = featuredListings.map((l) => ({ ...l, favorited: favSet.has(l.id) }));
    }
  } catch (err) {
    console.error("Failed to hydrate favorites for category page", err);
  }

  // Fetch header categories (only active categories with published listings)
  const { rows: categoriesData } = await query(
    `WITH RECURSIVE cat_tree AS (
      SELECT id AS root_id, id FROM categories
      UNION ALL
      SELECT t.root_id, c.id FROM categories c JOIN cat_tree t ON c.parent_id = t.id
    ),
    active_listings AS (
      SELECT id, category_id FROM listings WHERE status = 'published' AND category_id IS NOT NULL
      UNION
      SELECT l.id, lc.category_id FROM listings l JOIN listing_categories lc ON lc.listing_id = l.id WHERE l.status = 'published' AND lc.category_id IS NOT NULL
    ),
    listing_counts AS (
      SELECT t.root_id AS category_id, COUNT(DISTINCT al.id) AS listing_count
      FROM cat_tree t
      JOIN active_listings al ON al.category_id = t.id
      GROUP BY t.root_id
    ),
    direct_listing_counts AS (
      SELECT category_id, COUNT(DISTINCT id) AS direct_count
      FROM active_listings
      GROUP BY category_id
    )
    SELECT c.id, c.name, c.slug, c.parent_id, c.icon_name 
    FROM categories c
    LEFT JOIN listing_counts lc ON lc.category_id = c.id
    LEFT JOIN direct_listing_counts dlc ON dlc.category_id = c.id
    WHERE c.is_enabled = true 
      AND c.show_in_filters = true 
      AND c.category_type IN ('listing', 'both') 
      AND c.slug != 'events' 
      AND (
        (c.parent_id IS NULL AND COALESCE(lc.listing_count, 0) > 0)
        OR
        (c.parent_id IS NOT NULL AND COALESCE(dlc.direct_count, 0) > 0)
      )
    ORDER BY c.display_order ASC, c.name ASC LIMIT 200`
  );

  // Compute SEO title & description
  const getCategoryContent = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentCategory: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoriesList: any[],
  ) => {
    if (!currentCategory || currentCategory.slug === "all") {
      return {
        title: "Discover Karachi",
        description:
          "Explore the best of Karachi — from local favorites to hidden gems, all in one place.",
      };
    }

    const categoryContent: Record<string, { title: string; description: string }> = {
      "eat-drink": {
        title: "Best Restaurants in Karachi",
        description:
          "Discover Karachi's finest dining experiences — from street food gems to upscale restaurants, find your perfect meal.",
      },
      events: {
        title: "Events & Tickets in Karachi",
        description:
          "Find and book tickets for the hottest events, concerts, and experiences happening in Karachi.",
      },
      "where-to-stay": {
        title: "Hotels & Accommodation in Karachi",
        description:
          "Find the perfect place to stay in Karachi — from luxury hotels to budget-friendly options and unique stays.",
      },
      "guides-reviews": {
        title: "Karachi Guides & Reviews",
        description:
          "Expert guides, honest reviews, and insider tips to help you make the most of your time in Karachi.",
      },
      "fitness-healthcare": {
        title: "Fitness & Healthcare in Karachi",
        description:
          "Find gyms, wellness centers, hospitals, and healthcare services to keep you healthy and active in Karachi.",
      },
      education: {
        title: "Educational Institutions in Karachi",
        description:
          "Discover schools, universities, and learning centers offering quality education across Karachi.",
      },
      entertainment: {
        title: "Entertainment & Fun in Karachi",
        description:
          "Find the best entertainment venues, gaming centers, cinemas, and fun activities for all ages in Karachi.",
      },
      shopping: {
        title: "Shopping in Karachi",
        description:
          "Explore Karachi's shopping scene — from modern malls to traditional bazaars and specialty stores.",
      },
      "things-to-do": {
        title: "Things to Do in Karachi",
        description:
          "Discover attractions, activities, and experiences that make Karachi special — from beaches to cultural sites.",
      },
    };

    let targetCategory = currentCategory;
    if (currentCategory.parent_id) {
      const parentCategory = categoriesList.find((cat) => cat.id === currentCategory.parent_id);
      if (parentCategory) {
        targetCategory = parentCategory;
      }
    }

    const content = categoryContent[targetCategory.slug];
    if (content) {
      if (currentCategory.parent_id && currentCategory.slug !== targetCategory.slug) {
        return {
          title: `${currentCategory.name} in Karachi`,
          description: content.description,
        };
      }
      return content;
    }

    return {
      title: `${currentCategory.name} in Karachi`,
      description: `Discover the best ${currentCategory.name.toLowerCase()} options in Karachi. Find exactly what you're looking for.`,
    };
  };

  const { title: pageTitle, description: pageDescription } = getCategoryContent(
    category,
    categoriesData
  );

  const gridSearchParams = buildGridSearchParams(
    {
      search: resolvedSearchParams.search,
      sort: resolvedSearchParams.sort,
      rating: resolvedSearchParams.rating,
      sub: resolvedSearchParams.sub,
      deals: resolvedSearchParams.deals,
      bank: resolvedSearchParams.bank,
      card: resolvedSearchParams.card,
      open_now: resolvedSearchParams.open_now,
      near: resolvedSearchParams.near,
      lat: resolvedSearchParams.lat,
      lng: resolvedSearchParams.lng,
    },
    slug,
  );

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PremiumListingsHeader
        categories={[
          {
            id: 0,
            name: "All",
            slug: "all",
            parent_id: null,
            icon_name: "compass",
          },
          ...categoriesData,
        ]}
        currentCategory={category}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 lg:py-12 space-y-5 sm:space-y-8 lg:space-y-12">
        {featuredListings.length > 0 && !resolvedSearchParams.search && (
          <FeaturedListingsCarousel featuredListings={featuredListings} />
        )}

        <div>
          <PremiumListingsGrid
            listings={gridListings}
            totalCount={totalCount}
            excludeFeaturedFromApi={true}
            searchParams={gridSearchParams}
          />
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: CategoryListingsPageProps) {
  const { slug } = await params;
  try {
    const { rows } = await query(
      "SELECT name FROM categories WHERE slug = $1 LIMIT 1",
      [slug]
    );
    const category = rows[0];

    if (!category) {
      return {
        title: "Category Not Found",
      };
    }

    return {
      title: `${category.name} in Karachi - Inside Karachi`,
      description: `Discover the best ${category.name.toLowerCase()} in Karachi. Browse listings, read reviews, and find everything you need in Karachi.`,
    };
  } catch (error) {
    console.error("SEO Metadata category error:", error);
    return {
      title: "Karachi Directory",
    };
  }
}
