"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSearch } from "@/hooks/useSearch";
import { motion } from "framer-motion";

import { Search, Sparkles } from "lucide-react";
import { ThemeAwareLogo } from "@/components/layout/ThemeAwareLogo";
import { NotificationBell } from "@/components/layout/notifications/NotificationBell";
import { SecurityAlertsBadge } from "@/components/admin/SecurityAlertsBadge";
import { useRouter } from "next/navigation";
import { PremiumDiscoveryPanel } from "@/components/layout/PremiumDiscoveryPanel";

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  active_role?: string;
  created_at?: string;
  updated_at?: string;
}

interface HeaderUser {
  id: string;
  email?: string;
}

interface PremiumHeaderProps {
  user?: HeaderUser | null;
  profile?: Profile | null;
  context?: "public" | "dashboard";
  showDiscoveryPanel?: boolean;
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export function PremiumHeader({
  user,
  profile,
  context = "dashboard",
  showDiscoveryPanel = false,
  onMenuClick,
  sidebarOpen = false,
}: PremiumHeaderProps) {
  const [isDiscoveryOpen, setIsDiscoveryOpen] = React.useState(false);
  const router = useRouter();

  const handleAvatarClick = () => {
    if (onMenuClick) {
      onMenuClick();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("insidekhi:toggle-sidebar"));
    }
  };

