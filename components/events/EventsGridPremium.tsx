"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { EventCard as PremiumEventCard } from "@/components/events/EventCard";
import { Button } from "@/components/ui/button";
import { PremiumPagination } from "@/components/listings/PremiumPagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Grid3X3, ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Event } from "@/types/events.types";

interface EventsGridProps {
  events: Event[];
  searchParams?: {
    search?: string;
    location?: string;
    date?: string;
    category?: string;
  };
}

const ITEMS_PER_PAGE_OPTIONS = [9, 12, 18, 24];
const CARDS_PER_ROW_OPTIONS = [
  { value: 2, label: "2 per row", grid: "grid-cols-1 md:grid-cols-2" },
  {
    value: 3,
    label: "3 per row",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  },
  {
    value: 4,
    label: "4 per row",
    grid: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  },
];

// Export function for grid controls
export function EventsGridControls({
  cardsPerRow,
  setCardsPerRow,
  itemsPerPage,
  setItemsPerPage,
}: {
  cardsPerRow: number;
  setCardsPerRow: (value: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (value: number) => void;
}) {
  const selectedRowOption = CARDS_PER_ROW_OPTIONS.find(
    (option) => option.value === cardsPerRow
  );

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex items-center gap-2 min-w-[140px] justify-between"
          >
            <Grid3X3 className="h-4 w-4" />
            {selectedRowOption?.label}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[160px]">
          {CARDS_PER_ROW_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setCardsPerRow(option.value)}
              className={cn(
                "cursor-pointer",
                cardsPerRow === option.value && "bg-accent"
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 min-w-[100px] justify-between"
          >
            {itemsPerPage}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ITEMS_PER_PAGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => handleItemsPerPageChange(option)}
              className={cn(
                "cursor-pointer",
                itemsPerPage === option && "bg-accent"
              )}
            >
              {option} per page
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function EventsGrid({ events, searchParams }: EventsGridProps) {
  const [cardsPerRow] = useState(3);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);
  const gridContainerRef = React.useRef<HTMLDivElement>(null);

  // Calculate pagination
  const totalItems = events.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEvents = useMemo(
    () => events.slice(startIndex, endIndex),
    [events, startIndex, endIndex]
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (gridContainerRef.current) {
      const headerOffset = 90;
      const elementPosition =
        gridContainerRef.current.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: "smooth",
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Reset to first page when events change (filters, etc.)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [events.length]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const selectedRowOption = CARDS_PER_ROW_OPTIONS.find(
    (option) => option.value === cardsPerRow
  );

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-24 h-24 mx-auto mb-6 bg-muted/30 rounded-full flex items-center justify-center">
          <Calendar className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg sm:text-xl font-semibold mb-2">
          No Events Found
        </h3>
        <p className="text-muted-foreground mb-6">
          {searchParams?.search ||
          searchParams?.location ||
          searchParams?.date ||
          searchParams?.category
            ? "Try adjusting your search criteria"
            : "Check back soon for upcoming events in Karachi"}
        </p>
      </div>
    );
  }

  return (
    <div ref={gridContainerRef} className="space-y-6">
      {/* Events Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          "grid gap-6",
          selectedRowOption?.grid || "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {currentEvents.map((event) => (
          <PremiumEventCard key={event.id} event={event} showAnimation={true} />
        ))}
      </motion.div>

      {/* Pagination */}
      <PremiumPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
