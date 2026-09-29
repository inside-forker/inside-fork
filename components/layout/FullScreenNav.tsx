"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Home,
  Search,
  Ticket,
  User,
  Compass,
  Newspaper,
  LayoutGrid,
  MapPin,
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { CategoryPanel } from "./CategoryPanel";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PremiumDiscoveryPanel } from "./PremiumDiscoveryPanel";
import { RoleSwitcher } from "./RoleSwitcher";

type NavItem = {
  id: number;
  name: string;
  slug: string;
};

type MainLinkItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  isAction?: boolean;
};

const quickActionLinks: MainLinkItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "#discover", label: "Discover", icon: MapPin, isAction: true },
  { href: "/search", label: "Search", icon: Search },
  { href: "/listings?deals=true", label: "Deals", icon: Ticket },
];

type ParentCategory = {
  id: number;
  name: string;
  slug: string;
  categories?: { id: number; name: string; slug: string }[];
};

interface FullScreenNavProps {
  categoryNavItems: ParentCategory[];
  simpleNavLinks: NavItem[];
  onClose: () => void;
  user?: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
}

export function FullScreenNav({
  categoryNavItems,
  simpleNavLinks,
  onClose,
  user,
}: FullScreenNavProps) {
  const [view, setView] = React.useState("main");
  const [isDiscoveryOpen, setIsDiscoveryOpen] = React.useState(false);
  type CombinedLinkItem = {
    id: string | number;
    href: string;
    label: string;
    icon: React.ElementType;
    isAction?: boolean;
  };

  // Combine all links for easy access
  const quickActions: CombinedLinkItem[] = quickActionLinks.map((l) => ({
    ...l,
    id: l.label,
  }));

  const exploreCategories: CombinedLinkItem[] = simpleNavLinks.map((l) => ({
    // Exclude 'events' or divert to /events page
    id: l.id,
    href:
      l.slug === "events"
        ? "/events"
        : l.slug === "guides-reviews"
          ? "/blog"
          : `/listings/${l.slug}`,
    label: l.name,
    icon: l.slug === "guides-reviews" ? Newspaper : Compass,
    isAction: false,
  }));

  // Auth-aware account actions
  const accountActions: CombinedLinkItem[] = [
    user
      ? {
          href: "/dashboard/profile",
          label: "Profile",
          icon: User,
          id: "profile",
        }
      : {
          href: "/login",
          label: "Sign In",
          icon: User,
          id: "login",
        },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-xl"
    >
      {/* Header with Glassmorphism */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Explore Karachi
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your gateway to the city
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-primary/10"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {view === "main" && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col flex-grow overflow-y-auto p-6 space-y-8"
            >
              {/* Quick Actions Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground/90">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {quickActions.map((item, index) => {
                    const isDiscover =
                      item.isAction && item.label === "Discover";

                    const cardContent = (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`
                        relative group overflow-hidden rounded-2xl p-6 h-24
                        ${
                          isDiscover
                            ? "bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20"
                            : "bg-card/50 border border-border/50 hover:border-border"
                        }
                        backdrop-blur-sm transition-all duration-300
                        hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1
                        active:scale-95
                      `}
                      >
                        <div className="flex items-center gap-3 sm:gap-4 h-full">
                          <div
                            className={`
                          p-3 rounded-xl transition-colors duration-200
                          ${
                            isDiscover
                              ? "bg-primary/20 text-primary group-hover:bg-primary/30"
                              : "bg-primary/10 text-primary group-hover:bg-primary/20"
                          }
                        `}
                          >
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="block truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                              {item.label}
                            </span>
                            {isDiscover && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                Explore the city
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Subtle gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </motion.div>
                    );

                    if (isDiscover) {
                      return (
                        <button
                          key={item.id}
                          onClick={() => setIsDiscoveryOpen(true)}
                          className="w-full text-left"
                        >
                          {cardContent}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={onClose}
                        className="block"
                      >
                        {cardContent}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Explore Categories Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground/90">
                  Explore Categories
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {exploreCategories.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onClose}
                      className="block"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: (index + quickActions.length) * 0.1,
                        }}
                        className="group flex items-center gap-4 p-4 rounded-xl bg-card/30 border border-border/30 hover:border-border hover:bg-card/50 transition-all duration-200"
                      >
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </span>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Account Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground/90">
                  Account
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {accountActions.map((item, index) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={onClose}
                      className="block"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay:
                            (index +
                              quickActions.length +
                              exploreCategories.length) *
                            0.1,
                        }}
                        className="group flex items-center gap-4 p-4 rounded-xl bg-card/30 border border-border/30 hover:border-border hover:bg-card/50 transition-all duration-200"
                      >
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                          <item.icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </span>
                      </motion.div>
                    </Link>
                  ))}
                  {user && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.3,
                        delay:
                          (accountActions.length +
                            quickActions.length +
                            exploreCategories.length) *
                          0.1,
                      }}
                      className="rounded-xl bg-card/30 border border-border/30 p-1"
                    >
                      <RoleSwitcher onSwitched={onClose} />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* More Options Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground/90">
                  More
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {/* All Categories Button */}
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      delay:
                        (quickActions.length +
                          exploreCategories.length +
                          accountActions.length) *
                        0.1,
                    }}
                    onClick={() => setView("categories")}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 hover:from-primary/20 hover:to-primary/10 transition-all duration-200"
                  >
                    <div className="p-2 rounded-lg bg-primary/20 text-primary group-hover:bg-primary/30 transition-colors">
                      <LayoutGrid className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        All Categories
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        Browse everything
                      </p>
                    </div>
                  </motion.button>
                </div>
              </div>

            </motion.div>
          )}

          {view === "categories" && (
            <CategoryPanel
              categories={categoryNavItems}
              onBack={() => setView("main")}
              onLinkClick={onClose}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Discovery Panel Overlay */}
      {isDiscoveryOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute inset-0 z-10 bg-background/95 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Discover Karachi
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Find the best places, guides, and experiences
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDiscoveryOpen(false)}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close discovery</span>
              </Button>
            </div>
          </div>

          {/* Discovery Content */}
          <div className="flex-1 overflow-hidden">
            <PremiumDiscoveryPanel
              isOpen={true}
              // Close discovery and the full-screen nav when discovery requests close
              onClose={() => {
                setIsDiscoveryOpen(false);
                try {
                  onClose();
                } catch {}
              }}
              mobileMode={true}
              className="relative top-0 left-0 right-0 mt-0 w-full max-w-none h-full max-h-none rounded-none border-0 shadow-none p-4 bg-transparent backdrop-blur-none"
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
