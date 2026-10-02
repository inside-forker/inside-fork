import { PremiumListingsGrid } from "@/components/listings/PremiumListingsGrid";
import { FeaturedListingsCarousel } from "@/components/listings/FeaturedListingsCarousel";
import { PremiumListingsHeaderInline as PremiumListingsHeader } from "@/components/listings/PremiumListingsHeaderInline";
import { Database } from "@/types/database";
import { buildGridSearchParams } from "@/lib/utils/listings-filters";
import { query } from "@/lib/db";
import {
  queryPaginatedListings,
  attachListingImages,
} from "@/lib/listings/query-paginated-listings";

// Enable ISR with 60 second revalidation for listings page
export const revalidate = 60;

// Use proper Supabase types
type Listing = Database["public"]["Views"]["listings_with_details"]["Row"] & {
  distance_meters?: number;
};

const GRID_PAGE_SIZE = 12;
const FEATURED_CAROUSEL_LIMIT = 10;

interface ListingsPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
    rating?: string;
    category?: string;
    deals?: string;
    bank?: string;
    card?: string;
    open_now?: string;
    near?: string;
    sub?: string;
    lat?: string;
    lng?: string;
  }>;
}

export default async function ListingsPage({
  searchParams,
}: ListingsPageProps) {
  const resolvedSearchParams = await searchParams;

  // Sub-category slug, when present, always takes precedence over the
  // parent category (matches queryPaginatedListings' resolveCategoryNames:
  // a subcategory slug resolves to just its own name, a parent category
  // slug expands to itself + all its children).
  const categorySlugForQuery =
    resolvedSearchParams.sub || resolvedSearchParams.category;

  const isDealsFilterActive =
    resolvedSearchParams.deals === "true" ||
    resolvedSearchParams.deals === "1" ||
    resolvedSearchParams.deals === "";

  // The featured carousel (and excluding featured items from the main grid)
  // only applies to the default, unfiltered view.
  const hasActiveFilters = Boolean(
    resolvedSearchParams.search ||
      resolvedSearchParams.category ||
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

  const mainResult = await queryPaginatedListings({
    page: 1,
    limit: GRID_PAGE_SIZE,
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

  let mainListings = mainResult.listings as unknown as Listing[];

  let featuredListings: Listing[] = [];
  if (showFeaturedCarousel) {
    const { rows: featuredRows } = await query(
      `SELECT * FROM listings_with_details
       WHERE status = 'published' AND is_featured = true
       ORDER BY display_order DESC NULLS LAST, created_at DESC, id DESC
       LIMIT $1`,
      [FEATURED_CAROUSEL_LIMIT],
    );
    const normalizedFeaturedRows = featuredRows.map((row) => ({
      ...row,
      id: row.id !== null && row.id !== undefined ? Number(row.id) : row.id,
    }));
    featuredListings = (await attachListingImages(
      normalizedFeaturedRows as Array<Record<string, unknown> & { id?: number | null }>,
    )) as unknown as Listing[];
  }

  const { rows: categoriesData } = await query(
    `SELECT id, name, slug, parent_id, icon_name
     FROM categories
     WHERE show_in_filters = true
       AND is_enabled = true
       AND category_type IN ('listing', 'both')
       AND slug <> 'events'
     ORDER BY name ASC
     LIMIT 200`,
  );

  // Hydrate favorite flags server-side for the current user to avoid client round-trips
  try {
    const { getFavoritedListingIdsForUser } =
      await import("@/lib/utils/favorites-server");
    const allIds = [...mainListings, ...featuredListings]
      .map((l) => l.id)
      .filter((id): id is number => id !== null && id !== undefined);
    const favSet = await getFavoritedListingIdsForUser(null, allIds);
    mainListings = mainListings.map((l) => ({
      ...l,
      favorited: l.id !== null && favSet.has(l.id as number),
    }));
    featuredListings = featuredListings.map((l) => ({
      ...l,
      favorited: l.id !== null && favSet.has(l.id as number),
    }));
  } catch (err) {
    console.error("Failed to hydrate favorites for listings page", err);
  }

  // Conform to PremiumListingsGrid expected searchParams shape
  const gridSearchParams = buildGridSearchParams(
    {
      search: resolvedSearchParams.search,
      sort: resolvedSearchParams.sort,
      rating: resolvedSearchParams.rating,
      category: resolvedSearchParams.category,
      sub: resolvedSearchParams.sub,
      deals: resolvedSearchParams.deals,
      bank: resolvedSearchParams.bank,
      card: resolvedSearchParams.card,
      open_now: resolvedSearchParams.open_now,
      near: resolvedSearchParams.near,
      lat: resolvedSearchParams.lat,
      lng: resolvedSearchParams.lng,
    },
    resolvedSearchParams.category,
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
          ...(categoriesData || []),
        ]}
      />

      <div className="container mx-auto px-6 lg:px-8 py-12 space-y-12">
        {/* Featured Listings Carousel - Only show if we have featured listings and no specific filters */}
        {featuredListings.length > 0 && showFeaturedCarousel && (
          <FeaturedListingsCarousel featuredListings={featuredListings} />
        )}

        {/* Main Listings Grid */}
        <div>
          <PremiumListingsGrid
            listings={mainListings
              .filter((l) => l.id !== null)
              .map((l) => ({ ...l, id: l.id as number }))}
            totalCount={mainResult.totalItems}
            excludeFeaturedFromApi={showFeaturedCarousel}
            searchParams={gridSearchParams}
          />
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ searchParams }: ListingsPageProps) {
  const resolvedSearchParams = await searchParams;
  let title = "All Listings - Inside Karachi";
  let description = "Discover all the amazing places in Karachi";

  if (resolvedSearchParams.search) {
    title = `Search results for "${resolvedSearchParams.search}" - Inside Karachi`;
    description = `Find places matching "${resolvedSearchParams.search}" in Karachi`;
  } else if (resolvedSearchParams.category) {
    title = `${resolvedSearchParams.category} Listings - Inside Karachi`;
    description = `Discover the best ${resolvedSearchParams.category} places in Karachi`;
  }

  return {
    title,
    description,
  };
}
