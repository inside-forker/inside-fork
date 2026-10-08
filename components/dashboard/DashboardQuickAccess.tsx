"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getQuickAccessItems,
  type QuickAccessColor,
} from "@/lib/navigation/role-navigation";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

const INITIAL_VISIBLE = 6;

const colorClasses: Record<
  QuickAccessColor,
  { bg: string; border: string; icon: string; hover: string }
> = {
  primary: {
    bg: "bg-primary/10 dark:bg-primary/20",
    border: "border-primary/20",
    icon: "text-primary",
    hover: "hover:bg-primary/20 dark:hover:bg-primary/30",
  },
  blue: {
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    border: "border-blue-500/20",
    icon: "text-blue-500",
    hover: "hover:bg-blue-500/20 dark:hover:bg-blue-500/30",
  },
  green: {
    bg: "bg-green-500/10 dark:bg-green-500/20",
    border: "border-green-500/20",
    icon: "text-green-500",
    hover: "hover:bg-green-500/20 dark:hover:bg-green-500/30",
  },
  amber: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    border: "border-amber-500/20",
    icon: "text-amber-500",
    hover: "hover:bg-amber-500/20 dark:hover:bg-amber-500/30",
  },
  purple: {
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    border: "border-purple-500/20",
    icon: "text-purple-500",
    hover: "hover:bg-purple-500/20 dark:hover:bg-purple-500/30",
  },
  rose: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    border: "border-rose-500/20",
    icon: "text-rose-500",
    hover: "hover:bg-rose-500/20 dark:hover:bg-rose-500/30",
  },
};

interface DashboardQuickAccessProps {
  /** The user's active role (e.g. profile.active_role || profile.role). */
  role?: string | null;
  title?: string;
  highlight?: string;
  subtitle?: string;
  className?: string;
  /** Cap on how many cards to render. Defaults to a curated 6; pass a higher number (e.g. Infinity) to show every item for that role. */
  max?: number;
}

/**
 * Role-aware "Quick Access" card grid for dashboards. Items come from the
 * same nav lists PremiumSidebar renders (see lib/navigation/role-navigation),
 * so a route surfaced here always matches what that role can already reach
 * from the sidebar — never more, never less.
 */
export function DashboardQuickAccess({
  role,
  title = "Quick",
  highlight = "Access",
  subtitle = "Jump straight to what you need",
  className,
  max = 6,
}: DashboardQuickAccessProps) {
  const { user: liveUser } = useSupabaseUser();
  const items = getQuickAccessItems(role, max, liveUser?.email ?? null);
  const [expanded, setExpanded] = React.useState(false);

  if (items.length === 0) {
    return null;
  }

  const hasMore = items.length > INITIAL_VISIBLE;
  const visibleItems = expanded ? items : items.slice(0, INITIAL_VISIBLE);

  return (
    <div className={cn("space-y-6 md:space-y-8", className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        className="space-y-2"
      >
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Zap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold text-foreground">
            {title} <span className="gradient-text-primary">{highlight}</span>
          </h2>
        </div>
        <p className="text-muted-foreground text-sm md:text-lg">{subtitle}</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        {visibleItems.map((item, index) => {
          const colors = colorClasses[item.color];
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  delay: index * 0.08,
                  duration: 0.6,
                  ease: [0.4, 0, 0.2, 1],
                  type: "spring",
                  stiffness: 100,
                }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl p-6",
                  "glass-card hover:shadow-2xl",
                  "transition-all duration-500 ease-out",
                  "hover:scale-105 hover:-translate-y-2",
                  "cursor-pointer",
                  colors.hover,
                )}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl" />
                  <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-xl" />
                </div>

                {/* Content */}
                <div className="relative z-10 text-center space-y-3 md:space-y-4">
                  <div
                    className={cn(
                      "mx-auto w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center",
                      "transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                      colors.bg,
                      colors.border,
                      "border shadow-lg",
                    )}
                  >
                    <Icon className={cn("h-6 w-6 md:h-8 md:w-8", colors.icon)} />
                  </div>

                  <div className="space-y-1 md:space-y-2">
                    <h3 className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                      {item.name}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Shimmer Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-shimmer" />
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>

      {hasMore && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="flex justify-center"
        >
          <Button
            variant="outline"
            onClick={() => setExpanded((prev) => !prev)}
            className="gap-2 rounded-full"
          >
            {expanded ? (
              <>
                Show less
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Show {items.length - INITIAL_VISIBLE} more
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
