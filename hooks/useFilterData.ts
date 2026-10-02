"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DropdownOption,
  FilterCache,
  LoadingStates,
  SortOption,
  SiteSettings,
} from "@/types/filter.types";
import { useLoadingStates } from "./useLoadingStates";

// Cache configuration
const CACHE_CONFIG = {
  categories: { ttl: 5 * 60 * 1000 }, // 5 minutes
  banks: { ttl: 10 * 60 * 1000 }, // 10 minutes
  cardVariants: { ttl: 3 * 60 * 1000 }, // 3 minutes
  siteSettings: { ttl: 15 * 60 * 1000 }, // 15 minutes
  sortOptions: { ttl: 10 * 60 * 1000 }, // 10 minutes
};

// In-memory cache
const cache: FilterCache & {
  siteSettings: { data: SiteSettings; timestamp: number; ttl: number };
  sortOptions: { data: SortOption[]; timestamp: number; ttl: number };
} = {
  categories: { data: [], timestamp: 0, ttl: CACHE_CONFIG.categories.ttl },
  banks: { data: [], timestamp: 0, ttl: CACHE_CONFIG.banks.ttl },
  cardVariants: {},
  siteSettings: { data: {}, timestamp: 0, ttl: CACHE_CONFIG.siteSettings.ttl },
  sortOptions: { data: [], timestamp: 0, ttl: CACHE_CONFIG.sortOptions.ttl },
};

// Request deduplication - track ongoing requests
const ongoingRequests = new Map<string, Promise<unknown>>();

interface UseFilterDataResult {
  categories: DropdownOption[];
  banks: DropdownOption[];
  cardVariants: DropdownOption[];
  siteSettings: SiteSettings;
  sortOptions: SortOption[];
  loading: LoadingStates;
  error: string | null;
  refetch: {
    categories: () => Promise<void>;
    banks: () => Promise<void>;
    cardVariants: (bankId: string) => Promise<void>;
    siteSettings: () => Promise<void>;
    sortOptions: () => Promise<void>;
  };
  clearCache: () => void;
}

// Default sort options to use while loading or if API fails
const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { key: "featured", label: "Featured", icon_name: "star", is_default: true },
  {
    key: "trending",
    label: "Trending",
    icon_name: "trending-up",
    is_default: false,
  },
  {
    key: "top-rated",
    label: "Top Rated",
    icon_name: "star",
    is_default: false,
  },
  {
    key: "max-discount",
    label: "Best Deals",
    icon_name: "percent",
    is_default: false,
  },
  { key: "newest", label: "Newest", icon_name: "clock", is_default: false },
  { key: "nearest", label: "Nearest", icon_name: "map-pin", is_default: false },
];

