"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  Home,
  Search,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Star,
  TrendingUp,
  Percent,
  Tag,
  Clock,
  MapPin,
  Utensils,
  Building,
  ShoppingBag,
  Gamepad2,
  GraduationCap,
  Heart,
  Ticket,
  Compass,
  CreditCard,
  BookOpen,
  Coffee,
  Cake,
  Fish,
  Leaf,
  Crown,
  Truck,
  Zap,
  Sunrise,
  Flame,
  Home as HomeIcon,
  Key,
  Building2,
  Waves,
  Map,
  Lightbulb,
  PiggyBank,
  Award,
  Plane,
  Dumbbell,
  Flower,
  Cross,
  Smile,
  Brain,
  Pill,
  School,
  Users,
  Wrench,
  Library,
  Film,
  FerrisWheel,
  Gamepad,
  Activity,
  Sun,
  Trophy,
  Store,
  Shirt,
  Smartphone,
  Book,
  Gem,
  ShoppingCart,
  Landmark,
  Trees,
  Mountain,
  Anchor,
  Car,
  Camera,
  IceCreamCone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { FilterState } from "./FilterPanel";
import { PremiumDropdown } from "@/components/brand/Dropdown";
import { useFilterData } from "@/hooks/useFilterData";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { FullScreenFilter } from "./FullScreenFilter";
import FilterChip from "@/components/ui/FilterChip";
import { getCanonicalSubParam } from "@/lib/utils/listings-filters";

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon_name?: string | null;
}

interface PremiumListingsHeaderProps {
  categories: Category[];
  currentCategory?: Category | null;
  pageTitle?: string;
  pageDescription?: string;
}

