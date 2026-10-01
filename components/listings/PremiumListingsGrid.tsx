"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { ListingCard as PremiumListingCard } from "@/components/listings/ListingCard";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PremiumPagination } from "./PremiumPagination";
import {
  type ListingsFilterParams,
  getCanonicalSubParam,
} from "@/lib/utils/listings-filters";

import { Grid3X3, ChevronDown, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Permissive types to allow enriched & filtered listing objects
interface Listing {
  id: number;
  name: string | null;
  slug: string | null;
  description: string | null;
  address: string | null;
  phone_number: string | null;
  website: string | null;
  category_name: string | null;
  is_featured: boolean | null;
  avg_rating: number | string | null;
  review_count: number | null;
  [key: string]: unknown;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PremiumListingsGridProps {
  /** Initial listings from server - supports both old 'listings' prop and new 'initialListings' */
  listings?: Listing[];
  initialListings?: Listing[];
  /** Total count from server (optional - defaults to listings.length for backward compat) */
  totalCount?: number;
  /** Category slug for API calls */
  categorySlug?: string;
  /** When true, paginated API excludes featured items to keep parity with SSR grid dataset. */
  excludeFeaturedFromApi?: boolean;
  /** Search params for display */
  searchParams: ListingsFilterParams;
}

const ITEMS_PER_PAGE_OPTIONS = [9, 12, 18, 24];
const CARDS_PER_ROW_OPTIONS = [
  { value: 2, label: "2 per row", grid: "grid-cols-1 md:grid-cols-2" },
  {
    value: 3,
    label: "3 per row",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  },
  {
    value: 4,
    label: "4 per row",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  },
  {
    value: 5,
    label: "5 per row",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5",
  },
];

export function PremiumListingsGrid({
  listings: legacyListings,
  initialListings,
  totalCount,
  categorySlug,
  excludeFeaturedFromApi = false,
  searchParams,
}: PremiumListingsGridProps) {
  const urlSearchParams = useSearchParams();
  const pathname = usePathname();

  // Support both old 'listings' prop and new 'initialListings' for backward compatibility
  // useMemo to prevent unnecessary re-renders
  const serverListings = useMemo(
    () => initialListings || legacyListings || [],
    [initialListings, legacyListings]
  );
  const serverTotalCount = useMemo(
    () => totalCount ?? serverListings.length,
    [totalCount, serverListings.length]
  );

  // Layout state
  const [cardsPerRow, setCardsPerRow] = useState(4);

  // Standardize default items per page to 12 to match server and avoid hydration mismatch
  // 12 is also a better common multiple for responsive grids (divisible by 2, 3, 4)
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Track if this is the initial mount to prevent double fetching
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Data state - start with ONLY first page, not all server data
  const [listings, setListings] = useState<Listing[]>(() =>
    serverListings.slice(0, 12)
  );
  const [pagination, setPagination] = useState<PaginationInfo>(() => {
    const defaultLimit = 12;
    return {
      page: 1,
      limit: defaultLimit,
      totalItems: serverTotalCount,
      totalPages: Math.ceil(serverTotalCount / defaultLimit),
      hasNextPage: serverTotalCount > defaultLimit,
      hasPrevPage: false,
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const activeRequestIdRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Initialize page from URL (critical for back button navigation)
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = urlSearchParams.get("page");
    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (!isNaN(page) && page > 0) {
        return page;
      }
    }
    return 1;
  });

  // Fetch listings on initial mount if URL has page > 1
  useEffect(() => {
    const pageParam = urlSearchParams.get("page");
    const urlPage = pageParam ? parseInt(pageParam, 10) : 1;

    // On mount, if URL has page > 1, fetch that page immediately
    if (urlPage > 1 && isInitialMount) {
      fetchListings(urlPage, itemsPerPage);
    }

    setIsInitialMount(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch listings from API
  const fetchListings = useCallback(
    async (page: number, limit: number) => {
      const requestId = ++activeRequestIdRef.current;
      activeAbortControllerRef.current?.abort();
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      setIsLoading(true);
      try {
        // Start from URL to preserve full active filter contract across pagination.
        const params = new URLSearchParams(urlSearchParams.toString());
        params.set("page", page.toString());
        params.set("limit", limit.toString());

        // Use categorySlug prop OR searchParams.category for filtering
        const effectiveCategory = categorySlug || searchParams.category;
        if (effectiveCategory && effectiveCategory !== "all") {
          params.set("category", effectiveCategory);
        } else {
          params.delete("category");
        }

        if (excludeFeaturedFromApi) {
          params.set("exclude_featured", "true");
        } else {
          params.delete("exclude_featured");
        }

        // Canonicalize legacy key to prevent state drift between filter UIs.
        const canonicalSub = getCanonicalSubParam(params);
        if (canonicalSub && !params.get("sub")) {
          params.set("sub", canonicalSub);
        }
        params.delete("subCategory");

        const response = await fetch(
          `/api/listings/paginated?${params.toString()}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch listings");
        }

        const data = await response.json();
        if (requestId !== activeRequestIdRef.current) {
          return;
        }
        setListings(data.listings);
        setPagination(data.pagination);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        if (requestId !== activeRequestIdRef.current) {
          return;
        }
        console.error("Error fetching listings:", error);
      } finally {
        if (requestId === activeRequestIdRef.current) {
          setIsLoading(false);
          if (activeAbortControllerRef.current === controller) {
            activeAbortControllerRef.current = null;
          }
        }
      }
    },
    [
      categorySlug,
      excludeFeaturedFromApi,
      searchParams.category,
      urlSearchParams,
    ]
  );

  // Ensure no in-flight request can update state after unmount.
  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
    };
  }, []);

  // Sync with URL changes - handles browser back/forward navigation.
  // We use pushState for pagination, so this reacts to real history navigation.
  useEffect(() => {
    // Skip if still on initial mount
    if (isInitialMount) {
      return;
    }

    const pageParam = urlSearchParams.get("page");
    const urlPage = pageParam ? parseInt(pageParam, 10) : 1;

    // Only fetch if the URL page differs from current page
    // This handles browser back/forward navigation
    if (!isNaN(urlPage) && urlPage > 0 && urlPage !== currentPage) {
      setCurrentPage(urlPage);
      fetchListings(urlPage, itemsPerPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearchParams]); // Only react to URL changes (navigation/back/forward)

  // Handle page change - updates URL and fetches data
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage === currentPage) return; // Prevent duplicate calls

      setCurrentPage(newPage);

      // Update URL using pushState for navigable page history.
      // We still fetch via API, so no full server navigation is triggered.
      const params = new URLSearchParams(window.location.search);
      if (newPage > 1) {
        params.set("page", newPage.toString());
      } else {
        params.delete("page");
      }
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;

      // Use pushState so browser back/forward can navigate pagination states.
      window.history.pushState(
        { ...window.history.state, page: newPage },
        "",
        newUrl
      );

      // Scroll to top of grid
      const gridElement = document.getElementById("listings-grid");
      if (gridElement) {
        gridElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      // Fetch new data via API
      fetchListings(newPage, itemsPerPage);
    },
    [pathname, fetchListings, itemsPerPage, currentPage]
  );

  // Handle items per page change - fetch with new limit
  const handleItemsPerPageChange = useCallback(
    (newLimit: number) => {
      if (newLimit === itemsPerPage) return;

      setItemsPerPage(newLimit);
      setCurrentPage(1);

      // Remove page param from URL since we're going to page 1
      const params = new URLSearchParams(window.location.search);
      params.delete("page");
      const newUrl = params.toString()
        ? `${pathname}?${params.toString()}`
        : pathname;
      // Keep page-size changes in history as well for predictable back behavior.
      window.history.pushState(
        { ...window.history.state, page: 1 },
        "",
        newUrl
      );

      // Fetch with new limit immediately (don't rely on state update)
      fetchListings(1, newLimit);
    },
    [itemsPerPage, pathname, fetchListings]
  );

  // Track previous serverListings to detect actual data changes
  const prevServerListingsRef = useRef<Listing[]>(serverListings);
  const prevServerListingsLengthRef = useRef<number>(serverListings.length);

  // Reset data ONLY when serverListings actually change (new server render with different data)
  // Not when itemsPerPage changes - that's handled by handleItemsPerPageChange
  // Not when navigating back - that's handled by URL sync effect
  useEffect(() => {
    // Check if serverListings actually changed (compare length and first/last IDs)
    const isSameReference = prevServerListingsRef.current === serverListings;
    const isSameLength =
      prevServerListingsLengthRef.current === serverListings.length;
    const isSameFirstItem =
      prevServerListingsRef.current[0]?.id === serverListings[0]?.id;
    const isSameLastItem =
      prevServerListingsRef.current[prevServerListingsRef.current.length - 1]
        ?.id === serverListings[serverListings.length - 1]?.id;

    // Only reset if data actually changed (not just re-render or navigation)
    if (
      isSameReference ||
      (isSameLength && isSameFirstItem && isSameLastItem)
    ) {
      return;
    }

    prevServerListingsRef.current = serverListings;
    prevServerListingsLengthRef.current = serverListings.length;

    // When serverListings change (from actual server re-render with new filters),
    // reset to page 1. Use current itemsPerPage for slicing
    setListings(serverListings.slice(0, itemsPerPage));
    setCurrentPage(1);
    setPagination({
      page: 1,
      limit: itemsPerPage,
      totalItems: serverTotalCount,
      totalPages: Math.ceil(serverTotalCount / itemsPerPage),
      hasNextPage: serverTotalCount > itemsPerPage,
      hasPrevPage: false,
    });
  }, [serverListings, serverTotalCount, itemsPerPage]);

  // Calculate display values
  const totalItems = pagination.totalItems;
  const totalPages = pagination.totalPages;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">
          No listings found
        </h3>
        <p className="text-muted-foreground">
          Try adjusting your search or filters to find what you&apos;re looking
          for.
        </p>
      </div>
    );
  }

  return (
    <div id="listings-grid" className="space-y-8 scroll-mt-24">
      {/* Section Header with Inline Controls */}
      <div
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 animate-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="text-center lg:text-left">
          <div className="flex flex-col items-center justify-center lg:flex-row lg:items-center lg:justify-start gap-2 lg:gap-3 w-full mb-2">
            <div className="p-2 lg:p-3 rounded-2xl bg-primary/10 border border-primary/20 flex-shrink-0 mb-2 lg:mb-0">
              <Building2 className="h-5 w-5 lg:h-6 lg:w-6 text-primary" />
            </div>
            <div className="text-center lg:text-left">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                {searchParams.search ? (
                  <>
                    Search Results for{" "}
                    <span className="gradient-text-primary">
                      &ldquo;{searchParams.search}&rdquo;
                    </span>
                  </>
                ) : (
                  <>
                    All <span className="gradient-text-primary">Listings</span>
                  </>
                )}
              </h2>
            </div>
          </div>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
            {searchParams.search
              ? `Found ${totalItems.toLocaleString()} ${
                  totalItems === 1 ? "place" : "places"
                } matching your search`
              : searchParams.deals === "true" ||
                  searchParams.bank ||
                  searchParams.card
                ? `Discover ${totalItems.toLocaleString()} ${
                    totalItems === 1 ? "place" : "places"
                  } with active card discounts in Karachi`
                : `Discover ${totalItems.toLocaleString()} amazing ${
                    totalItems === 1 ? "place" : "places"
                  } in Karachi`}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 justify-center lg:justify-end">
          {/* Items per page selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">
              Show:
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 hover:shadow-md transition-all duration-200 font-medium"
                  disabled={isLoading}
                >
                  {itemsPerPage}
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[6rem] bg-background/95 backdrop-blur-sm border-border/50"
                sideOffset={5}
                avoidCollisions={true}
                collisionPadding={10}
              >
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => handleItemsPerPageChange(option)}
                    className={cn(
                      "cursor-pointer transition-colors duration-200",
                      itemsPerPage === option
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-primary/5 dark:hover:bg-primary/10"
                    )}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Cards per row selector - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">
              Layout:
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 bg-background/80 backdrop-blur-sm border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 hover:shadow-md transition-all duration-200 font-medium"
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  {
                    CARDS_PER_ROW_OPTIONS.find(
                      (option) => option.value === cardsPerRow
                    )?.label
                  }
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[8rem] bg-background/95 backdrop-blur-sm border-border/50"
                sideOffset={5}
                avoidCollisions={true}
                collisionPadding={10}
              >
                {CARDS_PER_ROW_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setCardsPerRow(option.value)}
                    className={cn(
                      "cursor-pointer transition-colors duration-200",
                      cardsPerRow === option.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-primary/5 dark:hover:bg-primary/10"
                    )}
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Current page info */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-between text-sm text-muted-foreground bg-muted/20 rounded-lg px-4 py-2 animate-fade-in"
          style={{ animationDelay: "0.25s" }}
        >
          <span>
            Page {currentPage} of {totalPages.toLocaleString()}
          </span>
          <span>
            Showing {(startIndex + 1).toLocaleString()}-
            {endIndex.toLocaleString()} of {totalItems.toLocaleString()}
          </span>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">
            Loading listings...
          </span>
        </div>
      )}

      {/* Listings Grid */}
      {!isLoading && (
        <div
          key={`${currentPage}-${itemsPerPage}-${cardsPerRow}`}
          className={cn(
            "grid gap-6",
            CARDS_PER_ROW_OPTIONS.find((option) => option.value === cardsPerRow)
              ?.grid ||
              "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          )}
        >
          {listings.map((listing, index) => (
            <div
              key={listing.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              <PremiumListingCard
                listing={
                  listing as Parameters<typeof PremiumListingCard>[0]["listing"]
                }
                index={index}
                showAnimation={false}
                priority={index < 6}
              />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="animate-fade-in" style={{ animationDelay: "0.35s" }}>
          <PremiumPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
