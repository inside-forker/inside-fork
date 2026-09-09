"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { recordAnalyticsEvent } from "@/lib/analytics/client";

import { useSupabaseUser } from "@/hooks/useSupabaseUser";

import type {
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFeedStatusFilter,
} from "@/types/notifications.types";

type FetchState = "idle" | "loading" | "loading-more" | "error";

const DEFAULT_PAGE_SIZE = 12;

interface UseNotificationsFeedOptions {
  pageSize?: number;
  autoRefreshMs?: number | null;
  initialFilters?: NotificationFeedFilters;
}

interface FetchNotificationsResponse {
  notifications: NotificationFeedItem[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
    unreadCount: number;
  };
}

type NotificationMap = Map<string, NotificationFeedItem>;

type MarkingState = Map<string, boolean>;

type FiltersUpdater =
  | NotificationFeedFilters
  | ((prev: NotificationFeedFilters) => NotificationFeedFilters);

const DEFAULT_STATUS: NotificationFeedStatusFilter = "all";

const filtersEqual = (a: NotificationFeedFilters, b: NotificationFeedFilters) =>
  a.status === b.status &&
  a.includeArchived === b.includeArchived &&
  (a.search ?? "") === (b.search ?? "") &&
  (a.channel ?? "all") === (b.channel ?? "all") &&
  (a.priority ?? "all") === (b.priority ?? "all");

const sanitizeFilters = (
  filters?: NotificationFeedFilters,
): NotificationFeedFilters => {
  const status = filters?.status ?? DEFAULT_STATUS;
  const trimmedSearch = filters?.search?.trim() ?? "";
  const includeArchived =
    typeof filters?.includeArchived === "boolean"
      ? filters.includeArchived
      : status === "archived";

  return {
    status,
    includeArchived,
    search: trimmedSearch,
    channel: filters?.channel ?? "all",
    priority: filters?.priority ?? "all",
  };
};

const buildQueryString = (
  params: Record<string, string | number | undefined | null>,
) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export interface NotificationsFeedHandle {
  items: NotificationFeedItem[];
  unreadCount: number;
  hasMore: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isMarkingAll: boolean;
  markingIds: MarkingState;
  error: Error | null;
  filters: NotificationFeedFilters;
  openFeed: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string, archive?: boolean) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setFilters: (
    updater:
      | NotificationFeedFilters
      | ((prev: NotificationFeedFilters) => NotificationFeedFilters),
  ) => Promise<void>;
}

