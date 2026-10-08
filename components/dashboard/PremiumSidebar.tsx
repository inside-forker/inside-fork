"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthLinks } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import { useUserGamification } from "@/hooks/useUserGamification";
import { useRole } from "@/lib/context/RoleContext";
import {
  MapPin,
  Calendar,
  Store,
  User as UserIcon,
  Shield,
  Sparkles,
  PenSquare,
  LogOut,
  LogIn,
  ChevronRight,
  X,
} from "lucide-react";
import {
  publicUserNavigation as navigation,
  publicUserSecondaryNavigation as secondaryNavigation,
  businessOwnerNavigation,
  businessOwnerSecondaryNavigation,
  writerNavigation,
  writerSecondaryNavigation,
  adminMainNavigation,
  adminSecondaryNavigation,
  adminNavigation,
  listerNavigation,
  listerSecondaryNavigation,
  dataEntryNavigation,
  dataEntrySecondaryNavigation,
  organizerMainNavigation,
  organizerSecondaryNavigation,
  type RoleNavItem as SidebarNavItem,
} from "@/lib/navigation/role-navigation";

interface ProfileShape {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  active_role?: string; // Added for role switching
}

interface SidebarStats {
  users?: number;
  events?: number;
  listings?: number;
  reviews?: number;
  bookings?: number;
  favorites?: number;
}

interface SidebarUser {
  id: string;
  email?: string;
}

interface PremiumSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user?: SidebarUser | { id: string; email?: string } | null;
  profile?: ProfileShape | null;
  stats?: SidebarStats;
  loadingStats?: boolean;
}

