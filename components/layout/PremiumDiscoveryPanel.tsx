"use client";

import * as React from "react";
import ReactDOM from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  BookOpen,
  Calendar,
  Star,
  TrendingUp,
  Heart,
  Utensils,
  Building,
  Newspaper,
  HeartPulse,
  GraduationCap,
  Popcorn,
  ShoppingCart,
  Compass,
  Search,
  ArrowRight,
} from "lucide-react";
import { formatDistance, SearchResult } from "@/hooks/useSearch";

interface CategoryData {
  id: number;
  name: string;
  slug: string;
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
}

interface TrendingListing {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  category_name: string | null;
  avg_rating: number | null;
  review_count: number;
}

interface PremiumDiscoveryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  mobileMode?: boolean;
  // Search integration props
  searchQuery?: string;
  searchResults?: SearchResult[];
  isSearching?: boolean;
  showSearchResults?: boolean;
  onSearchSelect?: (result: SearchResult) => void;
}

// Icon mapping for categories
const iconMap: { [key: string]: React.ElementType } = {
  "eat-drink": Utensils,
  "where-to-stay": Building,
  "guides-reviews": Newspaper,
  "fitness-healthcare": HeartPulse,
  education: GraduationCap,
  entertainment: Popcorn,
  shopping: ShoppingCart,
  "things-to-do": Compass,
};

// Color mapping for categories
const colorMap: { [key: string]: string } = {
  "eat-drink": "red",
  "where-to-stay": "blue",
  "guides-reviews": "green",
  "fitness-healthcare": "pink",
  education: "indigo",
  entertainment: "purple",
  shopping: "green",
  "things-to-do": "amber",
};

