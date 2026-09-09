"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import type { NotificationsFeedHandle } from "@/hooks/useNotificationsFeed";
import { recordAnalyticsEvent } from "@/lib/analytics/client";
import { NotificationsPanel } from "./NotificationsPanel";
import { FullScreenNotifications } from "./FullScreenNotifications";

interface NotificationBellProps {
  className?: string;
  variant?: "adaptive" | "mobile" | "desktop";
}

const MAX_BADGE = 99;

function formatUnreadCount(count: number): string {
  if (count > MAX_BADGE) {
    return `${MAX_BADGE}+`;
  }
  return String(count);
}

function NotificationBellDesktop({
  feed,
  className,
}: {
  feed: NotificationsFeedHandle;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      void feed.openFeed();
      // Analytics: panel opened
      void recordAnalyticsEvent({
        eventType: "page_view",
        entityType: "notifications_panel",
        source: "web",
        sourceContext: "notification",
        screen: "notifications_panel",
        context: {
          variant: "desktop",
          unreadBefore: feed.unreadCount,
          items: feed.items.length,
          initialized: feed.isInitialized,
        },
      });
    }
  }, [open, feed]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const body = document.body;
    const removeScrollLock = () => {
      body.removeAttribute("data-scroll-locked");
      body.style.marginRight = "";
      body.style.paddingRight = "";
      body.style.overflow = "";
    };

    removeScrollLock();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          const attr = mutation.attributeName;
          if (attr === "data-scroll-locked" || attr === "style") {
            removeScrollLock();
          }
        }
      }
    });

    observer.observe(body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style"],
    });

    return () => {
      observer.disconnect();
      removeScrollLock();
    };
  }, [open]);

  const unread = feed.unreadCount;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 dark:border-border/50",
            className
          )}
        >
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
          {unread > 0 && (
            <motion.span
              layoutId="notification-count"
              className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground shadow-lg"
            >
              {formatUnreadCount(unread)}
            </motion.span>
          )}
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={16}
        className="w-[400px] overflow-hidden rounded-3xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-xl"
      >
        <NotificationsPanel
          feed={feed}
          variant="desktop"
          onClose={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationBellMobile({
  feed,
  className,
}: {
  feed: NotificationsFeedHandle;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      void feed.openFeed();
      // Analytics: panel opened
      void recordAnalyticsEvent({
        eventType: "page_view",
        entityType: "notifications_panel",
        source: "web",
        sourceContext: "notification",
        screen: "notifications_panel",
        context: {
          variant: "mobile",
          unreadBefore: feed.unreadCount,
          items: feed.items.length,
          initialized: feed.isInitialized,
        },
      });
    }
  }, [open, feed]);

  const unread = feed.unreadCount;

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80 transition-all duration-200 hover:border-primary/40 hover:bg-primary/10",
          className
        )}
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unread > 0 && (
          <motion.span
            layoutId="notification-count"
            className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground"
          >
            {formatUnreadCount(unread)}
          </motion.span>
        )}
      </motion.button>

      <FullScreenNotifications
        isOpen={open}
        onClose={() => setOpen(false)}
        feed={feed}
      />
    </>
  );
}

export function NotificationBell({
  className,
  variant = "adaptive",
}: NotificationBellProps) {
  const feed = useNotificationsFeed({
    pageSize: 12,
    initialFilters: { status: "unread" },
  });

  const showMobile = variant === "adaptive" || variant === "mobile";
  const showDesktop = variant === "adaptive" || variant === "desktop";

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {showMobile && (
        <div className={cn(variant === "mobile" ? "" : "md:hidden")}>
          <NotificationBellMobile feed={feed} />
        </div>
      )}
      {showDesktop && (
        <div className={cn(variant === "desktop" ? "" : "hidden md:block")}>
          <NotificationBellDesktop feed={feed} />
        </div>
      )}
    </div>
  );
}