export function PremiumSidebar({
  isOpen,
  onClose,
  user,
  profile,
  stats,
  loadingStats,
}: PremiumSidebarProps) {
  const pathname = usePathname();
  const { loginHref } = useAuthLinks();
  const { user: roleUser, switchRole } = useRole();
  const [isSwitching, setIsSwitching] = React.useState(false);

  // Auto-fetch stats if not provided by parent
  const [internalStats, setInternalStats] = React.useState<SidebarStats>(stats || {});
  const [internalLoadingStats, setInternalLoadingStats] = React.useState<boolean>(
    loadingStats ?? true,
  );

  React.useEffect(() => {
    if (stats && Object.keys(stats).length > 0) {
      setInternalStats(stats);
      setInternalLoadingStats(loadingStats ?? false);
      return;
    }

    if (!user?.id || !isOpen) {
      setInternalLoadingStats(false);
      return;
    }

    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem("sidebar_stats");
      if (cached) {
        try {
          setInternalStats(JSON.parse(cached));
          setInternalLoadingStats(false);
        } catch (e) {
          // ignore
        }
      }
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/dashboard/sidebar-stats");
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.stats) {
            setInternalStats(data.stats);
            if (typeof window !== "undefined") {
              sessionStorage.setItem("sidebar_stats", JSON.stringify(data.stats));
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch sidebar stats:", error);
      } finally {
        setInternalLoadingStats(false);
      }
    };

    fetchStats();
  }, [stats, loadingStats, user?.id, isOpen]);

  // Use active_role for navigation and display
  const activeRole = (profile?.active_role || profile?.role || "public_user") as string;
  const permanentRole = profile?.role as string;
  const canSwitchRoles = roleUser?.canSwitchRoles || false;

  // Determine user type based on active role
  const isAdmin = activeRole === "admin" || activeRole === "super_admin";
  const isLister = activeRole === "lister";
  const isDataEntry = activeRole === "data_entry";
  const isOrganizer = activeRole === "organizer";
  const isBusinessOwner = activeRole === "business_owner";
  const isWriter = activeRole === "writer";

  // Only fetch gamification data for regular users
  const shouldShowGamification =
    Boolean(user?.id) &&
    !isAdmin &&
    !isLister &&
    !isDataEntry &&
    !isOrganizer &&
    !isBusinessOwner &&
    !isWriter;
  const { xpTotal, rank } = useUserGamification(
    shouldShowGamification && user?.id ? user.id : "",
  );

  // Calculate progress to next rank - show current rank dynamically
  const [currentRankDisplay, setCurrentRankDisplay] =
    React.useState<string>(rank);
  const [nextRankName, setNextRankName] = React.useState<string>("Explorer");
  const [progressPercent, setProgressPercent] = React.useState<number>(0);

  React.useEffect(() => {
    const fetchRanks = async () => {
      try {
        const response = await fetch("/api/gamification/ranks");
        if (response.ok) {
          const data = await response.json();
          const ranks = data.ranks || [];

          // Always display the current rank from the hook
          setCurrentRankDisplay(rank || "Unranked");

          // Find current rank object to determine next rank
          const currentRankObj = ranks.find(
            (r: { name: string }) => r.name === rank,
          );

          if (!currentRankObj) {
            // User might be unranked - show first achievable rank as next
            if (ranks.length > 0) {
              setNextRankName(ranks[0].name);
              setProgressPercent(0);
            }
            return;
          }

          const currentIndex = ranks.indexOf(currentRankObj);

          // Check if there's a next rank
          if (currentIndex < ranks.length - 1) {
            const nextRank = ranks[currentIndex + 1];
            setNextRankName(nextRank.name);

            // Calculate progress percentage using xpTotal from useUserGamification hook
            const currentMinXP = currentRankObj.min_xp_required || 0;
            const nextMinXP = nextRank.min_xp_required;
            const xpRange = nextMinXP - currentMinXP;
            const xpProgress = xpTotal - currentMinXP;
            const percent =
              xpRange > 0 ? Math.min((xpProgress / xpRange) * 100, 100) : 0;

            setProgressPercent(Math.round(percent));
          } else {
            // At max rank - show current rank and 100%
            setNextRankName(currentRankObj.name);
            setProgressPercent(100);
          }
        }
      } catch (error) {
        console.error("Failed to fetch ranks:", error);
      }
    };

    if (shouldShowGamification) {
      fetchRanks();
    }
  }, [rank, xpTotal, shouldShowGamification, isOpen]);

  // Fetching logic moved to parent layout

  // Create dynamic navigation based on user role
  const dynamicNavigation = React.useMemo(() => {
    if (isAdmin) return adminMainNavigation;
    if (isLister) return listerNavigation;
    if (isDataEntry) return dataEntryNavigation;
    if (isOrganizer) return organizerMainNavigation;
    if (isBusinessOwner) return businessOwnerNavigation;
    if (isWriter) return writerNavigation;
    return navigation;
  }, [isAdmin, isLister, isDataEntry, isOrganizer, isBusinessOwner, isWriter]);

  // Create admin section for admin users
  const adminSection = React.useMemo(() => {
    if (!isAdmin) return [];

    // Filter navigation items based on ACTIVE role
    const isSuperAdmin = activeRole === "super_admin";

    return adminNavigation.filter((item: SidebarNavItem) => {
      // If the nav item requires a specific role, filter accordingly
      if (item.requiredRole === "super_admin" && !isSuperAdmin) {
        return false;
      }
      // Allow admins and super_admins to see admin-only items (default)
      if (item.requiredRole === "admin" && !isAdmin) {
        return false;
      }
      return true;
    });
  }, [isAdmin, activeRole]);

  // Create dynamic secondary navigation based on user role
  const dynamicSecondaryNavigation = React.useMemo(() => {
    if (isAdmin) return adminSecondaryNavigation;
    if (isLister) return listerSecondaryNavigation;
    if (isDataEntry) return dataEntrySecondaryNavigation;
    if (isOrganizer) return organizerSecondaryNavigation;
    if (isBusinessOwner) return businessOwnerSecondaryNavigation;
    if (isWriter) return writerSecondaryNavigation;
    return secondaryNavigation; // Public users get achievements
  }, [isAdmin, isLister, isDataEntry, isOrganizer, isBusinessOwner, isWriter]);

  const handleSignOut = async () => {
    try {
      // Leaving the account also leaves the Parchi-app channel — anonymous
      // browsing on Inside should not keep Parchi branding/pricing.
      const { clearParchiChannel } = await import("@/lib/parchi/prefill");
      clearParchiChannel();
      // Race a short timeout so a slow/stuck request can never strand the user.
      await Promise.race([
        fetch("/api/auth/logout", { method: "POST" }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    } catch (err) {
      console.error("[SignOut] sidebar signOut error:", err);
    } finally {
      // Always redirect - a failed or slow signOut must never strand the user.
      window.location.href = "/";
    }
  };

  // Touch `user` to avoid unused-var linter warnings in some builds
  const _userId = user?.id;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed right-0 top-20 bottom-0 z-40 w-80 lg:w-80"
          data-user-id={_userId}
        >
          <div className="h-full bg-background/95 backdrop-blur-xl border-l border-border/50 shadow-premium-lg flex flex-col">
            {/* Top Close Header */}
            <div className="flex-shrink-0 px-6 pt-4 pb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Account & Menu
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="p-1.5 -mr-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Section - Fixed */}
            <div className="flex-shrink-0 p-6 pt-2 border-b border-border/50">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                {/* User Level & Progress */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                        isAdmin
                          ? "bg-gradient-to-br from-red-500 to-red-600"
                          : isLister
                            ? "bg-gradient-to-br from-primary to-primary/80"
                            : isDataEntry
                              ? "bg-gradient-to-br from-amber-500 to-amber-600"
                              : isOrganizer
                                ? "bg-gradient-to-br from-purple-500 to-purple-600"
                                : isBusinessOwner
                                  ? "bg-gradient-to-br from-blue-500 to-blue-600"
                                  : "bg-gradient-to-br from-primary to-primary/80",
                      )}
                    >
                      {isAdmin ? (
                        <Shield className="h-6 w-6 text-white" />
                      ) : isLister ? (
                        <MapPin className="h-6 w-6 text-white" />
                      ) : isDataEntry ? (
                        <Store className="h-6 w-6 text-white" />
                      ) : isOrganizer ? (
                        <Calendar className="h-6 w-6 text-white" />
                      ) : isBusinessOwner ? (
                        <Store className="h-6 w-6 text-white" />
                      ) : isWriter ? (
                        <PenSquare className="h-6 w-6 text-white" />
                      ) : (
                        <Sparkles className="h-6 w-6 text-primary-foreground" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">
                        {!user
                          ? "Guest Explorer"
                          : activeRole === "public_user"
                            ? currentRankDisplay || "Explorer"
                            : isAdmin
                              ? "Administrator"
                              : isLister
                                ? "Content Manager"
                                : isDataEntry
                                  ? "Data Entry"
                                  : isOrganizer
                                    ? "Event Organizer"
                                    : isBusinessOwner
                                      ? "Business Owner"
                                      : isWriter
                                        ? "Writer"
                                        : currentRankDisplay || "Unranked"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {!user
                          ? "Sign in to earn XP & track visits"
                          : activeRole === "public_user"
                            ? `${xpTotal || profile?.points || 0} XP`
                            : isAdmin
                              ? "Staff Account"
                              : isLister
                                ? "Lister Account"
                                : isDataEntry
                                  ? "Listing Capacity"
                                  : isOrganizer
                                    ? "Organizer Account"
                                    : isBusinessOwner
                                      ? "Business Account"
                                      : isWriter
                                        ? "Writer Account"
                                        : `${xpTotal || profile?.points || 0} XP`}
                      </p>
                    </div>
                  </div>
                  {shouldShowGamification && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Progress to {nextRankName}
                        </span>
                        <span className="text-primary font-semibold">
                          {progressPercent}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-xl">
                      <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                        Platform Administration Access
                      </p>
                    </div>
                  )}
                  {isLister && !isAdmin && (
                    <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                      <p className="text-xs text-primary font-medium">
                        Content Management Access
                      </p>
                    </div>
                  )}
                  {isOrganizer && !isAdmin && !isLister && (
                    <div className="p-3 bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/30">
                      <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                        Event Management Access
                      </p>
                    </div>
                  )}
                  {isBusinessOwner && !isAdmin && !isLister && !isOrganizer && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                      <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Business Management Access
                      </p>
                    </div>
                  )}
                  {isWriter &&
                    !isAdmin &&
                    !isLister &&
                    !isOrganizer &&
                    !isBusinessOwner && (
                      <div className="p-3 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                        <p className="text-xs text-primary font-medium">
                          Blog Writer Access
                        </p>
                      </div>
                    )}
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {internalLoadingStats ? (
                    // Loading skeleton
                    <>
                      <div className="text-center p-3 rounded-xl bg-accent/30 animate-pulse">
                        <div className="h-6 bg-muted rounded mb-1"></div>
                        <div className="h-3 bg-muted rounded w-16 mx-auto"></div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30 animate-pulse">
                        <div className="h-6 bg-muted rounded mb-1"></div>
                        <div className="h-3 bg-muted rounded w-16 mx-auto"></div>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30 animate-pulse">
                        <div className="h-6 bg-muted rounded mb-1"></div>
                        <div className="h-3 bg-muted rounded w-16 mx-auto"></div>
                      </div>
                    </>
                  ) : isAdmin ? (
                    // Admin stats - Real data
                    <>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.users || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Users</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.events || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Events</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.listings || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Listings
                        </p>
                      </div>
                    </>
                  ) : isLister ? (
                    // Lister stats - Real data
                    <>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.listings || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Listings
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.events || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Events</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.reviews || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Reviews</p>
                      </div>
                    </>
                  ) : isBusinessOwner ? (
                    // Business Owner stats - Real data
                    <>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.listings || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Listings
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.reviews || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Reviews</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.bookings || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bookings
                        </p>
                      </div>
                    </>
                  ) : (
                    // User stats - Real data
                    <>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.reviews || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Reviews</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.bookings || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bookings
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-accent/30">
                        <p className="text-lg font-bold text-foreground">
                          {internalStats.favorites || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Favorites
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Navigation - Scrollable */}
            <div className="flex-1 overflow-y-auto py-6 pb-28 md:pb-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent min-h-0">
              {/* Main Navigation */}
              <div className="px-6 mb-8">
                <div className="space-y-2">
                  {dynamicNavigation.map((item, index) => {
                    const isActive = pathname === item.href;
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + index * 0.05 }}
                      >
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "text-foreground hover:bg-accent/50 hover:scale-[1.02]",
                          )}
                        >
                          <motion.div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300",
                              isActive
                                ? "text-primary-foreground bg-white/20"
                                : "text-muted-foreground group-hover:text-foreground bg-accent/30 group-hover:bg-primary/20",
                            )}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                          >
                            <item.icon className="h-4 w-4" />
                          </motion.div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring" }}
                            >
                              <ChevronRight className="h-4 w-4 opacity-60" />
                            </motion.div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="px-6 mb-6">
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>

              {/* Admin Section - Only for Admin Users */}
              {isAdmin && adminSection.length > 0 && (
                <>
                  <div className="px-6 mb-8">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 px-4">
                        <Shield className="h-4 w-4 text-primary" />
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                          Admin Tools
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {adminSection.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                          <motion.div
                            key={item.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + index * 0.05 }}
                          >
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={cn(
                                "group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden",
                                isActive
                                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                  : "text-foreground hover:bg-primary/10 hover:scale-[1.02] hover:text-primary",
                              )}
                            >
                              <motion.div
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300",
                                  isActive
                                    ? "text-primary-foreground bg-white/20"
                                    : "text-muted-foreground group-hover:text-primary bg-primary/10 group-hover:bg-primary/20",
                                )}
                                whileHover={{ scale: 1.1, rotate: 5 }}
                              >
                                <item.icon className="h-4 w-4" />
                              </motion.div>
                              <span className="flex-1">{item.name}</span>
                              {isActive && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring" }}
                                >
                                  <ChevronRight className="h-4 w-4 opacity-60" />
                                </motion.div>
                              )}
                            </Link>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Admin Divider */}
                  <div className="px-6 mb-6">
                    <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                </>
              )}

              {/* Account Section */}
              <div className="px-6">
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4">
                    Account
                  </p>
                </div>
                <div className="space-y-2">
                  {dynamicSecondaryNavigation.map((item, index) => {
                    const isActive = pathname === item.href;
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "text-foreground hover:bg-accent/50 hover:scale-[1.02]",
                          )}
                        >
                          <motion.div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300",
                              isActive
                                ? "text-primary-foreground bg-white/20"
                                : "text-muted-foreground group-hover:text-foreground bg-accent/30 group-hover:bg-primary/20",
                            )}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                          >
                            <item.icon className="h-4 w-4" />
                          </motion.div>
                          <span className="flex-1">{item.name}</span>
                        </Link>
                      </motion.div>
                    );
                  })}

                  {/* Direct Sign Out / Sign In inside Account section */}
                  {user ? (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.3 + dynamicSecondaryNavigation.length * 0.05,
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:scale-[1.02] text-left cursor-pointer"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300 bg-red-500/10 text-red-600 dark:text-red-400 group-hover:bg-red-500/20">
                          <LogOut className="h-4 w-4" />
                        </div>
                        <span className="flex-1">Sign Out</span>
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.3 + dynamicSecondaryNavigation.length * 0.05,
                      }}
                    >
                      <Link
                        href={loginHref}
                        onClick={onClose}
                        className="group flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:opacity-95"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 text-primary-foreground">
                          <LogIn className="h-4 w-4" />
                        </div>
                        <span className="flex-1">Sign In</span>
                      </Link>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions - Compact & Unified */}
            <div className="flex-shrink-0 p-4 border-t border-border/50 space-y-2">
              {canSwitchRoles && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Button
                    onClick={async () => {
                      setIsSwitching(true);
                      try {
                        const isStaffMode = activeRole !== "public_user";
                        const targetRole = isStaffMode
                          ? "public_user"
                          : permanentRole;
                        await switchRole(
                          targetRole as import("@/types/auth.types").UserRole,
                        );
                        window.location.reload();
                      } catch (error) {
                        console.error("Role switch error:", error);
                      } finally {
                        setIsSwitching(false);
                      }
                    }}
                    disabled={isSwitching}
                    variant="outline"
                    className="w-full justify-start gap-3 rounded-xl px-3 h-10 text-sm font-medium border-primary/20 hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                      {activeRole === "public_user" ? (
                        <Shield className="h-3 w-3 text-primary" />
                      ) : (
                        <UserIcon className="h-3 w-3 text-primary" />
                      )}
                    </div>
                    <span>
                      {isSwitching
                        ? "Switching..."
                        : activeRole === "public_user"
                          ? "Switch to Staff"
                          : "Switch to Personal"}
                    </span>
                  </Button>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {user ? (
                  <Button
                    onClick={handleSignOut}
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl px-3 h-10 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-md">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <span>Sign Out</span>
                  </Button>
                ) : (
                  <Link href={loginHref} onClick={onClose} className="block w-full">
                    <Button
                      variant="default"
                      className="w-full justify-start gap-3 rounded-xl px-3 h-10 text-sm font-medium transition-all duration-300 shadow-md shadow-primary/25"
                    >
                      <div className="flex h-5 w-5 items-center justify-center rounded-md">
                        <LogIn className="h-4 w-4" />
                      </div>
                      <span>Sign In</span>
                    </Button>
                  </Link>
                )}
              </motion.div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
