/**
 * Security Alerts Hook
 * Polls /api/admin/security/events for unresolved critical/high severity events
 * (Supabase Realtime is no longer available - see MEMORY notes on the Supabase migration)
 * Provides browser notifications for super admins
 */

import * as React from "react";

export interface SecurityAlert {
  id: number;
  event_type: string;
  severity: "low" | "medium" | "high" | "critical";
  user_email?: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  request_count?: number;
  resolved: boolean;
  created_at: string;
}

interface UseSecurityAlertsOptions {
  /**
   * Enable browser notifications
   * @default true
   */
  enableNotifications?: boolean;

  /**
   * Filter by severity levels
   * @default ["critical", "high"]
   */
  severityLevels?: Array<"low" | "medium" | "high" | "critical">;

  /**
   * Maximum alerts to keep in memory
   * @default 50
   */
  maxAlerts?: number;

  /**
   * Auto-dismiss alerts after (ms)
   * @default 30000 (30 seconds)
   */
  autoDismissMs?: number;

  /**
   * Polling interval (ms)
   * @default 20000 (20 seconds)
   */
  pollIntervalMs?: number;
}

interface UseSecurityAlertsReturn {
  alerts: SecurityAlert[];
  unreadCount: number;
  isConnected: boolean;
  connectionError?: string;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  clearAlerts: () => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

/**
 * Hook to poll for new security alerts
 */
export function useSecurityAlerts(
  options: UseSecurityAlertsOptions = {}
): UseSecurityAlertsReturn {
  const {
    enableNotifications = true,
    severityLevels = ["critical", "high"],
    maxAlerts = 50,
    autoDismissMs = 30000,
    pollIntervalMs = 20000,
  } = options;

  const [alerts, setAlerts] = React.useState<SecurityAlert[]>([]);
  const [readAlertIds, setReadAlertIds] = React.useState<Set<number>>(
    new Set()
  );
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string>();
  const seenIdsRef = React.useRef<Set<number>>(new Set());
  const consecutiveFailuresRef = React.useRef(0);

  // Request notification permission
  const requestNotificationPermission =
    React.useCallback(async (): Promise<NotificationPermission> => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        console.warn("[SECURITY ALERTS] Notifications not supported");
        return "denied";
      }

      if (window.Notification.permission === "granted") {
        return "granted";
      }

      if (window.Notification.permission === "denied") {
        return "denied";
      }

      try {
        const permission = await window.Notification.requestPermission();
        return permission;
      } catch (error) {
        console.error("[SECURITY ALERTS] Permission error:", error);
        return "denied";
      }
    }, []);

  // Show browser notification
  const showNotification = React.useCallback(
    (alert: SecurityAlert) => {
      if (
        !enableNotifications ||
        typeof window === "undefined" ||
        !("Notification" in window) ||
        window.Notification.permission !== "granted"
      ) {
        return;
      }

      const title =
        alert.severity === "critical"
          ? "🚨 Critical Security Alert"
          : "⚠️ Security Alert";

      const body = `${alert.event_type.replace(/_/g, " ").toUpperCase()}\n${
        alert.user_email || alert.ip_address || "Unknown source"
      }`;

      try {
        const notification = new window.Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `security-alert-${alert.id}`,
          requireInteraction: alert.severity === "critical",
          silent: false,
        });

        // Auto-close notification
        setTimeout(() => {
          notification.close();
        }, 10000);

        // Click handler to focus window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn("[SECURITY ALERTS] Notification creation failed:", e);
      }
    },
    [enableNotifications]
  );

  // Mark alert as read
  const markAsRead = React.useCallback((id: number) => {
    setReadAlertIds((prev) => new Set([...prev, id]));
  }, []);

  // Mark all as read
  const markAllAsRead = React.useCallback(() => {
    setReadAlertIds((prev) => {
      const newSet = new Set(prev);
      alerts.forEach((alert) => newSet.add(alert.id));
      return newSet;
    });
  }, [alerts]);

  // Clear all alerts
  const clearAlerts = React.useCallback(() => {
    setAlerts([]);
    setReadAlertIds(new Set());
    seenIdsRef.current = new Set();
  }, []);

  // Auto-dismiss old alerts
  React.useEffect(() => {
    if (autoDismissMs <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setAlerts((prev) =>
        prev.filter((alert) => {
          const alertTime = new Date(alert.created_at).getTime();
          return now - alertTime < autoDismissMs;
        })
      );
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [autoDismissMs]);

  // Poll for new security alerts
  React.useEffect(() => {
    let mounted = true;

    // Request notification permission on mount if supported
    if (
      enableNotifications &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      window.Notification.permission === "default"
    ) {
      void requestNotificationPermission();
    }

    const fetchAlerts = async () => {
      try {
        const params = new URLSearchParams({
          resolved: "false",
          limit: String(maxAlerts),
        });
        const res = await fetch(`/api/admin/security/events?${params}`, {
          cache: "no-store",
        });

        if (!mounted) return;

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();
        const events: SecurityAlert[] = Array.isArray(data.events)
          ? data.events
          : [];

        // Only surface alerts matching the configured severity filter
        const relevant = events.filter((e) =>
          severityLevels.includes(e.severity)
        );

        // Detect newly-seen alerts (for notifications) before updating state
        const newlySeen = relevant.filter((e) => !seenIdsRef.current.has(e.id));
        newlySeen.forEach((alert) => {
          seenIdsRef.current.add(alert.id);
          showNotification(alert);
        });

        setAlerts(relevant.slice(0, maxAlerts));
        setIsConnected(true);
        setConnectionError(undefined);
        consecutiveFailuresRef.current = 0;
      } catch (error) {
        if (!mounted) return;
        consecutiveFailuresRef.current += 1;
        setIsConnected(false);
        if (consecutiveFailuresRef.current >= 3) {
          setConnectionError(
            "Unable to reach security alerts endpoint. Retrying..."
          );
        }
        console.warn("[SECURITY ALERTS] Poll failed:", error);
      }
    };

    // Initial fetch
    void fetchAlerts();

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchAlerts();
    }, pollIntervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs, maxAlerts]);

  // Calculate unread count
  const unreadCount = React.useMemo(() => {
    return alerts.filter((alert) => !readAlertIds.has(alert.id)).length;
  }, [alerts, readAlertIds]);

  return {
    alerts,
    unreadCount,
    isConnected,
    connectionError,
    markAsRead,
    markAllAsRead,
    clearAlerts,
    requestNotificationPermission,
  };
}
