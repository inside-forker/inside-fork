import { notFound, redirect } from "next/navigation";
import { PremiumListingsGrid } from "@/components/listings/PremiumListingsGrid";
import { FeaturedListingsCarousel } from "@/components/listings/FeaturedListingsCarousel";
import { PremiumListingsHeaderInline as PremiumListingsHeader } from "@/components/listings/PremiumListingsHeaderInline";
import { getNearbyListings } from "@/app/actions/nearby-listings";
import { sanitizeSearchTerm } from "@/lib/utils/search-sanitization";
import { buildGridSearchParams } from "@/lib/utils/listings-filters";
import {
  compareSearchRankThenIds,
  stableReorderBySearchRank,
} from "@/lib/listings/search-relevance";
import { OPEN_NOW_EXISTS_CLAUSE } from "@/lib/listings/query-paginated-listings";
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

  const searchTermResolved = resolvedSearchParams.search
    ? sanitizeSearchTerm(resolvedSearchParams.search)
    : "";

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

  // Pre-compute category ids in scope (self + subcategories if a parent) for
  // filtering via the listing_categories junction table - a listing tagged
  // with this category only as a secondary category must still match.
  const categoryIdsForFilter = await resolveCategoryIdScope(category.id);

  // Build the WHERE clause dynamically
  const whereClauses: string[] = ["status = 'published'", "is_featured = false"];
  const queryParams: unknown[] = [];

  // Filter by category ids via the junction table
  queryParams.push(categoryIdsForFilter);
  whereClauses.push(
    listingCategoriesExistsClause(
      "listings_with_details.id",
      queryParams.length,
    ),
  );

  // Apply search filter
  if (resolvedSearchParams.search && searchTermResolved) {
    queryParams.push(`%${searchTermResolved}%`);
    const idx = queryParams.length;
    whereClauses.push(`(name ILIKE $${idx} OR description ILIKE $${idx} OR address ILIKE $${idx})`);
  }

  // Apply rating filter
  if (resolvedSearchParams.rating) {
    const rating = parseFloat(resolvedSearchParams.rating);
    if (!Number.isNaN(rating)) {
      queryParams.push(rating);
      whereClauses.push(`avg_rating >= $${queryParams.length}`);
    }
  }

  // Apply open-now filter
  if (resolvedSearchParams.open_now === "true") {
    whereClauses.push(OPEN_NOW_EXISTS_CLAUSE);
  }

  // Apply deals filter
  const sortRequiresDeals = (sortKey: string | undefined): boolean => {
    return sortKey === "max-discount" || sortKey === "best-deals";
  };

  const needsDealsFilter =
    resolvedSearchParams.deals === "true" ||
    !!resolvedSearchParams.bank ||
    !!resolvedSearchParams.card ||
    sortRequiresDeals(resolvedSearchParams.sort);

  const maxDiscountByListingId: Record<number, number> = {};
  let dealFilteredIdsForFilter: number[] | null = null;

  if (needsDealsFilter) {
    const { rows: dealRows } = await query(
      "SELECT listing_id, discount_value, is_active, bank_id, valid_card_variants, end_date FROM deals"
    );

    const nowMs = Date.now();
    const bankId = resolvedSearchParams.bank
      ? parseInt(resolvedSearchParams.bank, 10)
      : null;
    const cardId = resolvedSearchParams.card
      ? parseInt(resolvedSearchParams.card, 10)
      : null;

    const filteredListingIds = new Set<number>();

    dealRows.forEach((deal) => {
      if (deal.listing_id == null) return;

      const lid = deal.listing_id;
      const endMs = deal.end_date
        ? Date.parse(deal.end_date)
        : Number.POSITIVE_INFINITY;
      const isActiveNow = deal.is_active && endMs >= nowMs;

      let numericDiscount = 0;
      if (deal.discount_value) {
        const m = String(deal.discount_value).match(/(\d+)(?=%)/);
        if (m) numericDiscount = parseInt(m[1], 10);
      }
      maxDiscountByListingId[lid] = Math.max(
        maxDiscountByListingId[lid] || 0,
        numericDiscount,
      );

      const bankMatch =
        bankId != null && !Number.isNaN(bankId)
          ? deal.bank_id === bankId
          : true;
      const cardMatch =
        cardId != null && !Number.isNaN(cardId)
          ? Array.isArray(deal.valid_card_variants) &&
            deal.valid_card_variants.includes(cardId)
          : true;
      const dealsMatch =
        resolvedSearchParams.deals === "true" ? isActiveNow : true;

      if (dealsMatch && bankMatch && cardMatch) {
        filteredListingIds.add(lid);
      }
    });

    dealFilteredIdsForFilter = Array.from(filteredListingIds);
    if (dealFilteredIdsForFilter.length === 0) {
      whereClauses.push("id = -1");
    } else {
      queryParams.push(dealFilteredIdsForFilter);
      whereClauses.push(`id = ANY($${queryParams.length})`);
    }
  }

  // Count query helper
  const getFilteredCount = async () => {
    const countWhere = [...whereClauses].join(" AND ");
    const { rows } = await query(
      `SELECT COUNT(*)::integer AS total FROM listings_with_details WHERE ${countWhere}`,
      queryParams
    );
    return rows[0]?.total || 0;
  };

  // Determine Sorting & Pagination
  let orderByClause = "ORDER BY is_featured DESC, avg_rating DESC, id ASC";
  switch (resolvedSearchParams.sort) {
    case "rating":
      orderByClause = "ORDER BY avg_rating DESC, id ASC";
      break;
    case "newest":
      orderByClause = "ORDER BY created_at DESC, id ASC";
      break;
    case "name":
      orderByClause = "ORDER BY name ASC, id ASC";
      break;
  }

  const INITIAL_PAGE_SIZE = 12;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listings: any[] = [];
  let totalCount = 0;

  // Fetch listings (Distance sort requires PostGIS flow)
  if (
    resolvedSearchParams.sort === "distance" &&
    resolvedSearchParams.lat &&
    resolvedSearchParams.lng
  ) {
    const lat = parseFloat(resolvedSearchParams.lat);
    const lng = parseFloat(resolvedSearchParams.lng);

    if (!isNaN(lat) && !isNaN(lng)) {
      const nearbyResult = await getNearbyListings({
        lat,
        lng,
        radius: 50000,
        limit: INITIAL_PAGE_SIZE,
      });

      if (nearbyResult.success && nearbyResult.data.length > 0) {
        const nearbyIds = nearbyResult.data.map((item) => item.id);
        
        // Fetch detailed listings for nearby IDs
        const nearbyParams = [...queryParams, nearbyIds];
        const nearbyWhere = [...whereClauses, `id = ANY($${nearbyParams.length})`].join(" AND ");
        
        const { rows: nearbyListings } = await query(
          `SELECT * FROM listings_with_details WHERE ${nearbyWhere}`,
          nearbyParams
        );

        const distanceMap = new Map(
          nearbyResult.data.map((item) => [item.id, item.distance_meters])
        );

        listings = nearbyListings.map((listing) => ({
          ...listing,
          distance_meters: distanceMap.get(listing.id as number),
        }));

        listings.sort((a, b) => {
          const distA = (a.distance_meters as number | undefined) ?? Infinity;
          const distB = (b.distance_meters as number | undefined) ?? Infinity;
          return compareSearchRankThenIds(
            a,
            b,
            resolvedSearchParams.search,
            distA - distB,
          );
        });

        totalCount = await getFilteredCount();
      }
    }
  } else {
    // Normal query with pagination
    totalCount = await getFilteredCount();

    const normalWhere = whereClauses.join(" AND ");
    const { rows } = await query(
      `SELECT * FROM listings_with_details WHERE ${normalWhere} ${orderByClause} LIMIT ${INITIAL_PAGE_SIZE}`,
      queryParams
    );
    listings = rows;
  }

  // Handle deals sort and search relevance
  if (sortRequiresDeals(resolvedSearchParams.sort)) {
    listings = [...listings].sort((a, b) => {
      const discountA = a.id != null ? maxDiscountByListingId[a.id] || 0 : 0;
      const discountB = b.id != null ? maxDiscountByListingId[b.id] || 0 : 0;
      return compareSearchRankThenIds(
        a,
        b,
        resolvedSearchParams.search,
        discountB - discountA,
      );
    });
  }

  if (
    resolvedSearchParams.search &&
    resolvedSearchParams.sort !== "distance" &&
    !sortRequiresDeals(resolvedSearchParams.sort)
  ) {
    listings = stableReorderBySearchRank(listings, resolvedSearchParams.search);
  }

  // Fetch featured listings separately
  const { rows: featuredListingsRaw } = await query(
    `SELECT * FROM listings_with_details
     WHERE status = 'published' AND is_featured = true AND ${listingCategoriesExistsClause("listings_with_details.id", 1)}
     ORDER BY avg_rating DESC LIMIT 20`,
    [categoryIdsForFilter]
  );

  // Fetch images for all listed items
  const allListingIds = new Array<number>();
  listings.forEach((l) => l.id && allListingIds.push(l.id));
  featuredListingsRaw.forEach((l) => l.id && allListingIds.push(l.id));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imagesMap: Record<number, any[]> = {};

  if (allListingIds.length > 0) {
    const { rows: allImages } = await query(
      "SELECT * FROM listing_images WHERE listing_id = ANY($1) ORDER BY display_order ASC",
      [allListingIds]
    );
    allImages.forEach((img) => {
      if (!imagesMap[img.listing_id]) {
        imagesMap[img.listing_id] = [];
      }
      imagesMap[img.listing_id].push(img);
    });
  }

  // Enrich listings
  let gridListings = listings.map((l) => ({
    ...l,
    images: imagesMap[l.id] || [],
    favorited: false,
  }));

  let featuredListings = featuredListingsRaw.map((l) => ({
    ...l,
    images: imagesMap[l.id] || [],
    favorited: false,
  }));

  // Hydrate favorites
  try {
    const session = await getSessionFromCookies();
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

  // Fetch header categories
  const { rows: categoriesData } = await query(
    `SELECT id, name, slug, parent_id, icon_name 
     FROM categories 
     WHERE is_enabled = true AND show_in_filters = true AND category_type IN ('listing', 'both') AND slug != 'events' 
     ORDER BY display_order ASC, name ASC LIMIT 200`
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

      <div className="container mx-auto px-6 lg:px-8 py-12 space-y-12">
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
