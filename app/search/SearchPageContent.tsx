"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  formatDistance,
  useSearch,
  type SearchEntityType,
} from "@/hooks/useSearch";
import {
  Search,
  MapPin,
  Calendar,
  ArrowRight,
  Loader2,
  Star,
  BookOpen,
} from "lucide-react";
import { findHomepageArea } from "@/lib/homepage/areas";
import { cn } from "@/lib/utils";

const ENTITY_TABS: { id: SearchEntityType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "places", label: "Places" },
  { id: "events", label: "Events" },
];

function parseCoordParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlQuery = searchParams.get("q");
  const urlType = (searchParams.get("type") ?? "all").toLowerCase();
  const urlArea = searchParams.get("area");
  const urlLat = parseCoordParam(searchParams.get("lat"));
  const urlLng = parseCoordParam(searchParams.get("lng"));

  const areaMeta = urlArea ? findHomepageArea(urlArea) : undefined;
  const lat = urlLat ?? areaMeta?.center.lat ?? null;
  const lng = urlLng ?? areaMeta?.center.lng ?? null;

  const searchType: SearchEntityType =
    urlType === "places" || urlType === "events" ? urlType : "all";

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    isLoadingMore,
    showResults,
    setShowResults,
    getResultUrl,
    hasMore,
    loadMore,
    setSearchType,
  } = useSearch({
    limit: 20,
    type: searchType,
    lat,
    lng,
  });

  // Seed from URL query when it changes
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setShowResults(true);
    }
  }, [urlQuery, setSearchQuery, setShowResults]);

  useEffect(() => {
    setSearchType(searchType);
  }, [searchType, setSearchType]);

  const locationLabel = useMemo(() => {
    if (urlArea) return urlArea;
    if (lat != null && lng != null) return "Near me";
    return null;
  }, [urlArea, lat, lng]);

  const updateUrl = (next: {
    q?: string;
    type?: SearchEntityType;
  }) => {
    const params = new URLSearchParams();
    const q = next.q ?? searchQuery.trim();
    if (q) params.set("q", q);
    const type = next.type ?? searchType;
    if (type !== "all") params.set("type", type);
    if (urlArea) params.set("area", urlArea);
    if (urlLat != null) params.set("lat", String(urlLat));
    if (urlLng != null) params.set("lng", String(urlLng));
    // Prefer explicit coords from pin even if only area was in URL
    if (urlLat == null && urlLng == null && lat != null && lng != null) {
      params.set("lat", lat.toFixed(6));
      params.set("lng", lng.toFixed(6));
    }
    router.replace(`/search?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(true);
      updateUrl({ q: searchQuery.trim() });
    }
  };

  const handleTab = (type: SearchEntityType) => {
    setSearchType(type);
    updateUrl({ type });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-20" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 pt-8"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-4">
            Search <span className="gradient-text-primary">Karachi</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Find restaurants, events, guides, and more across the city
            {locationLabel ? (
              <>
                {" "}
                · <span className="text-foreground font-medium">{locationLabel}</span>
              </>
            ) : null}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative mb-6"
        >
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur-xl group-focus-within:blur-2xl transition-all duration-300" />

            <div className="relative flex bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium-lg overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search restaurants, events, places..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() =>
                    searchQuery.length >= 2 && setShowResults(true)
                  }
                  className="h-16 pl-14 pr-6 text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="h-16 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-l-none rounded-r-2xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <span className="mr-2">Search</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </motion.div>

        {/* Entity tabs — same type filter as mobile */}
        <div
          role="tablist"
          aria-label="Result type"
          className="mb-8 flex flex-wrap justify-center gap-2"
        >
          {ENTITY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={searchType === tab.id}
              onClick={() => handleTab(tab.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                searchType === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="min-h-[400px] flex flex-col"
        >
          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-muted-foreground">Searching...</span>
            </div>
          )}

          {showResults && !isSearching && (
            <div className="space-y-4 flex-1">
              {searchResults.length > 0 ? (
                <>
                  <div className="text-sm text-muted-foreground mb-4">
                    Found {searchResults.length}
                    {hasMore ? "+" : ""} results for &ldquo;{searchQuery}&rdquo;
                  </div>
                  <div className="grid gap-3">
                    {searchResults.map((result) => {
                      const distance = formatDistance(result.distance_meters);
                      return (
                        <motion.button
                          key={`${result.type}-${result.id}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => {
                            setShowResults(false);
                            try {
                              window.dispatchEvent(
                                new Event("insidekhi:closeDiscovery"),
                              );
                            } catch {
                              /* ignore */
                            }
                            try {
                              router.push(getResultUrl(result));
                            } catch {
                              window.location.href = getResultUrl(result);
                            }
                          }}
                          className="w-full p-5 text-left bg-background/50 backdrop-blur-sm border border-border/50 rounded-xl hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 group"
                        >
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0 mt-0.5">
                              {result.type === "listing" && (
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <MapPin className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              {result.type === "event" && (
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Calendar className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              {result.type === "post" && (
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <BookOpen className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              {result.type === "category" && (
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Search className="h-5 w-5 text-primary" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                  {result.name}
                                </h3>
                                {result.avg_rating != null &&
                                  result.avg_rating > 0 && (
                                    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                      {result.avg_rating.toFixed(1)}
                                      {result.review_count != null &&
                                      result.review_count > 0
                                        ? ` (${result.review_count})`
                                        : ""}
                                    </span>
                                  )}
                                {distance && (
                                  <span className="text-xs text-muted-foreground">
                                    {distance}
                                  </span>
                                )}
                              </div>
                              {result.category && (
                                <p className="text-sm text-muted-foreground mt-0.5">
                                  {result.category}
                                </p>
                              )}
                              {result.address && (
                                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                  {result.address}
                                </p>
                              )}
                              {result.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {result.description}
                                </p>
                              )}
                            </div>

                            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1" />
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="rounded-full"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading…
                          </>
                        ) : (
                          "Load more"
                        )}
                      </Button>
                    </div>
                  )}
                </>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No results found
                  </h3>
                  <p className="text-muted-foreground">
                    Try searching for restaurants, events, or places in Karachi
                  </p>
                </div>
              ) : (
                <div className="text-center py-12 flex-1 flex flex-col justify-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Start searching
                  </h3>
                  <p className="text-muted-foreground">
                    Enter at least 2 characters to search for places, events,
                    and guides
                  </p>
                </div>
              )}
            </div>
          )}

          {!showResults && !isSearching && (
            <div className="text-center py-16 flex-1 flex flex-col justify-center">
              <Search className="h-16 w-16 text-muted-foreground/30 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Discover Karachi
              </h3>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Search for your favorite restaurants, upcoming events, travel
                guides, and hidden gems across the city
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