export function useFilterData(
  selectedBankId?: string | null
): UseFilterDataResult {
  const [categories, setCategories] = useState<DropdownOption[]>([]);
  const [banks, setBanks] = useState<DropdownOption[]>([]);
  const [cardVariants, setCardVariants] = useState<DropdownOption[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  // Initialize with default sort options so UI is never empty
  const [sortOptions, setSortOptions] =
    useState<SortOption[]>(DEFAULT_SORT_OPTIONS);
  const {
    loading,
    setLoading,
    setMultipleLoading: _setMultipleLoading,
  } = useLoadingStates({
    initialLoad: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper function to check if cache is valid
  const isCacheValid = useCallback(
    (cacheEntry: { timestamp: number; ttl: number }) => {
      return Date.now() - cacheEntry.timestamp < cacheEntry.ttl;
    },
    []
  );

  // Note: Transform functions removed since APIs already return DropdownOption[] format

  // Fetch categories with caching and deduplication
  const fetchCategories = useCallback(async (): Promise<void> => {
    const cacheKey = "categories";

    // Use cached data immediately if available
    if (cache.categories.data && cache.categories.data.length > 0) {
      if (isMountedRef.current) {
        setCategories(cache.categories.data);
      }
      if (isCacheValid(cache.categories)) {
        return;
      }
    }

    // Check for ongoing request
    const ongoing = ongoingRequests.get(cacheKey);
    if (ongoing) {
      try {
        const result = (await ongoing) as DropdownOption[];
        if (isMountedRef.current && Array.isArray(result) && result.length > 0) {
          setCategories(result);
        }
      } catch (err) {
        console.error("Error waiting for ongoing categories request:", err);
      }
      return;
    }

    // Start new request
    if (isMountedRef.current) {
      setLoading("categories", true);
      setError(null);
    }

    const requestPromise = (async () => {
      try {
        const response = await fetch("/api/categories");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch categories");
        }

        const categoryOptions = data.categories || [];

        // Update cache
        cache.categories = {
          data: categoryOptions,
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.categories.ttl,
        };

        return categoryOptions;
      } finally {
        ongoingRequests.delete(cacheKey);
        if (isMountedRef.current) {
          setLoading("categories", false);
        }
      }
    })();

    ongoingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      if (isMountedRef.current && Array.isArray(result)) {
        setCategories(result);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch categories"
        );
      }
    }
  }, [isCacheValid, setLoading]);

  // Fetch banks with caching and deduplication
  const fetchBanks = useCallback(async (): Promise<void> => {
    const cacheKey = "banks";

    // Use cached data immediately if available
    if (cache.banks.data && cache.banks.data.length > 0) {
      if (isMountedRef.current) {
        setBanks(cache.banks.data);
      }
      if (isCacheValid(cache.banks)) {
        return;
      }
    }

    // Check for ongoing request
    const ongoing = ongoingRequests.get(cacheKey);
    if (ongoing) {
      try {
        const result = (await ongoing) as DropdownOption[];
        if (isMountedRef.current && Array.isArray(result) && result.length > 0) {
          setBanks(result);
        }
      } catch (err) {
        console.error("Error waiting for ongoing banks request:", err);
      }
      return;
    }

    // Start new request
    if (isMountedRef.current) {
      setLoading("filterApply", true);
      setError(null);
    }

    const requestPromise = (async () => {
      try {
        const response = await fetch("/api/banks");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch banks");
        }

        const bankList = data.banks || [];

        // Update cache
        cache.banks = {
          data: bankList,
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.banks.ttl,
        };

        return bankList;
      } finally {
        ongoingRequests.delete(cacheKey);
        if (isMountedRef.current) {
          setLoading("filterApply", false);
        }
      }
    })();

    ongoingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      if (isMountedRef.current && Array.isArray(result)) {
        setBanks(result);
      }
    } catch (err) {
      console.error("Error fetching banks:", err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch banks");
      }
    }
  }, [isCacheValid, setLoading]);

  // Fetch card variants with caching and deduplication
  const fetchCardVariants = useCallback(
    async (bankId: string): Promise<void> => {
      if (!bankId) {
        if (isMountedRef.current) {
          setCardVariants([]);
        }
        return;
      }

      const cacheKey = `cardVariants-${bankId}`;

      // Check cache first
      const cachedCardVariants = cache.cardVariants[bankId];
      if (cachedCardVariants && cachedCardVariants.data?.length > 0) {
        if (isMountedRef.current) {
          setCardVariants(cachedCardVariants.data);
        }
        if (isCacheValid(cachedCardVariants)) {
          return;
        }
      }

      // Check for ongoing request
      const ongoing = ongoingRequests.get(cacheKey);
      if (ongoing) {
        try {
          const result = (await ongoing) as DropdownOption[];
          if (isMountedRef.current && Array.isArray(result)) {
            setCardVariants(result);
          }
        } catch (err) {
          console.error(
            "Error waiting for ongoing card variants request:",
            err
          );
        }
        return;
      }

      // Start new request
      if (isMountedRef.current) {
        setLoading("cardVariants", true);
        setError(null);
      }

      const requestPromise = (async () => {
        try {
          const response = await fetch(`/api/cards?bankId=${bankId}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();

          const rawCards = Array.isArray(data.cards) ? data.cards : [];
          const normalizedCards: DropdownOption[] = rawCards.map(
            (c: Record<string, unknown>) => ({
              value: String(c.value ?? c.id ?? ""),
              label: String(c.label ?? c.card_name ?? c.name ?? "Card"),
              disabled: Boolean(c.disabled),
            }),
          );

          // Update cache
          cache.cardVariants[bankId] = {
            data: normalizedCards,
            timestamp: Date.now(),
            ttl: CACHE_CONFIG.cardVariants.ttl,
          };

          return normalizedCards;
        } finally {
          ongoingRequests.delete(cacheKey);
          if (isMountedRef.current) {
            setLoading("cardVariants", false);
          }
        }
      })();

      ongoingRequests.set(cacheKey, requestPromise);

      try {
        const result = await requestPromise;
        if (isMountedRef.current && Array.isArray(result)) {
          setCardVariants(result);
        }
      } catch (err) {
        console.error("Error fetching card variants:", err);
        if (isMountedRef.current) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch card variants"
          );
        }
      }
    },
    [isCacheValid, setLoading]
  );

  // Fetch site settings with caching and deduplication
  const fetchSiteSettings = useCallback(async (): Promise<void> => {
    const cacheKey = "siteSettings";

    // Check cache first
    if (
      isCacheValid(cache.siteSettings) &&
      Object.keys(cache.siteSettings.data).length > 0
    ) {
      if (isMountedRef.current) {
        setSiteSettings(cache.siteSettings.data);
      }
      return;
    }

    // Check for ongoing request
    if (ongoingRequests.has(cacheKey)) {
      try {
        const result = (await ongoingRequests.get(cacheKey)) as SiteSettings;
        if (isMountedRef.current) {
          setSiteSettings(result);
        }
      } catch (err) {
        console.error("Error waiting for ongoing site settings request:", err);
      }
      return;
    }

    // Start new request
    const requestPromise = fetch("/api/site-settings")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch site settings");
        }

        // Update cache
        cache.siteSettings = {
          data: data.settings || {},
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.siteSettings.ttl,
        };

        return data.settings || {};
      })
      .finally(() => {
        ongoingRequests.delete(cacheKey);
      });

    ongoingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      if (isMountedRef.current) {
        setSiteSettings(result);
      }
    } catch (err) {
      console.error("Error fetching site settings:", err);
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch site settings"
        );
      }
    }
  }, [isCacheValid]);

  // Fetch sort options with caching and deduplication
  const fetchSortOptions = useCallback(async (): Promise<void> => {
    const cacheKey = "sortOptions";

    // Check cache first
    if (isCacheValid(cache.sortOptions) && cache.sortOptions.data.length > 0) {
      if (isMountedRef.current) {
        setSortOptions(cache.sortOptions.data);
      }
      return;
    }

    // Check for ongoing request
    if (ongoingRequests.has(cacheKey)) {
      try {
        const result = (await ongoingRequests.get(cacheKey)) as SortOption[];
        if (isMountedRef.current) {
          setSortOptions(result);
        }
      } catch (err) {
        console.error("Error waiting for ongoing sort options request:", err);
      }
      return;
    }

    // Start new request
    const requestPromise = fetch("/api/sort-options")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch sort options");
        }

        // Update cache
        cache.sortOptions = {
          data: data.sortOptions || [],
          timestamp: Date.now(),
          ttl: CACHE_CONFIG.sortOptions.ttl,
        };

        return data.sortOptions || [];
      })
      .finally(() => {
        ongoingRequests.delete(cacheKey);
      });

    ongoingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      if (isMountedRef.current) {
        setSortOptions(result);
      }
    } catch (err) {
      console.error("Error fetching sort options:", err);
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch sort options"
        );
      }
    }
  }, [isCacheValid]);

  // Clear all caches
  const clearCache = useCallback(() => {
    cache.categories = {
      data: [],
      timestamp: 0,
      ttl: CACHE_CONFIG.categories.ttl,
    };
    cache.banks = { data: [], timestamp: 0, ttl: CACHE_CONFIG.banks.ttl };
    cache.cardVariants = {};
    cache.siteSettings = {
      data: {},
      timestamp: 0,
      ttl: CACHE_CONFIG.siteSettings.ttl,
    };
    cache.sortOptions = {
      data: [],
      timestamp: 0,
      ttl: CACHE_CONFIG.sortOptions.ttl,
    };
    ongoingRequests.clear();
  }, []);

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      if (isMountedRef.current) {
        setLoading("initialLoad", true);
      }

      try {
        await Promise.all([
          fetchCategories(),
          fetchBanks(),
          fetchSiteSettings(),
          fetchSortOptions(),
        ]);
      } catch (err) {
        console.error("Error loading initial filter data:", err);
      } finally {
        if (isMountedRef.current) {
          setLoading("initialLoad", false);
        }
      }
    };

    loadInitialData();
  }, [
    fetchCategories,
    fetchBanks,
    fetchSiteSettings,
    fetchSortOptions,
    setLoading,
  ]);

  // Load card variants when bank is selected
  useEffect(() => {
    if (selectedBankId) {
      fetchCardVariants(selectedBankId);
    } else {
      setCardVariants([]);
    }
  }, [selectedBankId, fetchCardVariants]);

  return {
    categories,
    banks,
    cardVariants,
    siteSettings,
    sortOptions,
    loading,
    error,
    refetch: {
      categories: fetchCategories,
      banks: fetchBanks,
      cardVariants: fetchCardVariants,
      siteSettings: fetchSiteSettings,
      sortOptions: fetchSortOptions,
    },
    clearCache,
  };
}
