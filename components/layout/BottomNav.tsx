"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Ticket,
  LogIn,
  BarChart3,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileShape {
  id?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
}

interface BottomNavProps {
  onMenuOpen: () => void;
  user?: SupabaseUser | { id: string; email?: string } | null;
  profile?: ProfileShape | null;
}

export function BottomNav({ onMenuOpen, user, profile }: BottomNavProps) {
  const pathname = usePathname();

  // Smart navigation based on user state and current page
  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/events", label: "Events", icon: Calendar },
    // Always show Dashboard for logged-in users on public pages
    user
      ? { href: "/dashboard", label: "Dashboard", icon: BarChart3 }
      : { href: "/login", label: "Sign In", icon: LogIn },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25,
          delay: 0.25,
        }}
        className="md:hidden fixed bottom-4 left-4 right-4 z-50 h-16"
      >
        {/* Glassmorphism container with notch design */}
        <div className="relative flex items-center h-full bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-2xl" />

          {/* Left side nav items */}
          <div className="flex-1 grid grid-cols-2 h-full">
            {navLinks.slice(0, 2).map((link, index) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="relative z-10 flex h-full flex-col items-center justify-center gap-1 text-xs group"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200"
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-primary/20 shadow-lg shadow-primary/25"
                          : "group-hover:bg-primary/10",
                      )}
                    >
                      <link.icon
                        className={cn(
                          "h-4 w-4 transition-all duration-200",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-medium transition-all duration-200 text-xs",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </span>
                  </motion.div>
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-t from-primary/10 via-primary/5 to-transparent border border-primary/20"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Center Deals Button */}
          {(() => {
            const isDealsActive =
              pathname === "/listings" || pathname?.startsWith("/listings");
            return (
              <div className="relative z-10 flex items-center justify-center w-16">
                <Link
                  href="/listings?deals=true"
                  className="flex flex-col items-center justify-center gap-1 text-xs group"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200"
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        isDealsActive
                          ? "bg-primary/20 shadow-lg shadow-primary/25"
                          : "group-hover:bg-primary/10",
                      )}
                    >
                      <Ticket
                        className={cn(
                          "h-4 w-4 transition-all duration-200",
                          isDealsActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary",
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-medium transition-all duration-200 text-xs",
                        isDealsActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      Deals
                    </span>
                  </motion.div>
                </Link>
              </div>
            );
          })()}

          {/* Right side nav items */}
          <div className="flex-1 grid grid-cols-2 h-full">
            {/* Dashboard/Sign In */}
            {(() => {
              const isDashboardActive =
                pathname === navLinks[2].href ||
                (navLinks[2].href !== "/" &&
                  pathname?.startsWith(navLinks[2].href));
              return (
                <Link
                  href={navLinks[2].href}
                  className="relative z-10 flex h-full flex-col items-center justify-center gap-1 text-xs group"
                >
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200"
                  >
                    <div
                      className={cn(
                        "p-1.5 rounded-lg transition-all duration-200",
                        isDashboardActive
                          ? "bg-primary/20 shadow-lg shadow-primary/25"
                          : "group-hover:bg-primary/10",
                      )}
                    >
                      {React.createElement(navLinks[2].icon, {
                        className: cn(
                          "h-4 w-4 transition-all duration-200",
                          isDashboardActive
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-primary",
                        ),
                      })}
                    </div>
                    <span
                      className={cn(
                        "font-medium transition-all duration-200 text-xs",
                        isDashboardActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {navLinks[2].label}
                    </span>
                  </motion.div>
                  {isDashboardActive && (
                    <motion.div
                      layoutId="bottom-nav-active-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-t from-primary/10 via-primary/5 to-transparent border border-primary/20"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                    />
                  )}
                </Link>
              );
            })()}

            {/* Profile Button */}
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 text-xs group">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                onClick={onMenuOpen}
                className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-all duration-200 group-hover:bg-primary/10"
              >
                <div className="p-0.5 rounded-full ring-2 ring-primary/30 group-hover:ring-primary transition-all duration-200 shadow-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold text-[10px]">
                      {profile?.full_name?.charAt(0) ||
                        user?.email?.charAt(0).toUpperCase() || (
                          <User className="h-3 w-3 text-primary" />
                        )}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className="font-medium text-primary group-hover:text-primary/80 transition-colors duration-200 text-xs">
                  Profile
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>
    </>
  );
}
