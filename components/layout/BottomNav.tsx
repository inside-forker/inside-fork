"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Ticket,
  LayoutGrid,
  LogIn,
  BarChart3,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { QRScanner } from "@/components/gamification/QRScanner";
import { useRouter } from "next/navigation";

interface ProfileShape {
  role?: string;
}

interface BottomNavProps {
  onMenuOpen: () => void;
  user?: SupabaseUser | null;
  profile?: ProfileShape | null;
}

export function BottomNav({ onMenuOpen, user, profile }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showScanner, setShowScanner] = React.useState(false);

  // Check if user is an organizer - they should use ticket verification scanner
  const isOrganizer =
    profile?.role === "organizer" ||
    profile?.role === "super_admin" ||
    profile?.role === "admin";

  // Handle scan button click - organizers go to ticket verification
  const handleScanClick = () => {
    if (isOrganizer) {
      router.push("/dashboard/scan");
    } else {
      setShowScanner(true);
    }
  };

  // Smart navigation based on user state and current page
  const navLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/events", label: "Events", icon: Calendar },
    // Always show Dashboard for logged-in users on public pages
    user
      ? { href: "/dashboard", label: "Dashboard", icon: BarChart3 }
      : { href: "/login", label: "Sign In", icon: LogIn },
  ];

  // Handle QR scan success
  const handleScanSuccess = () => {
    setShowScanner(false);
  };

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

          {/* Center QR Scanner Button - Only for logged-in users */}
          {user ? (
            <div className="relative z-20 flex items-center justify-center -mt-6">
              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 20,
                  delay: 0.2,
                }}
                onClick={handleScanClick}
                className="group relative w-14 h-14 rounded-full bg-primary shadow-xl shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50 transition-all duration-300"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-primary blur-md opacity-40 group-hover:opacity-60 transition-opacity" />

                {/* Outer ring */}
                <div className="absolute -inset-1 rounded-full border-2 border-primary/30 group-hover:border-primary/50 transition-colors" />

                {/* Inner gradient */}
                <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-primary via-primary to-primary/80" />

                {/* Icon */}
                <div className="relative z-10 flex items-center justify-center w-full h-full">
                  <ScanLine className="h-6 w-6 text-primary-foreground" />
                </div>

                {/* Pulse animation */}
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 rounded-full border-2 border-primary"
                />
              </motion.button>

              {/* Label below - Different for organizers */}
              <span className="absolute -bottom-4 text-[10px] font-semibold text-primary tracking-wide">
                {isOrganizer ? "VERIFY" : "SCAN"}
              </span>
            </div>
          ) : (
            /* Deals button for non-logged in users */
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
                      pathname === "/listings"
                        ? "bg-primary/20 shadow-lg shadow-primary/25"
                        : "group-hover:bg-primary/10",
                    )}
                  >
                    <Ticket
                      className={cn(
                        "h-4 w-4 transition-all duration-200",
                        pathname === "/listings"
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-primary",
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-medium transition-all duration-200 text-xs",
                      pathname === "/listings"
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    Deals
                  </span>
                </motion.div>
              </Link>
            </div>
          )}

          {/* Right side nav items */}
          <div className="flex-1 grid grid-cols-2 h-full">
            {/* Dashboard/Sign In */}
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
                    pathname === navLinks[2].href
                      ? "bg-primary/20 shadow-lg shadow-primary/25"
                      : "group-hover:bg-primary/10",
                  )}
                >
                  {React.createElement(navLinks[2].icon, {
                    className: cn(
                      "h-4 w-4 transition-all duration-200",
                      pathname === navLinks[2].href
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary",
                    ),
                  })}
                </div>
                <span
                  className={cn(
                    "font-medium transition-all duration-200 text-xs",
                    pathname === navLinks[2].href
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {navLinks[2].label}
                </span>
              </motion.div>
              {pathname === navLinks[2].href && (
                <motion.div
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-t from-primary/10 via-primary/5 to-transparent border border-primary/20"
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                />
              )}
            </Link>

            {/* Menu Button */}
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
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg shadow-primary/25 group-hover:from-primary/30 group-hover:to-primary/20 transition-all duration-200">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-primary group-hover:text-primary/80 transition-colors duration-200 text-xs">
                  Menu
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <QRScanner
            onClose={() => setShowScanner(false)}
            onScanSuccess={handleScanSuccess}
          />
        )}
      </AnimatePresence>
    </>
  );
}