function buildUrl(base: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

const CategoryIcon = ({
  slug,
  iconName,
}: {
  slug: string;
  iconName?: string;
}) => {
  // Comprehensive icon mapping for Lucide React icons
  const iconMap: Record<string, React.ElementType> = {
    // Main category icons
    utensils: Utensils,
    building: Building,
    "shopping-bag": ShoppingBag,
    "gamepad-2": Gamepad2,
    "graduation-cap": GraduationCap,
    heart: Heart,
    ticket: Ticket,
    compass: Compass,
    "book-open": BookOpen,

    // Sub-category icons
    zap: Zap,
    flame: Flame,
    sunrise: Sunrise,
    coffee: Coffee,
    cake: Cake,
    fish: Fish,
    leaf: Leaf,
    crown: Crown,
    truck: Truck,
    home: HomeIcon,
    key: Key,
    "building-2": Building2,
    waves: Waves,
    star: Star,
    map: Map,
    lightbulb: Lightbulb,
    "piggy-bank": PiggyBank,
    award: Award,
    plane: Plane,
    dumbbell: Dumbbell,
    flower: Flower,
    cross: Cross,
    smile: Smile,
    brain: Brain,
    pill: Pill,
    sparkles: Sparkles,
    school: School,
    users: Users,
    wrench: Wrench,
    library: Library,
    film: Film,
    "ferris-wheel": FerrisWheel,
    gamepad: Gamepad,
    activity: Activity,
    sun: Sun,
    trophy: Trophy,
    store: Store,
    shirt: Shirt,
    smartphone: Smartphone,
    book: Book,
    gem: Gem,
    "shopping-cart": ShoppingCart,
    landmark: Landmark,
    trees: Trees,
    mountain: Mountain,
    anchor: Anchor,
    car: Car,
    camera: Camera,
    "ice-cream": IceCreamCone,
  };

  // Use database icon_name if available, otherwise fall back to slug-based mapping
  const iconKey = iconName || slug;
  const Icon = iconMap[iconKey] || iconMap[slug] || Compass;
  return <Icon className="h-4 w-4" />;
};

function isDealsActive(params: { get: (k: string) => string | null; has?: (k: string) => boolean }) {
  const val = params.get("deals");
  return val === "true" || val === "1" || val === "" || (params.has ? params.has("deals") : false);
}

export function PremiumListingsHeaderInline({
  categories,
  currentCategory,
  pageTitle,
  pageDescription,
}: PremiumListingsHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || "",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [showFullScreenFilter, setShowFullScreenFilter] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState<
    string | null
  >(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [userCoordinates, setUserCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Track if we're currently acquiring GPS to prevent sync interference
  const isAcquiringGPS = useRef(false);

  // Geolocation hook for "Nearest" sort option
  const { loading: locationLoading, getLocation } = useGeolocation({
    onSuccess: (lat, lng) => {
      setUserCoordinates({ lat, lng });
      isAcquiringGPS.current = false;
    },
    onError: (_error) => {
      isAcquiringGPS.current = false;
      setLocalFilters((prev) => ({
        ...prev,
        sort: null,
      }));
      setUserCoordinates(null);
    },
  });

  // LOCAL FILTER STATE - doesn't trigger navigation until Apply is clicked
  const [localFilters, setLocalFilters] = useState<FilterState>(() => {
    const isSubcategory =
      currentCategory?.parent_id !== null &&
      currentCategory?.parent_id !== undefined;
    const initialState = {
      sort: searchParams.get("sort"),
      deals: isDealsActive(searchParams),
      open_now: searchParams.get("open_now") === "true",
      near: searchParams.get("near") === "1",
      bank: searchParams.get("bank"),
      card: searchParams.get("card"),
      category: isSubcategory
        ? categories.find((c) => c.id === currentCategory?.parent_id)?.slug ||
          null
        : currentCategory?.slug || null,
      subCategory: isSubcategory
        ? currentCategory?.slug
        : getCanonicalSubParam(searchParams),
    };
    return initialState;
  });

  // Track if local filters differ from URL (pending changes)
  const hasPendingChanges = (() => {
    const urlFilters: FilterState = {
      sort: searchParams.get("sort"),
      deals: isDealsActive(searchParams),
      open_now: searchParams.get("open_now") === "true",
      near: searchParams.get("near") === "1",
      bank: searchParams.get("bank"),
      card: searchParams.get("card"),
      category: currentCategory?.slug || null,
      subCategory: getCanonicalSubParam(searchParams),
    };
    return JSON.stringify(localFilters) !== JSON.stringify(urlFilters);
  })();

  // Sync local filters when URL changes (ONLY on intentional navigation, not HMR)
  useEffect(() => {
    const urlSort = searchParams.get("sort");

    // Don't sync if we're acquiring GPS
    if (isAcquiringGPS.current) {
      return;
    }

    // Check if there are pending filters in sessionStorage
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("pending_filters");
      if (stored) {
        return;
      }
    }

    // Only sync if URL actually differs
    if (urlSort === localFilters.sort) {
      return;
    }

    const isSubcategory =
      currentCategory?.parent_id !== null &&
      currentCategory?.parent_id !== undefined;
    const parentCategory = isSubcategory
      ? categories.find((c) => c.id === currentCategory?.parent_id)
      : null;

    const newFilters = {
      sort: urlSort,
      deals: isDealsActive(searchParams),
      open_now: searchParams.get("open_now") === "true",
      near: searchParams.get("near") === "1",
      bank: searchParams.get("bank"),
      card: searchParams.get("card"),
      category: isSubcategory
        ? parentCategory?.slug || null
        : currentCategory?.slug || null,
      subCategory: isSubcategory
        ? currentCategory?.slug
        : getCanonicalSubParam(searchParams),
    };

    setLocalFilters(newFilters);

    // Also sync the selected parent category
    if (isSubcategory && parentCategory) {
      setSelectedParentCategory(parentCategory.slug);
    } else if (currentCategory && !currentCategory.parent_id) {
      setSelectedParentCategory(currentCategory.slug);
    } else {
      setSelectedParentCategory(null);
    }
    // We intentionally don't include localFilters.sort in deps to avoid infinite loops
    // This effect should only run when URL searchParams change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, currentCategory, categories]);

  // Mobile detection
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Count active filters for badge (including current category from route)
  const activeFilterCount =
    Array.from(searchParams.entries()).filter(
      ([key]) => key !== "search" && searchParams.get(key),
    ).length + (currentCategory && currentCategory.slug !== "all" ? 1 : 0);

  // Convert current URL params to filter state for display
  const currentFilters: FilterState = {
    sort: searchParams.get("sort"),
    deals: isDealsActive(searchParams),
    open_now: searchParams.get("open_now") === "true",
    near: searchParams.get("near") === "1",
    bank: searchParams.get("bank"),
    card: searchParams.get("card"),
    category: currentCategory?.slug || searchParams.get("category"),
    subCategory: getCanonicalSubParam(searchParams),
  };

  // Fetch filter data with caching and performance optimization
  const {
    banks: bankOptions,
    cardVariants: cardOptions,
    siteSettings,
    sortOptions,
    loading: filterLoading,
    error: filterError,
  } = useFilterData(localFilters.bank);

  const selectedCategorySlug = searchParams.get("category") || "all";
  const parentCategory =
    categories.find((c) => c.slug === selectedCategorySlug) || null;

  // Get parent categories and subcategories
  const topLevelCategories = categories.filter((cat) => cat.parent_id === null);
  const getSubCategories = (parentSlug: string) => {
    const parent = topLevelCategories.find((cat) => cat.slug === parentSlug);
    return parent
      ? categories.filter((cat) => cat.parent_id === parent.id)
      : [];
  };

  // Determine which subcategories to show
  const currentSubCategories = (() => {
    // 1. If user clicked a parent category in filters, show its subcategories
    if (selectedParentCategory) {
      return getSubCategories(selectedParentCategory);
    }

    // 2. If we're on a subcategory route, show sibling subcategories
    if (currentCategory?.parent_id) {
      return categories.filter(
        (cat) => cat.parent_id === currentCategory.parent_id,
      );
    }

    // 3. If a parent category is selected via URL params, show its subcategories
    if (currentFilters.category) {
      const parentCategory = categories.find(
        (cat) => cat.slug === currentFilters.category && cat.parent_id === null,
      );
      if (parentCategory) {
        return getSubCategories(currentFilters.category);
      }
    }

    return [];
  })();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is now handled by the debounced effect above, so this just prevents form submission
    // This allows users to press Enter for immediate search if they want
    const params = new URLSearchParams(searchParams);
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    } else {
      params.delete("search");
    }
    router.push(buildUrl(pathname, params), { scroll: false });
  };

  // Debounce timer refs
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    const searchDebounceTimer = searchDebounceTimerRef.current;
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, []);

  // Debounced search effect for real-time search as user types
  useEffect(() => {
    // Clear existing timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    // Set new timer for debounced search
    const debounceMs = parseInt(siteSettings.filter_debounce_ms || "300", 10);
    searchDebounceTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (searchQuery && searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      } else {
        params.delete("search");
      }
      router.push(buildUrl(pathname, params), { scroll: false });
    }, debounceMs);
  }, [
    searchQuery,
    searchParams,
    pathname,
    router,
    siteSettings.filter_debounce_ms,
  ]);

  // Update LOCAL filter state (no navigation)
  const updateLocalFilter = useCallback(
    (key: keyof FilterState, value: string | boolean | null) => {
      setLocalFilters((prev) => {
        const updated = { ...prev, [key]: value };
        // Reset card when bank changes
        if (key === "bank" && prev.bank !== value) {
          updated.card = null;
        }
        // Reset subcategory when category changes
        if (key === "category" && prev.category !== value) {
          updated.subCategory = null;
        }
        return updated;
      });

      // Auto-trigger geolocation when "distance" sort is selected
      if (key === "sort" && value === "distance") {
        isAcquiringGPS.current = true;
        getLocation();
      }

      // Clear coordinates if distance sort is deselected
      if (key === "sort" && value !== "distance") {
        setUserCoordinates(null);
      }
    },
    [getLocation],
  );

  // APPLY FILTERS - navigates to the new URL with all selected filters
  const applyFilters = useCallback(() => {
    const params = new URLSearchParams();

    // Keep search if present
    if (searchQuery && searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }

    // Apply non-category filters
    if (localFilters.sort) params.set("sort", localFilters.sort);
    if (localFilters.deals) params.set("deals", "true");
    if (localFilters.open_now) params.set("open_now", "true");
    if (localFilters.near) params.set("near", "1");
    if (localFilters.bank) params.set("bank", localFilters.bank);
    if (localFilters.card) params.set("card", localFilters.card);

    // Add coordinates if distance sorting with user location
    if (localFilters.sort === "distance" && userCoordinates) {
      params.set("lat", userCoordinates.lat.toFixed(6));
      params.set("lng", userCoordinates.lng.toFixed(6));
    }

    // Determine the base path based on category selection
    // "all" or null/empty should navigate to /listings (not /listings/all)
    let basePath = "/listings";
    if (localFilters.subCategory && localFilters.subCategory !== "all") {
      basePath = `/listings/${localFilters.subCategory}`;
    } else if (localFilters.category && localFilters.category !== "all") {
      basePath = `/listings/${localFilters.category}`;
    }

    const queryString = params.toString();
    const newUrl = queryString ? `${basePath}?${queryString}` : basePath;
    router.push(newUrl, { scroll: false });
    setShowFilters(false);

    // Clear pending filters from sessionStorage after applying
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_filters");
    }
  }, [localFilters, searchQuery, router, userCoordinates]);

  // Clear all filters - resets both local state and navigates
  const clearAllFilters = useCallback(() => {
    // Reset local filters
    setLocalFilters({
      sort: null,
      deals: false,
      open_now: false,
      near: false,
      bank: null,
      card: null,
      category: null,
      subCategory: null,
    });
    setSelectedParentCategory(null);
    setUserCoordinates(null);

    // Clear pending filters from sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("pending_filters");
    }

    // Navigate to clean listings page
    const params = new URLSearchParams();
    if (searchQuery) params.set("search", searchQuery);
    const queryString = params.toString();
    const newUrl = queryString ? `/listings?${queryString}` : "/listings";
    router.push(newUrl, { scroll: false });
  }, [searchQuery, router]);

  // Handle category click - updates LOCAL state only (no navigation)
  const handleCategoryClick = useCallback(
    (categorySlug: string) => {
      // Special handling for "all" category - clears category filter
      if (categorySlug === "all") {
        setSelectedParentCategory(null);
        setLocalFilters((prev) => ({
          ...prev,
          category: null,
          subCategory: null,
        }));
        return;
      }

      // Toggle off if clicking the same category
      if (selectedParentCategory === categorySlug) {
        setSelectedParentCategory(null);
        setLocalFilters((prev) => ({
          ...prev,
          category: null,
          subCategory: null,
        }));
        return;
      }

      // Update UI and local state
      setSelectedParentCategory(categorySlug);
      setLocalFilters((prev) => ({
        ...prev,
        category: categorySlug,
        subCategory: null, // Reset subcategory when parent changes
      }));
    },
    [selectedParentCategory],
  );

  // Handle subcategory click - updates LOCAL state only (no navigation)
  const handleSubCategoryClick = useCallback((subCategorySlug: string) => {
    setLocalFilters((prev) => ({
      ...prev,
      subCategory: subCategorySlug,
    }));
  }, []);

  // Use passed title and description, with fallbacks
  const displayTitle =
    pageTitle || siteSettings.site_title || "Discover Karachi";
  const displayDescription =
    pageDescription ||
    siteSettings.site_description ||
    "Explore the best of Karachi — from local favorites to hidden gems, all in one place.";

  return (
    <>
      {/* Header with proper spacing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative mt-3 sm:mt-6 mb-3 sm:mb-6"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Compact glassmorphism container */}
          <div className="relative rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
            {/* Subtle gradient accent */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <div className="relative p-4 sm:p-6 space-y-3 sm:space-y-4">
              {/* Compact Breadcrumbs */}
              <div className="flex flex-wrap items-center justify-start sm:justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 sm:gap-2 text-sm">
                  <button
                    className="flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
                    onClick={() => router.push("/")}
                  >
                    <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="text-[11px] sm:text-xs font-medium">Home</span>
                  </button>
                  <span className="text-muted-foreground/50 text-xs">/</span>
                  <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-primary/10 text-primary font-semibold text-[11px] sm:text-xs border border-primary/20">
                    Listings
                  </span>
                  {parentCategory && parentCategory.slug !== "all" && (
                    <>
                      <span className="text-muted-foreground/50 text-xs">
                        /
                      </span>
                      <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-muted/30 text-foreground/80 text-[11px] sm:text-xs">
                        {parentCategory.name}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Compact Title + Controls */}
              <div className="space-y-3 sm:space-y-4">
                <div className="text-left">
                  <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight mb-1 sm:mb-2">
                    <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      {displayTitle}
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-xl line-clamp-1 sm:line-clamp-none">
                    {displayDescription}
                  </p>
                </div>

                {/* Search & Filter Toggle */}
                <div className="flex items-center gap-2 sm:gap-3 max-w-2xl">
                  {/* Refined Search */}
                  <form onSubmit={handleSearch} className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                          siteSettings.search_placeholder ||
                          "Search restaurants, hotels, attractions..."
                        }
                        className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-9 sm:pr-10 text-xs sm:text-sm rounded-xl bg-background border border-border hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </form>

                  {/* Filter Toggle Button */}
                  <button
                    onClick={() =>
                      isMobile
                        ? setShowFullScreenFilter(true)
                        : setShowFilters(!showFilters)
                    }
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-10 sm:h-11 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 border flex-shrink-0",
                      showFilters || activeFilterCount > 0
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background hover:bg-muted/50 border-border hover:border-border/80",
                    )}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <div className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-background/20 text-[10px] sm:text-xs font-bold">
                        {activeFilterCount}
                      </div>
                    )}
                    {!isMobile && (
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          showFilters && "rotate-180",
                        )}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Compact Filter Panel - Desktop Only */}
      <AnimatePresence>
        {showFilters && !isMobile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative mb-8"
          >
            <div className="container mx-auto px-6 lg:px-8">
              <div className="relative rounded-2xl bg-card/50 backdrop-blur-xl border border-border/50 shadow-xl">
                {/* Gradient accent */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

                <div className="p-6 space-y-6">
                  {/* Compact Sort Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Sort & Priority
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sortOptions.map((sortOption) => {
                        const isActive = sortOption.is_default
                          ? !localFilters.sort
                          : localFilters.sort === sortOption.key;

                        const isDistanceSort = sortOption.key === "distance";
                        const isLoading = isDistanceSort && locationLoading;

                        // Get icon component from icon name
                        const IconComponent =
                          {
                            star: Star,
                            "trending-up": TrendingUp,
                            percent: Percent,
                            clock: Clock,
                            "map-pin": MapPin,
                          }[sortOption.icon_name] || Star;

                        return (
                          <FilterChip
                            key={sortOption.key}
                            active={isActive}
                            disabled={isLoading}
                            onClick={() => {
                              // Prevent toggling off while loading
                              if (isLoading) return;

                              updateLocalFilter(
                                "sort",
                                isActive ? null : sortOption.key,
                              );
                            }}
                            icon={IconComponent}
                          >
                            {isLoading
                              ? "Getting location..."
                              : sortOption.label}
                          </FilterChip>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compact Categories with Subcategories */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Compass className="h-4 w-4 text-primary" />
                        Categories
                      </h3>
                    </div>

                    {/* Main Categories */}
                    <div className="flex flex-wrap gap-2">
                      {topLevelCategories
                        .slice(
                          0,
                          showAllCategories
                            ? topLevelCategories.length
                            : parseInt(
                                siteSettings.max_categories_display || "6",
                                10,
                              ),
                        )
                        .map((cat) => {
                          // Check if this parent category should be active (in local state)
                          // "all" is active when no category is selected
                          const isActive =
                            cat.slug === "all"
                              ? !localFilters.category &&
                                !selectedParentCategory
                              : localFilters.category === cat.slug ||
                                selectedParentCategory === cat.slug;

                          return (
                            <FilterChip
                              key={cat.id}
                              active={isActive}
                              onClick={() => handleCategoryClick(cat.slug)}
                              icon={() => (
                                <CategoryIcon
                                  slug={cat.slug}
                                  iconName={cat.icon_name || undefined}
                                />
                              )}
                            >
                              {cat.name}
                            </FilterChip>
                          );
                        })}

                      {(() => {
                        const maxDisplay = parseInt(
                          siteSettings.max_categories_display || "6",
                          10,
                        );
                        return (
                          topLevelCategories.length > maxDisplay && (
                            <FilterChip
                              active={false}
                              onClick={() =>
                                setShowAllCategories(!showAllCategories)
                              }
                              icon={showAllCategories ? ChevronUp : ChevronDown}
                            >
                              {showAllCategories
                                ? "Show less"
                                : `+${
                                    topLevelCategories.length - maxDisplay
                                  } more`}
                            </FilterChip>
                          )
                        );
                      })()}
                    </div>

                    {/* Subcategories */}
                    {currentSubCategories.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-6 pt-2 border-l-2 border-primary/20 pl-4"
                      >
                        <div className="flex flex-wrap gap-2">
                          {currentSubCategories.map((sub) => {
                            // Check if this subcategory is selected in local state
                            const isActive =
                              localFilters.subCategory === sub.slug;

                            return (
                              <FilterChip
                                key={sub.id}
                                active={isActive}
                                onClick={() => {
                                  if (isActive) {
                                    // Deselect subcategory
                                    setLocalFilters((prev) => ({
                                      ...prev,
                                      subCategory: null,
                                    }));
                                  } else {
                                    // Select this subcategory
                                    handleSubCategoryClick(sub.slug);
                                  }
                                }}
                              >
                                {sub.name}
                              </FilterChip>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Unified Filter Chips Row with Section Headings */}
                  <div>
                    {/* Quick Filters Section Heading */}
                    <div className="flex items-center gap-2 mt-6 mb-2">
                      <Tag className="h-5 w-5 text-primary" />
                      <h3 className="text-base font-semibold text-foreground/90">
                        Quick Filters
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          active={localFilters.deals}
                          onClick={() =>
                            updateLocalFilter("deals", !localFilters.deals)
                          }
                          icon={Tag}
                        >
                          Deals
                        </FilterChip>
                        <FilterChip
                          active={localFilters.open_now}
                          onClick={() =>
                            updateLocalFilter(
                              "open_now",
                              !localFilters.open_now,
                            )
                          }
                          icon={Clock}
                        >
                          Open Now
                        </FilterChip>
                      </div>
                    </div>

                    {/* Bank & Card Section Heading */}
                    <div className="flex items-center gap-2 mt-6 mb-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <h3 className="text-base font-semibold text-foreground/90">
                        Bank & Card
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <PremiumDropdown
                        value={localFilters.bank}
                        onChange={(value) => {
                          updateLocalFilter("bank", value);
                        }}
                        options={bankOptions}
                        placeholder="Any Bank"
                        variant="compact"
                        searchable={bankOptions.length > 5}
                        icon={Building}
                      />

                      <AnimatePresence mode="wait">
                        {!!localFilters.bank && (
                          <motion.div
                            key="card-dropdown"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="min-w-0 relative z-10"
                            style={{
                              minWidth: "140px", // Ensure minimum width
                            }}
                          >
                            <PremiumDropdown
                              value={localFilters.card}
                              onChange={(value) =>
                                updateLocalFilter("card", value)
                              }
                              options={cardOptions}
                              loading={filterLoading.cardVariants}
                              error={filterError || undefined}
                              placeholder={
                                filterLoading.cardVariants
                                  ? "Loading cards..."
                                  : "Any Card"
                              }
                              variant="compact"
                              searchable={cardOptions.length > 5}
                              icon={CreditCard}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Action Buttons - Apply & Clear */}
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {activeFilterCount > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {activeFilterCount} filter
                            {activeFilterCount > 1 ? "s" : ""} active
                          </span>
                        )}
                        {hasPendingChanges && (
                          <span className="text-xs text-amber-500 font-medium">
                            • Unsaved changes
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {(activeFilterCount > 0 || hasPendingChanges) && (
                          <motion.button
                            onClick={clearAllFilters}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Clear all
                          </motion.button>
                        )}
                        <motion.button
                          onClick={applyFilters}
                          className={cn(
                            "px-5 py-2 rounded-xl text-sm font-semibold transition-all",
                            hasPendingChanges
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                              : "bg-primary/10 text-primary hover:bg-primary/20",
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Apply Filters
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Full Screen Filter */}
      <FullScreenFilter
        isOpen={showFullScreenFilter}
        onClose={() => setShowFullScreenFilter(false)}
        categories={categories}
      />
    </>
  );
}