export function PremiumDiscoveryPanel({
  isOpen,
  onClose,
  className,
  mobileMode = false,
  searchQuery = "",
  searchResults = [],
  isSearching = false,
  showSearchResults = false,
  onSearchSelect,
}: PremiumDiscoveryPanelProps) {
  // Pointer-down flag helps the header's onBlur handler decide whether to keep the panel open.
  // The flag must persist longer than the onBlur handler's 200ms timeout check.
  const setPointerDownFlag = React.useCallback(() => {
    try {
      (window as unknown as Record<string, unknown>).__pkDiscoveryMouseDown =
        true;

      // Clear after 300ms - longer than the header's 200ms onBlur timeout
      // This ensures the flag is still true when the blur handler checks it
      setTimeout(() => {
        (window as unknown as Record<string, unknown>).__pkDiscoveryMouseDown =
          false;
      }, 300);
    } catch (err) {
      console.error("[Discovery] setPointerDownFlag error", err);
    }
  }, []);
  const [categories, setCategories] = React.useState<CategoryData[]>([]);
  const [trendingListings, setTrendingListings] = React.useState<
    TrendingListing[]
  >([]);
  const [contentCounts, setContentCounts] = React.useState({
    listings: 0,
    posts: 0,
    events: 0,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (isOpen) {
      fetchDiscoveryData();
    }
  }, [isOpen]);

  // Close the panel automatically on client-side route changes
  const pathname = usePathname();
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Track previous pathname to avoid running the close logic on initial mount
  const prevPathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    if (!isOpen) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (prevPathnameRef.current !== pathname) {
      try {
        onCloseRef.current();
      } catch (err) {
        console.error("[Discovery] onClose error after pathname change", err);
      }
    }
    prevPathnameRef.current = pathname;
  }, [pathname, isOpen]);

  // Helper to handle clicks on links inside the discovery panel
  // Keeps existing behavior (calls onClose)
  const handleLinkClick = React.useCallback(
    (_href: string, _label?: string) => (_e: React.SyntheticEvent) => {
      try {
        // Track link click for discovery interaction
      } catch (err) {
        console.error("[Discovery] error logging link click", err);
      }

      try {
        onClose?.();
      } catch (err) {
        console.error("[Discovery] error calling onClose from link click", err);
      }
    },
    [onClose],
  );

  const fetchDiscoveryData = async () => {
    try {
      const res = await fetch("/api/discovery");
      const data = await res.json();

      setCategories(data.categories || []);
      setTrendingListings(data.trendingListings || []);
      setContentCounts({
        listings: data.contentCounts?.listings || 0,
        posts: data.contentCounts?.posts || 0,
        events: data.contentCounts?.events || 0,
      });
    } catch (error) {
      console.error("Error fetching discovery data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Lock body scroll when panel is open
  React.useEffect(() => {
    if (!isOpen) return;

    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Close on Escape key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  // Portal renders outside parent DOM hierarchy to avoid stacking context issues
  return ReactDOM.createPortal(
    <>
      {/* Backdrop for click-outside detection */}
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        id="premium-discovery-panel"
        onMouseDown={setPointerDownFlag}
        onTouchStart={setPointerDownFlag}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(
          "fixed top-[88px] left-0 right-0 z-[9999]",
          "pointer-events-none flex justify-center",
          className,
        )}
      >
        <div
          className={cn(
            "w-[90vw] max-w-5xl pointer-events-auto",
            "bg-background/95 backdrop-blur-xl border border-border/50",
            "rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30",
            "p-6 max-h-[80vh] overflow-y-auto custom-scrollbar",
          )}
        >
          {/* Header - Only show in desktop mode */}
          {!mobileMode && (
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  Discover Karachi
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Find the best places, guides, and experiences
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors text-xl font-light"
              >
                ×
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">
                  Loading discovery data...
                </p>
              </div>
            </div>
          ) : showSearchResults && searchQuery.trim().length >= 2 ? (
            /* Search Results Mode */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground flex items-center text-base">
                  <Search className="h-5 w-5 mr-3 text-primary" />
                  Search Results for &ldquo;{searchQuery}&rdquo;
                </h4>
                {searchResults.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {searchResults.length} result
                    {searchResults.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                  <span className="text-sm text-muted-foreground">
                    Searching...
                  </span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {searchResults.map((result) => (
                    <motion.button
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        try {
                          // Track search result selection
                        } catch (err) {
                          console.error(
                            "[Discovery] error logging search select",
                            err,
                          );
                        }
                        onSearchSelect?.(result);
                      }}
                      className="w-full p-4 text-left bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {result.type === "listing" && (
                            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                              <MapPin className="h-4 w-4 text-orange-500" />
                            </div>
                          )}
                          {result.type === "event" && (
                            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                              <Calendar className="h-4 w-4 text-purple-500" />
                            </div>
                          )}
                          {result.type === "post" && (
                            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
                              <BookOpen className="h-4 w-4 text-green-500" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {result.name}
                            </h3>
                            {result.avg_rating != null &&
                              result.avg_rating > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  {result.avg_rating.toFixed(1)}
                                </span>
                              )}
                            {formatDistance(result.distance_meters) && (
                              <span className="text-xs text-muted-foreground">
                                {formatDistance(result.distance_meters)}
                              </span>
                            )}
                          </div>
                          {result.category && (
                            <p className="text-sm text-primary/80 mt-1">
                              {result.category}
                            </p>
                          )}
                          {result.address && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {result.address}
                            </p>
                          )}
                          {result.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {result.description}
                            </p>
                          )}
                        </div>

                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Search className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="text-sm sm:text-base font-medium text-foreground mb-2">
                    No results found
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Try searching for restaurants, events, or places in Karachi
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Content Types */}
              <div className="space-y-6">
                <h4 className="font-medium text-foreground flex items-center text-base">
                  <Compass className="h-5 w-5 mr-3 text-primary" />
                  Browse by Type
                </h4>
                <div className="space-y-4">
                  {/* Places */}
                  <Link
                    href="/listings"
                    className="block"
                    onClick={handleLinkClick("/listings", "Places")}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className={cn(
                        "group overflow-hidden rounded-xl p-4 transition-all duration-300 relative",
                        mobileMode
                          ? "bg-card/30 border border-border/30 hover:border-border hover:bg-card/50 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 hover:-translate-y-1 active:scale-95"
                          : "p-5 rounded-xl border border-border/50 hover:border-border bg-card/50 hover:bg-card cursor-pointer hover:shadow-lg",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl transition-colors duration-200",
                            mobileMode
                              ? "bg-primary/10 text-primary group-hover:bg-primary/20"
                              : "bg-blue-100 dark:bg-blue-900/30",
                          )}
                        >
                          <MapPin
                            className={cn(
                              "h-5 w-5",
                              mobileMode
                                ? "text-primary"
                                : "text-blue-600 dark:text-blue-400",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            Places
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contentCounts.listings.toLocaleString()} listings
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        Restaurants, cafes, shops & more
                      </p>

                      {/* Subtle gradient overlay for mobile */}
                      {mobileMode && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto" />
                      )}
                    </motion.div>
                  </Link>

                  {/* Guides & Reviews - Disabled until blog page is ready */}
                  <div className="block cursor-not-allowed opacity-60">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                      className={cn(
                        "overflow-hidden rounded-xl p-4 relative",
                        mobileMode
                          ? "bg-card/30 border border-border/30"
                          : "p-5 rounded-xl border border-border/50 bg-card/50",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl",
                            mobileMode
                              ? "bg-primary/10 text-primary"
                              : "bg-green-100 dark:bg-green-900/30",
                          )}
                        >
                          <BookOpen
                            className={cn(
                              "h-5 w-5",
                              mobileMode
                                ? "text-primary"
                                : "text-green-600 dark:text-green-400",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            Guides & Reviews
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contentCounts.posts.toLocaleString()} articles
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        Expert insights & local tips
                      </p>
                      <p className="text-xs text-primary/70 mt-2">
                        Coming Soon
                      </p>
                    </motion.div>
                  </div>

                  {/* Events */}
                  <Link
                    href="/events"
                    className="block"
                    onClick={handleLinkClick("/events", "Events")}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className={cn(
                        "group overflow-hidden rounded-xl p-4 transition-all duration-300 relative",
                        mobileMode
                          ? "bg-card/30 border border-border/30 hover:border-border hover:bg-card/50 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 hover:-translate-y-1 active:scale-95"
                          : "p-5 rounded-xl border border-border/50 hover:border-border bg-card/50 hover:bg-card cursor-pointer hover:shadow-lg",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "p-3 rounded-xl transition-colors duration-200",
                            mobileMode
                              ? "bg-primary/10 text-primary group-hover:bg-primary/20"
                              : "bg-purple-100 dark:bg-purple-900/30",
                          )}
                        >
                          <Calendar
                            className={cn(
                              "h-5 w-5",
                              mobileMode
                                ? "text-primary"
                                : "text-purple-600 dark:text-purple-400",
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            Events
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contentCounts.events.toLocaleString()} upcoming
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        Concerts, workshops & meetups
                      </p>

                      {/* Subtle gradient overlay for mobile */}
                      {mobileMode && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto" />
                      )}
                    </motion.div>
                  </Link>
                </div>
              </div>

              {/* Middle Column - Categories */}
              <div className="space-y-6">
                <h4 className="text-sm sm:text-base font-medium text-foreground flex items-center">
                  <Heart className="h-5 w-5 mr-3 text-primary" />
                  Popular Categories
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {categories
                    .filter((category) => category.slug !== "events")
                    .slice(0, 6)
                    .map((category, index) => {
                      const icon = iconMap[category.slug] || Compass;
                      const color = colorMap[category.slug] || "blue";

                      return (
                        <Link
                          key={category.id}
                          href={`/listings/${category.slug}`}
                          className="block"
                          onClick={handleLinkClick(
                            `/listings/${category.slug}`,
                            category.name,
                          )}
                        >
                          <motion.div
                            key={category.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.1 }}
                            className={cn(
                              "p-5 rounded-xl border border-border/50 hover:border-border relative",
                              "bg-card/50 hover:bg-card transition-all duration-200",
                              "cursor-pointer group hover:shadow-lg",
                            )}
                          >
                            <div className="text-center space-y-3">
                              <div
                                className={cn(
                                  "w-12 h-12 rounded-lg mx-auto flex items-center justify-center",
                                  color === "red" &&
                                    "bg-red-100 dark:bg-red-900/30",
                                  color === "blue" &&
                                    "bg-blue-100 dark:bg-blue-900/30",
                                  color === "purple" &&
                                    "bg-purple-100 dark:bg-purple-900/30",
                                  color === "green" &&
                                    "bg-green-100 dark:bg-green-900/30",
                                  color === "amber" &&
                                    "bg-amber-100 dark:bg-amber-900/30",
                                  color === "pink" &&
                                    "bg-pink-100 dark:bg-pink-900/30",
                                  color === "indigo" &&
                                    "bg-indigo-100 dark:bg-indigo-900/30",
                                )}
                              >
                                {React.createElement(icon, {
                                  className: cn(
                                    "h-6 w-6",
                                    color === "red" &&
                                      "text-red-600 dark:text-red-400",
                                    color === "blue" &&
                                      "text-blue-600 dark:text-blue-400",
                                    color === "purple" &&
                                      "text-purple-600 dark:text-purple-400",
                                    color === "green" &&
                                      "text-green-600 dark:text-green-400",
                                    color === "amber" &&
                                      "text-amber-600 dark:text-amber-400",
                                    color === "pink" &&
                                      "text-pink-600 dark:text-pink-400",
                                    color === "indigo" &&
                                      "text-indigo-600 dark:text-indigo-400",
                                  ),
                                })}
                              </div>
                              <div>
                                <p className="font-medium text-sm text-foreground">
                                  {category.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {category.subcategories?.length || 0}{" "}
                                  subcategories
                                </p>
                              </div>
                              {category.subcategories &&
                                category.subcategories.length > 0 && (
                                  <div className="space-y-1">
                                    {category.subcategories
                                      .slice(0, 2)
                                      .map((sub) => (
                                        <p
                                          key={sub.id}
                                          className="text-xs text-muted-foreground/80"
                                        >
                                          {sub.name}
                                        </p>
                                      ))}
                                  </div>
                                )}
                            </div>
                          </motion.div>
                        </Link>
                      );
                    })}
                </div>
              </div>

              {/* Right Column - Trending */}
              <div className="space-y-6">
                <h4 className="text-sm sm:text-base font-medium text-foreground flex items-center">
                  <TrendingUp className="h-5 w-5 mr-3 text-primary" />
                  Trending Now
                </h4>
                <div className="space-y-4">
                  {trendingListings.length > 0 ? (
                    trendingListings.slice(0, 4).map((item, index) => (
                      <Link
                        key={item.id}
                        href={`/listing/${item.slug}`}
                        className="block"
                        onClick={handleLinkClick(
                          `/listing/${item.slug}`,
                          item.name,
                        )}
                      >
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                          className={cn(
                            "p-5 rounded-lg border border-border/50 hover:border-border relative",
                            "bg-card/50 hover:bg-card transition-all duration-200",
                            "cursor-pointer group hover:shadow-md",
                          )}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.category_name}
                                </p>
                              </div>
                              {item.avg_rating && (
                                <div className="flex items-center space-x-1 ml-2">
                                  <Star className="h-3 w-3 text-amber-500 fill-current" />
                                  <span className="text-xs text-muted-foreground">
                                    {item.avg_rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                            {item.address && (
                              <p className="text-xs text-muted-foreground/80 truncate">
                                {item.address}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Place</span>
                              <span>{item.review_count} reviews</span>
                            </div>
                          </div>
                        </motion.div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No trending places yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Check back soon!
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="pt-6 border-t border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20 hover:border-primary/40">
                      Near Me
                    </button>
                    <button className="p-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20 hover:border-primary/40">
                      Open Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
