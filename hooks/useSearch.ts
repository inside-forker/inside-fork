"use client";

import { useState, useEffect } from "react";
// pure hook - do not depend on router here so callers can decide how to navigate
import { useDebounce } from "@/hooks/useDebounce";
import { recordAnalyticsEvent } from "@/lib/analytics/client";

export interface SearchResult {
  id: number;
  name: string;
  type: "listing" | "category" | "event" | "post";
  slug: string;
  category?: string;
  address?: string;
  description?: string;
}

interface UseSearchProps {
  debounceMs?: number;
  minQueryLength?: number;
  limit?: number;
}

interface UseSearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  isSearching: boolean;
  showResults: boolean;
  setShowResults: (show: boolean) => void;
  getResultUrl: (result: SearchResult) => string;
}

export function useSearch({
  debounceMs = 300,
  minQueryLength = 2,
  limit = 8,
}: UseSearchProps = {}): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // no router here - let callers handle navigation so the hook stays side-effect free

  // Production-ready debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, debounceMs);

  // Production-ready debounced search effect
  useEffect(() => {
    const performSearchInternal = async (query: string) => {
      if (!query.trim() || query.length < minQueryLength) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      setShowResults(true);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data = await response.json();

        // Transform API results to match our interface
        const transformedResults: SearchResult[] = data.results.map(
          (result: {
            id: number;
            name?: string;
            title?: string;
            slug: string;
            type: string;
            category?: string;
            address?: string;
            description?: string;
            excerpt?: string;
          }) => ({
            id: result.id,
            name: result.name || result.title || "",
            slug: result.slug,
            type: result.type as "listing" | "category" | "event" | "post",
            category: result.category,
            address: result.address,
            description: result.description || result.excerpt,
          })
        );

        setSearchResults(transformedResults);
        setShowResults(transformedResults.length > 0);

        void recordAnalyticsEvent({
          eventType: "search_performed",
          entityType: "search",
          source: "web",
          sourceContext: "search",
          screen: "search",
          context: {
            query,
            limit,
            resultCount: transformedResults.length,
            hasResults: transformedResults.length > 0,
            resultTypes: Array.from(
              new Set(transformedResults.map((result) => result.type))
            ),
          },
        }).then((result) => {
          if (!result.ok && process.env.NODE_ENV === "development") {
            console.warn("Failed to record search analytics event", result);
          }
        });
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setIsSearching(false);
      }
    };

    if (debouncedSearchQuery) {
      performSearchInternal(debouncedSearchQuery);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [debouncedSearchQuery, minQueryLength, limit]);

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
    showResults,
    setShowResults,
    getResultUrl,
  };
}