  // Real-time search integration
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    showResults,
    setShowResults,
    getResultUrl,
  } = useSearch();

  // Glow animation state for search field discoverability
  const [isGlowing, setIsGlowing] = useState(false);

  // Repeating glow animation every 8 seconds - deferred to avoid blocking
  useEffect(() => {
    const glowInterval = setInterval(() => {
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 2500);
    }, 8000);

    return () => clearInterval(glowInterval);
  }, []);

  const handleSearchNavigate = (result: Parameters<typeof getResultUrl>[0]) => {
    setSearchQuery(result.name);
    setShowResults(false);
    setIsDiscoveryOpen(false);
    try {
      router.push(getResultUrl(result));
    } catch {
      window.location.href = getResultUrl(result);
    }
  };

  // Allow other components to request the header discovery panel close
  React.useEffect(() => {
    const handler = () => {
      setIsDiscoveryOpen(false);
      setShowResults(false);
    };
    window.addEventListener(
      "insidekhi:closeDiscovery",
      handler as EventListener,
    );
    return () =>
      window.removeEventListener(
        "insidekhi:closeDiscovery",
        handler as EventListener,
      );
  }, [setShowResults]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-20 animate-hero-fade-in">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/50" />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 lg:px-8">
        {/* Mobile Layout */}
        <div className="md:hidden flex items-center justify-between h-full">
          {/* Mobile Left: Logo */}
          <div className="flex items-center">
            <ThemeAwareLogo />
          </div>

          {/* Mobile Right: User Actions */}
          <div className="flex items-center space-x-2">
            {/* Security Alerts for Super Admin */}
            {user &&
              (profile?.active_role || profile?.role) === "super_admin" && (
                <SecurityAlertsBadge />
              )}
            {/* Notification Bell for all logged-in users */}
            {user && <NotificationBell variant="mobile" />}
            {/* Unauthenticated User - Mobile Login/Join */}
            {!user && (
              <div className="flex items-center space-x-2">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-sm font-medium hover:bg-accent/50 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <a href="/login">
                    <span className="sm:hidden">Login</span>
                    <span className="hidden sm:inline">Sign In</span>
                  </a>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="text-sm font-medium bg-primary hover:bg-primary/90 transition-all duration-200 px-3 sm:px-4 hover:scale-105 active:scale-95"
                >
                  <a href="/signup">
                    <span className="sm:hidden">Join</span>
                    <span className="hidden sm:inline">Get Started</span>
                  </a>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:grid grid-cols-3 items-center h-full">
          {/* Desktop Left: Logo */}
          <div className="flex items-center justify-start">
            <div className="flex items-center">
              <ThemeAwareLogo />
            </div>
          </div>

          {/* Desktop Center: Search */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-lg group">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
                <Search className="h-5 w-5 text-foreground/70 group-focus-within:text-primary transition-colors duration-200" />
              </div>
              <input
                id="main-header-search"
                name="main-header-search"
                type="text"
                autoComplete="off"
                placeholder={
                  context === "dashboard"
                    ? "Search places, events, or experiences..."
                    : "Find restaurants, places, events in Karachi..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                  }
                }}
                onFocus={() => {
                  if (showDiscoveryPanel) {
                    setIsDiscoveryOpen(true);
                  }
                  if (searchQuery.length >= 2) {
                    setShowResults(true);
                  }
                }}
                onBlur={(e) => {
                  const relatedTarget = e.relatedTarget as HTMLElement | null;

                  // Delay to allow clicks inside the discovery panel to register
                  setTimeout(() => {
                    const discoveryFlag = (
                      window as unknown as Record<string, unknown>
                    ).__pkDiscoveryMouseDown as boolean | undefined;
                    const active = document.activeElement;
                    const panel = document.getElementById(
                      "premium-discovery-panel",
                    );

                    const panelContainsActive = panel && panel.contains(active);
                    const panelContainsRelated =
                      panel && relatedTarget && panel.contains(relatedTarget);

                    // Prevent closing if interaction is within the panel
                    if (
                      discoveryFlag ||
                      panelContainsActive ||
                      panelContainsRelated
                    ) {
                      return;
                    }

                    setIsDiscoveryOpen(false);
                    setShowResults(false);
                  }, 200);
                }}
                className={cn(
                  "w-full h-12 pl-12 pr-4 rounded-2xl border border-border/60 relative z-0 cursor-pointer",
                  "bg-background/80 backdrop-blur-sm shadow-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                  "placeholder:text-muted-foreground/70 text-sm font-medium",
                  "transition-all duration-300 hover:border-border/80 hover:shadow-md",
                  "dark:bg-background/90 dark:border-border/40",
                  isGlowing &&
                    "ring-2 ring-primary/20 shadow-lg shadow-primary/10",
                )}
              />
            </div>
          </div>

          {/* Discovery Panel - Positioned relative to full header */}
          <PremiumDiscoveryPanel
            isOpen={showDiscoveryPanel && (isDiscoveryOpen || showResults)}
            onClose={() => {
              setIsDiscoveryOpen(false);
              setShowResults(false);
            }}
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            showSearchResults={showResults}
            onSearchSelect={handleSearchNavigate}
          />

          {/* Desktop Right: Actions */}
          <div className="flex items-center justify-end">
            <div className="flex items-center space-x-2">
              {/* Security Alerts for Super Admin */}
              {user &&
                (profile?.active_role || profile?.role) === "super_admin" && (
                  <SecurityAlertsBadge />
                )}

              {/* Notifications: always show for logged-in users */}
              {user && <NotificationBell variant="desktop" />}

              {/* Separator for visual grouping */}
              <div className="w-px h-8 bg-border mx-4 opacity-60" />

              {/* User Authentication Section - Desktop */}
              {user ? (
                /* Authenticated User - Desktop */
                <div className="relative">
                  {/* Clickable Profile Card for Sidebar */}
                  <div
                    onClick={handleAvatarClick}
                    className={cn(
                      "hidden md:flex items-center space-x-3 cursor-pointer p-2 pr-4 rounded-2xl transition-all duration-300",
                      "bg-background/95 backdrop-blur-xl border border-border/50 hover:border-border/80",
                      "shadow-md hover:shadow-lg backdrop-blur-sm hover:scale-[1.02]",
                      "dark:bg-card/90 dark:border-border/70 dark:hover:border-border/90",
                      "dark:shadow-lg dark:shadow-black/20",
                      sidebarOpen &&
                        "bg-primary/10 border-primary/30 ring-2 ring-primary/20",
                    )}
                  >
                    <Avatar
                      className={cn(
                        "h-10 w-10 ring-1 shadow-sm transition-all duration-300",
                        sidebarOpen
                          ? "ring-primary/60 ring-2 shadow-primary/25"
                          : "ring-border/40",
                      )}
                    >
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {profile?.full_name?.charAt(0) ||
                          user?.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block text-left">
                      <p className="text-sm font-semibold text-foreground">
                        {profile?.full_name ||
                          user?.email?.split("@")[0] ||
                          "User"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center">
                        <Sparkles className="h-3 w-3 mr-1 text-primary" />
                        {(() => {
                          const activeRole =
                            profile?.active_role || profile?.role;

                          if (activeRole === "super_admin") {
                            return "Super Admin";
                          }
                          if (activeRole === "admin") {
                            return "Admin";
                          }
                          if (activeRole === "lister") {
                            return "Lister";
                          }
                          if (activeRole === "data_entry") {
                            return "Data Entry";
                          }
                          if (activeRole === "organizer") {
                            return "Organizer";
                          }
                          if (activeRole === "business_owner") {
                            return "Business Owner";
                          }
                          if (activeRole === "writer") {
                            return "Writer";
                          }
                          return `${profile?.points || 0} XP`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Non-authenticated User - Desktop */
                <div className="flex items-center space-x-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-sm font-medium hover:bg-accent/50 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <a href="/login">Sign In</a>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    className="text-sm font-medium bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <a href="/signup">Get Started</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
