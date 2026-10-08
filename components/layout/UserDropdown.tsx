"use client";

import React, { useState } from "react";
import {
  LogOut,
  Settings,
  UserCircle,
  ChevronDown,
  Home,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { useAvatar } from "@/hooks/useAvatar";
import Link from "next/link";
import { RoleSwitcher } from "./RoleSwitcher";

interface UserDropdownProps {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    full_name?: string | null;
    avatar_url?: string | null;
    role?: string;
    active_role?: string;
  } | null;
}

export function UserDropdown({ user, profile }: UserDropdownProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Use robust avatar loading with automatic signed URL refresh
  const { avatarUrl } = useAvatar(user.id, profile?.avatar_url);

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    if (isOpen) {
      // Remove any scroll-lock attributes that Radix might add
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver(() => {
        if (body.hasAttribute("data-scroll-locked")) {
          removeScrollLock();
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
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoading(true);
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
      console.error("[SignOut] dropdown signOut error:", err);
    } finally {
      // Always navigate home with a hard redirect.
      window.location.href = "/";
    }
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const displayName = profile?.full_name || user.email?.split("@")[0] || "User";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {/* Mobile Avatar Button - Clean */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative group flex items-center justify-center w-12 h-12 md:w-auto md:h-10 md:px-3 rounded-2xl md:rounded-full transition-all duration-300 md:bg-transparent md:border-0 md:shadow-none md:hover:bg-gradient-to-r md:hover:from-primary/10 md:hover:to-primary/5 md:dark:hover:from-primary/20 md:dark:hover:to-primary/10"
        >
          {/* Glassmorphism container - mobile only */}
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 md:hidden" />

          {/* Subtle gradient overlay - mobile only */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-2xl md:hidden" />

          <div className="relative z-10 flex items-center space-x-2">
            {/* Clean Avatar - No unnecessary status indicators */}
            <Avatar
              key={avatarUrl}
              className="h-8 w-8 ring-2 ring-primary/30 md:ring-1 md:ring-border/40 shadow-lg transition-all duration-300 group-hover:ring-primary/50 group-hover:shadow-xl"
            >
              <AvatarImage
                src={avatarUrl || undefined}
                alt={displayName}
                onError={(e) => {
                  console.error(
                    "UserDropdown Avatar (mobile): Image failed to load",
                    {
                      avatarUrl: avatarUrl ? "present" : "null",
                      urlLength: avatarUrl?.length || 0,
                      hasToken: avatarUrl?.includes("token=") || false,
                    },
                  );
                  e.currentTarget.style.display = "none";
                }}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                {getInitials(user.email || "U")}
              </AvatarFallback>
            </Avatar>

            <div className="hidden md:flex flex-col items-start">
              <span className="text-sm font-medium leading-none">
                {displayName}
              </span>
              <span className="text-xs text-muted-foreground leading-none mt-1">
                {user.email}
              </span>
            </div>
            <ChevronDown className="hidden md:block h-4 w-4 text-muted-foreground" />
          </div>
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-64 bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 rounded-2xl"
        align="end"
        sideOffset={12}
        alignOffset={-4}
      >
        {/* Gradient overlay that works in both modes */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/2 rounded-2xl pointer-events-none" />

        <div className="relative z-10 p-4">
          {/* Clean User Header - No unnecessary status indicators */}
          {/* Hidden on desktop since navbar trigger already shows this info */}
          <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-border/50 md:hidden">
            <Avatar
              key={avatarUrl}
              className="h-10 w-10 ring-2 ring-primary/30 shadow-lg"
            >
              <AvatarImage
                src={avatarUrl || undefined}
                alt={displayName}
                onError={(e) => {
                  console.error(
                    "UserDropdown Avatar (dropdown): Image failed to load",
                    {
                      avatarUrl: avatarUrl ? "present" : "null",
                      urlLength: avatarUrl?.length || 0,
                      hasToken: avatarUrl?.includes("token=") || false,
                    },
                  );
                  // Hide broken image and show fallback
                  e.currentTarget.style.display = "none";
                }}
              />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                {getInitials(user.email || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Menu Items with proper dark mode support */}
          <div className="space-y-1">
            {/* Smart Navigation Link - Context-Aware
                Show "Home" when inside the dashboard (any /dashboard path).
                Otherwise show "Dashboard" so it's available from any public page. */}
            {pathname?.startsWith("/dashboard") ? (
              <Link href="/">
                <motion.div
                  whileHover={{ x: 2 }}
                  className="group flex items-center space-x-3 p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 cursor-pointer"
                >
                  <Home className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Home
                  </span>
                </motion.div>
              </Link>
            ) : (
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ x: 2 }}
                  className="group flex items-center space-x-3 p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 cursor-pointer"
                >
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Dashboard
                  </span>
                </motion.div>
              </Link>
            )}

            <Link href="/dashboard/profile">
              <motion.div
                whileHover={{ x: 2 }}
                className="group flex items-center space-x-3 p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 cursor-pointer"
              >
                <UserCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Profile
                </span>
              </motion.div>
            </Link>

            <Link href="/dashboard/settings">
              <motion.div
                whileHover={{ x: 2 }}
                className="group flex items-center space-x-3 p-3 rounded-xl hover:bg-primary/10 transition-all duration-200 cursor-pointer"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  Settings
                </span>
              </motion.div>
            </Link>

            {/* Role Switcher for Staff */}
            <RoleSwitcher />

            <motion.button
              type="button"
              whileHover={{ x: 2 }}
              onClick={handleLogout}
              disabled={isLoading}
              className="appearance-none bg-transparent border-0 w-full text-left group flex items-center space-x-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-200 cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogOut className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {isLoading ? "Signing out..." : "Sign out"}
              </span>
            </motion.button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
