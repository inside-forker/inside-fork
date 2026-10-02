import { NextRequest, NextResponse } from "next/server";
import { queryPaginatedListings } from "@/lib/listings/query-paginated-listings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "9", 10)),
    );

    const subSlug = searchParams.get("sub") || searchParams.get("subCategory");
    const categorySlug = subSlug || searchParams.get("category");
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");

    const result = await queryPaginatedListings({
      page,
      limit,
      categorySlug,
      search: searchParams.get("search"),
      sort: searchParams.get("sort") || "featured",
      minRating: searchParams.get("rating"),
      dealsOnly:
        searchParams.get("deals") === "true" ||
        searchParams.get("deals") === "1" ||
        (searchParams.has("deals") && searchParams.get("deals") === ""),
      bankParam: searchParams.get("bank"),
      cardParam: searchParams.get("card"),
      openNow: searchParams.get("open_now") === "true",
      excludeFeatured: searchParams.get("exclude_featured") === "true",
      lat: Number.isNaN(lat) ? undefined : lat,
      lng: Number.isNaN(lng) ? undefined : lng,
    });

    return NextResponse.json({
      listings: result.listings,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    });
  } catch (err) {
    console.error("Listings API unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch listings",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
