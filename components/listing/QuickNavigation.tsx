"use client";

import { motion } from "framer-motion";
import { Database } from "@/types/database";
import { ChefHat, Clock, Star, Tag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Listing = Database["public"]["Views"]["listings_with_details"]["Row"];

interface QuickNavigationProps {
  listing: Listing;
  hasMenu?: boolean;
  hasDeals?: boolean;
  hasOpeningHours?: boolean;
  hasReviews?: boolean;
}

interface NavItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionId: string;
  available: boolean;
  label: string;
}

export function QuickNavigation({
  listing,
  hasMenu = false,
  hasDeals = false,
  hasOpeningHours = false,
  hasReviews = false,
}: QuickNavigationProps) {
  // Determine listing type for conditional rendering
  const listingType = listing.category_name?.toLowerCase() || "";
  const isRestaurant =
    listingType.includes("eat") ||
    listingType.includes("drink") ||
    listingType.includes("restaurant") ||
    listingType.includes("food");

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const navigationItems: NavItem[] = [
    {
      id: "menu",
      icon: ChefHat,
      sectionId: "menu-section",
      available: isRestaurant && hasMenu,
      label: "Menu",
    },
    {
      id: "deals",
      icon: Tag,
      sectionId: "deals-section",
      available: hasDeals,
      label: "Deals",
    },
    {
      id: "hours",
      icon: Clock,
      sectionId: "opening-hours-section",
      available: hasOpeningHours,
      label: "Hours",
    },
    {
      id: "reviews",
      icon: Star,
      sectionId: "reviews-section",
      available: hasReviews,
      label: "Reviews",
    },
  ];

  const availableItems = navigationItems.filter((item) => item.available);

  // Don't render if no sections are available
  if (availableItems.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-card/70 backdrop-blur-xl border border-border/60 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Quick Navigation
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground font-medium">
          {availableItems.length} sections
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {availableItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.sectionId)}
              className="flex items-center gap-2.5 p-2.5 rounded-xl bg-secondary/30 hover:bg-secondary/70 border border-border/40 hover:border-primary/30 text-left transition-all active:scale-95 group"
            >
              <div className="p-1.5 rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0">
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
