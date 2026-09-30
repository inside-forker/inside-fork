"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  X,
  Search,
  SlidersHorizontal,
  ChevronDown,
  CalendarIcon,
  Music,
  Utensils,
  Briefcase,
  Gamepad2,
  Palette,
  Users,
  Heart,
  Sparkles,
} from "lucide-react";
import FilterChip from "@/components/ui/FilterChip";
import FullScreenFilters from "@/components/shared/FullScreenFilters";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

interface PremiumEventFiltersProps {
  searchParams: {
    search?: string;
    date?: string;
    category?: string;
  };
  onFilterChange: (filters: Record<string, string | undefined>) => void;
  eventsCount: number;
}

const EVENT_CATEGORIES = [
  { key: "food", label: "Food & Dining", icon: Utensils },
  { key: "music", label: "Music & Arts", icon: Music },
  { key: "business", label: "Business", icon: Briefcase },
  { key: "tech", label: "Technology", icon: Gamepad2 },
  { key: "art", label: "Arts & Culture", icon: Palette },
  { key: "networking", label: "Networking", icon: Users },
  { key: "health", label: "Health & Wellness", icon: Heart },
  { key: "entertainment", label: "Entertainment", icon: Sparkles },
];

export function PremiumEventFilters({
  searchParams,
  onFilterChange,
  eventsCount,
}: PremiumEventFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(searchParams.search || "");
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFullScreen, setShowMobileFullScreen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const activeFilterCount = Object.values(searchParams).filter(Boolean).length;

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onFilterChange({
        ...searchParams,
        search: searchQuery || undefined,
      });
    },
    [searchQuery, searchParams, onFilterChange]
  );

  const handleDateChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...searchParams,
        date: value || undefined,
      });
    },
    [searchParams, onFilterChange]
  );

  const handleCategoryChange = useCallback(
    (category: string) => {
      const newCategory =
        searchParams.category === category ? undefined : category;
      onFilterChange({
        ...searchParams,
        category: newCategory,
      });
    },
    [searchParams, onFilterChange]
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    onFilterChange({});
    setShowFilters(false);
    setShowMobileFullScreen(false);
  }, [onFilterChange]);

  return (
    <>
      {/* Header with matching container width */}
      <div className="relative mb-6">
        <div className="w-full">
          {/* Section heading, app style */}
          <div className="mb-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              All events{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({eventsCount})
              </span>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {searchParams.search ? (
                <>
                  Results for{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{searchParams.search}&rdquo;
                  </span>
                </>
              ) : searchParams.category ? (
                <>
                  Events in{" "}
                  <span className="font-medium text-foreground capitalize">
                    {searchParams.category}
                  </span>
                </>
              ) : (
                "Everything coming up in Karachi"
              )}
            </p>
          </div>

          {/* Filter controls */}
          <div className="relative rounded-2xl bg-card border border-border shadow-sm overflow-hidden">

            <div className="relative p-6 space-y-5">
              {/* Mobile compact bar: visible on xs only, prevents vertical stacking */}
              <div className="sm:hidden">
                <div className="flex items-center gap-3">
                  <form onSubmit={handleSearch} className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search events..."
                        className="w-full h-10 pl-10 pr-10 text-sm rounded-xl bg-background border border-border focus:outline-none"
                      />
                    </div>
                  </form>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileFullScreen(true);
                    }}
                    aria-label="Open filters"
                    className="p-2 rounded-lg bg-muted/10"
                  >
                    <SlidersHorizontal className="h-5 w-5" />
                    {activeFilterCount > 0 && (
                      <span className="ml-1 text-xs font-semibold">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Desktop / tablet controls: keep original layout on sm+ */}
              <div className="hidden sm:flex flex-row items-center gap-3 max-w-2xl mx-auto lg:mx-0">
                <form
                  onSubmit={handleSearch}
                  className="flex-1 w-full sm:w-auto"
                >
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search events..."
                      className="w-full h-11 pl-10 pr-10 text-sm rounded-xl bg-background border border-border hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </form>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const dateInput = document.getElementById(
                        "event-date-picker"
                      ) as HTMLInputElement;
                      if (dateInput?.showPicker) dateInput.showPicker();
                      else dateInput?.focus();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer hover:text-foreground transition-colors"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </button>
                  <input
                    id="event-date-picker"
                    type="date"
                    value={searchParams.date || ""}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className={cn(
                      "h-11 pl-10 pr-3 text-sm rounded-xl bg-background border border-border hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 w-40 cursor-pointer",
                      "date-input-hide-icon",
                      searchParams.date && "bg-primary/5 border-primary/30"
                    )}
                    min={new Date().toISOString().split("T")[0]}
                    style={{
                      WebkitAppearance: "none",
                      MozAppearance: "textfield",
                    }}
                  />
                </div>

                <button
                  onClick={() =>
                    isMobile
                      ? setShowMobileFullScreen(true)
                      : setShowFilters(!showFilters)
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border",
                    showFilters || activeFilterCount > 0
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background hover:bg-muted/50 border-border hover:border-border/80"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background/20 text-xs font-bold">
                      {activeFilterCount}
                    </div>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform duration-200",
                      showFilters && "rotate-180"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden mb-6"
          >
            <div className="w-full">
              <div className="p-6 bg-card border border-border/50 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm sm:text-base font-semibold text-foreground">
                      Event Categories
                    </h3>
                  </div>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {EVENT_CATEGORIES.map((category) => (
                    <FilterChip
                      key={category.key}
                      active={searchParams.category === category.key}
                      onClick={() => handleCategoryChange(category.key)}
                      icon={category.icon}
                    >
                      {category.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Fullscreen Filters (DRY): use shared FullScreenFilters wrapper */}
      <AnimatePresence>
        <FullScreenFilters
          isOpen={Boolean(showMobileFullScreen && isMobile)}
          onClose={() => setShowMobileFullScreen(false)}
          title="Filter Events"
          subtitle="Refine events"
          focusSelector="#event-search-mobile"
          clearLabel="Clear All"
          applyLabel="Apply Filters"
          onClear={clearAllFilters}
          onApply={() => {
            onFilterChange({
              search: searchQuery || undefined,
              date: searchParams.date || undefined,
              category: searchParams.category || undefined,
            });
            setShowMobileFullScreen(false);
          }}
        >
          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.35 }}
          >
            <h3 className="text-base sm:text-lg font-semibold text-foreground/90 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Search
            </h3>
            <div className="relative mt-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                id="event-search-mobile"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full h-12 pl-10 pr-10 text-sm rounded-xl bg-card border-border/50 hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>
          </motion.div>

          {/* Date */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="text-base sm:text-lg font-semibold text-foreground/90 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Date
            </h3>
            <div className="relative mt-3">
              <button
                type="button"
                onClick={() => {
                  const dateInput = document.getElementById(
                    "event-date-picker-mobile"
                  ) as HTMLInputElement;
                  if (dateInput?.showPicker) dateInput.showPicker();
                  else dateInput?.focus();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 cursor-pointer"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
              <input
                id="event-date-picker-mobile"
                type="date"
                value={searchParams.date || ""}
                onChange={(e) => handleDateChange(e.target.value)}
                className={cn(
                  "h-11 pl-10 pr-3 text-sm rounded-xl bg-background border border-border hover:border-border/80 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 w-full cursor-pointer",
                  "date-input-hide-icon",
                  searchParams.date && "bg-primary/5 border-primary/30"
                )}
                min={new Date().toISOString().split("T")[0]}
                style={{ WebkitAppearance: "none", MozAppearance: "textfield" }}
              />
            </div>
          </motion.div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
          >
            <h3 className="text-lg font-semibold text-foreground/90 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Categories
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {EVENT_CATEGORIES.map((category, idx) => (
                <FilterChip
                  key={category.key}
                  active={searchParams.category === category.key}
                  onClick={() => {
                    const newCat =
                      searchParams.category === category.key
                        ? undefined
                        : category.key;
                    onFilterChange({ ...searchParams, category: newCat });
                  }}
                  icon={category.icon}
                  isLast={idx === EVENT_CATEGORIES.length - 1}
                >
                  {category.label}
                </FilterChip>
              ))}
            </div>
          </motion.div>
        </FullScreenFilters>
      </AnimatePresence>
    </>
  );
}
