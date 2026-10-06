"use client";

import { useState, useEffect, useCallback, useRef } from "react";
// pure hook - do not depend on router here so callers can decide how to navigate
import { useDebounce } from "@/hooks/useDebounce";
import { recordAnalyticsEvent } from "@/lib/analytics/client";

export type SearchEntityType = "all" | "places" | "events";

export interface SearchResult {
  id: number;
  name: string;
  type: "listing" | "category" | "event" | "post";
  slug: string;
  category?: string;
  address?: string;
  description?: string;
  avg_rating?: number | null;
  review_count?: number | null;
  distance_meters?: number | null;
}

interface UseSearchProps {
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
  /** Places / events / all — maps to API `type` */
  type?: SearchEntityType;
  lat?: number | null;
  lng?: number | null;
  /** When false, skip fetching (e.g. until URL seeded) */
  enabled?: boolean;
}

interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  isLoadingMore: boolean;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  getResultUrl: (result: SearchResult) => string;
  hasMore: boolean;
  loadMore: () => void;
  searchType: SearchEntityType;
  setSearchType: (type: SearchEntityType) => void;
}

type ApiSearchResult = {
  id: number;
  name?: string;
  title?: string;
  slug: string;
  type: string;
  category?: string;
  address?: string;
  description?: string;
  excerpt?: string;
  avg_rating?: number | null;
  review_count?: number | null;
  distance_meters?: number | null;
};

function mapApiResult(result: ApiSearchResult): SearchResult {
  return {
    id: result.id,
    name: result.name || result.title || "",
    slug: result.slug,
    type: result.type as SearchResult["type"],
    category: result.category,
    address: result.address,
    description: result.description || result.excerpt,
    avg_rating: result.avg_rating ?? null,
    review_count: result.review_count ?? null,
    distance_meters: result.distance_meters ?? null,
  };
}

function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export { formatDistance };

export function useSearch({
  debounceMs = 300,
  minQueryLength = 2,
  limit = 8,
  type: typeProp = "all",
  lat = null,
  lng = null,
  enabled = true,
}: UseSearchProps = {}): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchType, setSearchType] = useState<SearchEntityType>(typeProp);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const requestIdRef = useRef(0);

  const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);

  // Keep internal type in sync when caller controls it
  useEffect(() => {
    setSearchType(typeProp);
  }, [typeProp]);

  const buildUrl = useCallback(
    (query: string, offset: number, type: SearchEntityType) => {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
        type,
      });
      if (lat != null && lng != null) {
        params.set("lat", String(lat));
        params.set("lng", String(lng));
      }
      return `/api/search?${params.toString()}`;
    },
    [limit, lat, lng],
  );

  useEffect(() => {
    if (!enabled) return;

    const performSearchInternal = async (query: string) => {
      if (!query.trim() || query.length < minQueryLength) {
        setSearchResults([]);
        setShowResults(false);
        setHasMore(false);
        offsetRef.current = 0;
        return;
      }

      const requestId = ++requestIdRef.current;
      setIsSearching(true);
      setShowResults(true);
      offsetRef.current = 0;

      try {
        const response = await fetch(
          buildUrl(query, 0, searchType),
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data = await response.json();
        if (requestId !== requestIdRef.current) return;

        const transformedResults: SearchResult[] = (
          data.results as ApiSearchResult[]
        ).map(mapApiResult);

        setSearchResults(transformedResults);
        setHasMore(Boolean(data.listings_has_more));
        offsetRef.current =
          Number(data.listings_offset ?? 0) +
          Number(data.listings_limit ?? limit);
        // Keep dropdown open even on empty so callers can show empty state
        setShowResults(true);

        void recordAnalyticsEvent({
          eventType: "search_performed",
          entityType: "search",
          source: "web",
          sourceContext: "search",
          screen: "search",
          context: {
            query,
            limit,
            type: searchType,
            resultCount: transformedResults.length,
            hasResults: transformedResults.length > 0,
            hasGeo: lat != null && lng != null,
            resultTypes: Array.from(
              new Set(transformedResults.map((result) => result.type)),
            ),
          },
        }).then((result) => {
          if (!result.ok && process.env.NODE_ENV === "development") {
            console.warn("Failed to record search analytics event", result);
          }
        });
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search error:", error);
        setSearchResults([]);
        setHasMore(false);
        setShowResults(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    };

    if (debouncedSearchQuery) {
      void performSearchInternal(debouncedSearchQuery);
    } else {
      setSearchResults([]);
      setShowResults(false);
      setHasMore(false);
      offsetRef.current = 0;
    }
  }, [
    debouncedSearchQuery,
    minQueryLength,
    limit,
    searchType,
    buildUrl,
    enabled,
    lat,
    lng,
  ]);

  const loadMore = useCallback(() => {
    const query = debouncedSearchQuery.trim();
    if (
      !query ||
      query.length < minQueryLength ||
      !hasMore ||
      isLoadingMore ||
      isSearching
    ) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoadingMore(true);

    void (async () => {
      try {
        const offset = offsetRef.current;
        const response = await fetch(buildUrl(query, offset, searchType));
        if (!response.ok) throw new Error("Search request failed");
        const data = await response.json();
        if (requestId !== requestIdRef.current) return;

        const page: SearchResult[] = (data.results as ApiSearchResult[])
          .map(mapApiResult)
          // Posts are only appended on offset 0; ignore if API ever sends more
          .filter((r) => r.type === "listing" || r.type === "event");

        setSearchResults((prev) => {
          const seen = new Set(prev.map((r) => `${r.type}-${r.id}`));
          const merged = [...prev];
          for (const row of page) {
            const key = `${row.type}-${row.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(row);
            }
          }
          return merged;
        });
        setHasMore(Boolean(data.listings_has_more));
        offsetRef.current =
          Number(data.listings_offset ?? offset) +
          Number(data.listings_limit ?? limit);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Search load-more error:", error);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoadingMore(false);
        }
      }
    })();
  }, [
    debouncedSearchQuery,
    minQueryLength,
    hasMore,
    isLoadingMore,
    isSearching,
    buildUrl,
    searchType,
    limit,
  ]);

  const getResultUrl = (result: SearchResult) => {
    const basePath =
      result.type === "listing"
        ? "/listing"
        : result.type === "event"
          ? "/events"
          : result.type === "post"
            ? "/guides"
            : "/listings";
    return `${basePath}/${result.slug}`;
  };

  return {
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
    searchType,
    setSearchType,
  };
}