export function useNotificationsFeed(
  options: UseNotificationsFeedOptions = {},
): NotificationsFeedHandle {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  const initialFiltersRef = useRef<NotificationFeedFilters | null>(null);
  if (!initialFiltersRef.current) {
    initialFiltersRef.current = sanitizeFilters(options.initialFilters);
  }

  const [filters, setFiltersState] = useState<NotificationFeedFilters>(
    initialFiltersRef.current,
  );
  const filtersRef = useRef<NotificationFeedFilters>(initialFiltersRef.current);

  const [items, setItems] = useState<NotificationFeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const stateRef = useRef<FetchState>("idle");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const markingIdsRef = useRef<MarkingState>(new Map());
  const controllerRef = useRef<AbortController | null>(null);
  const refreshingRef = useRef<Promise<void> | null>(null);
  const { userId, isLoading: authLoading } = useSupabaseUser();
  const lastUserIdRef = useRef<string | null>(null);

  const [markingMap, setMarkingMap] = useState<MarkingState>(new Map());

  const updateMarking = useCallback((id: string, value: boolean) => {
    markingIdsRef.current.set(id, value);
    // Force re-render by creating new map instance
    setMarkingMap(new Map(markingIdsRef.current));
  }, []);

  const resetController = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    return controllerRef.current;
  }, []);

  const fetchNotifications = useCallback(
    async (cursor?: string | null, replace = false) => {
      if (!userId) {
        setState("idle");
        stateRef.current = "idle";
        return;
      }

      const controller = resetController();
      let cancelled = false;
      const nextState: FetchState = cursor ? "loading-more" : "loading";
      setState(nextState);
      stateRef.current = nextState;
      setError(null);

      const activeFilters = filtersRef.current;
      const query = buildQueryString({
        cursor: cursor ?? undefined,
        limit: pageSize,
        includeArchived: activeFilters.includeArchived ? "true" : undefined,
        status:
          activeFilters.status && activeFilters.status !== "all"
            ? activeFilters.status
            : undefined,
        channel:
          activeFilters.channel && activeFilters.channel !== "all"
            ? activeFilters.channel
            : undefined,
        priority:
          activeFilters.priority && activeFilters.priority !== "all"
            ? activeFilters.priority
            : undefined,
        search: activeFilters.search ? activeFilters.search : undefined,
      });

      try {
        const doFetch = () =>
          fetch(`/api/notifications${query}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            cache: "no-store",
          });

        let response = await doFetch();
        // A 5xx here is almost always a transient DB connection blip on the
        // server, not a real failure - one retry after a short delay avoids
        // surfacing a rare blip as a user-facing error.
        if (!response.ok && response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          response = await doFetch();
        }

        if (!response.ok) {
          throw new Error(`Failed to load notifications: ${response.status}`);
        }

        const data = (await response.json()) as FetchNotificationsResponse;

        setItems((current) => {
          const base = replace ? [] : current;
          const map: NotificationMap = new Map();
          base.forEach((item) => {
            map.set(item.id, item);
          });
          data.notifications.forEach((item) => {
            map.set(item.id, item);
          });
          return Array.from(map.values());
        });
        setUnreadCount(data.meta.unreadCount);
        setHasMore(data.meta.hasMore);
        setNextCursor(data.meta.nextCursor ?? null);
        setIsInitialized(true);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          cancelled = true;
          return;
        }
        console.error("Notifications fetch error", err);
        setError(err as Error);
      } finally {
        if (!cancelled) {
          setState("idle");
          stateRef.current = "idle";
        }
      }
    },
    [pageSize, resetController, userId],
  );

  const openFeed = useCallback(async () => {
    if (!userId) {
      return;
    }
    if (stateRef.current === "loading" || stateRef.current === "loading-more") {
      return;
    }
    if (isInitialized) {
      return;
    }
    await fetchNotifications(null, true);
  }, [fetchNotifications, isInitialized, userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }
    if (stateRef.current === "loading" || stateRef.current === "loading-more") {
      return refreshingRef.current ?? Promise.resolve();
    }

    const promise = fetchNotifications(null, true);
    refreshingRef.current = promise;
    await promise;
    refreshingRef.current = null;
  }, [fetchNotifications, userId]);

  useEffect(() => {
    void fetchNotifications(null, true);
  }, [fetchNotifications]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (lastUserIdRef.current === userId) {
      return;
    }

    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    refreshingRef.current = null;
    stateRef.current = "idle";
    setState("idle");
    setError(null);
    setItems([]);
    setUnreadCount(0);
    setHasMore(false);
    setNextCursor(null);
    setIsInitialized(false);
    markingIdsRef.current.clear();
    setMarkingMap(new Map());

    const baseFilters = { ...initialFiltersRef.current };
    filtersRef.current = baseFilters;
    setFiltersState(baseFilters);

    lastUserIdRef.current = userId ?? null;

    if (!userId) {
      return;
    }

    void fetchNotifications(null, true);
  }, [authLoading, userId, fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!userId) {
      return;
    }
    if (!hasMore || !nextCursor) {
      return;
    }
    if (stateRef.current === "loading-more" || stateRef.current === "loading") {
      return;
    }
    await fetchNotifications(nextCursor, false);
  }, [fetchNotifications, hasMore, nextCursor, userId]);

  const markAsRead = useCallback(
    async (id: string, archive = false) => {
      const target = items.find((item) => item.id === id);
      if (!target) {
        return;
      }
      if (markingIdsRef.current.get(id)) {
        return;
      }

      const optimisticTimestamp = new Date().toISOString();
      const previousUnreadCount = unreadCount;

      // Optimistic update
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                readAt: item.readAt ?? optimisticTimestamp,
                archivedAt: archive
                  ? (item.archivedAt ?? optimisticTimestamp)
                  : item.archivedAt,
              }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(count - (target.readAt ? 0 : 1), 0));
      updateMarking(id, true);

      try {
        const response = await fetch(`/api/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: archive ? JSON.stringify({ archive }) : undefined,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to mark notification read: ${response.status}`,
          );
        }

        const data = (await response.json()) as {
          success: boolean;
          unreadCount: number;
        };
        setUnreadCount(data.unreadCount);

        // Analytics: single notification marked as read
        void recordAnalyticsEvent({
          eventType: "admin_action",
          entityType: "notification",
          entityId: id,
          source: "web",
          sourceContext: "notification",
          screen: "notifications_feed",
          context: {
            action: archive ? "mark_read_and_archive" : "mark_read",
            unreadBefore: previousUnreadCount,
            unreadAfter: data.unreadCount,
            category: target.categorySlug,
            priority: target.priority,
            channels: target.channels.map((c) => ({
              channel: c.channel,
              status: c.status,
              sentAt: c.sentAt,
            })),
          },
        });
      } catch (err) {
        console.error("Failed to mark notification read", err);
        // revert optimistic update
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  readAt: target.readAt ?? null,
                  archivedAt: target.archivedAt ?? null,
                }
              : item,
          ),
        );
        setUnreadCount(previousUnreadCount);
      } finally {
        updateMarking(id, false);
      }
    },
    [items, unreadCount, updateMarking],
  );

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAll || unreadCount === 0) {
      return;
    }

    setIsMarkingAll(true);
    const optimisticTimestamp = new Date().toISOString();
    const previousItems = items;
    const previousUnreadCount = unreadCount;

    // Optimistic update
    setItems((current) =>
      current.map((item) =>
        item.readAt
          ? item
          : {
              ...item,
              readAt: optimisticTimestamp,
            },
      ),
    );
    setUnreadCount(0);

    try {
      const response = await fetch(`/api/notifications/mark-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to mark all notifications read: ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        success: boolean;
        updated: number;
        unreadCount: number;
      };
      setUnreadCount(data.unreadCount);
      await refresh();

      // Analytics: mark all as read
      void recordAnalyticsEvent({
        eventType: "admin_action",
        entityType: "notifications_feed",
        source: "web",
        sourceContext: "notification",
        screen: "notifications_feed",
        context: {
          action: "mark_all_read",
          updated: data.updated,
          unreadBefore: previousUnreadCount,
          unreadAfter: data.unreadCount,
        },
      });
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
      setItems(previousItems);
      setUnreadCount(previousUnreadCount);
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unreadCount, items, refresh]);

  const setFilters = useCallback(
    async (updater: FiltersUpdater) => {
      const nextRaw =
        typeof updater === "function"
          ? updater(filtersRef.current)
          : { ...filtersRef.current, ...updater };
      const next = sanitizeFilters(nextRaw);

      if (filtersEqual(filtersRef.current, next)) {
        return;
      }

      filtersRef.current = next;
      setFiltersState(next);
      setNextCursor(null);
      setHasMore(false);
      setItems([]);
      await fetchNotifications(null, true);
    },
    [fetchNotifications],
  );

  const handleRealtimeRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh(
    userId ? `notifications-feed:${userId}` : "notifications-feed",
    userId
      ? [
          {
            table: "notifications",
            filter: `recipient_id=eq.${userId}`,
          },
        ]
      : [],
    handleRealtimeRefresh,
    400,
  );

  return useMemo(
    () => ({
      items,
      unreadCount,
      hasMore,
      isInitialized,
      isLoading: state === "loading",
      isLoadingMore: state === "loading-more",
      isMarkingAll,
      markingIds: markingMap,
      error,
      filters,
      openFeed,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      setFilters,
    }),
    [
      items,
      unreadCount,
      hasMore,
      isInitialized,
      state,
      isMarkingAll,
      markingMap,
      error,
      filters,
      openFeed,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
      setFilters,
    ],
  );
}
