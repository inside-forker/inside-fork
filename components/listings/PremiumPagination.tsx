"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PremiumPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: PaginationProps) {
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  const goToFirst = () => onPageChange(1);
  const goToPrevious = () => onPageChange(Math.max(1, currentPage - 1));
  const goToNext = () => onPageChange(Math.min(totalPages, currentPage + 1));
  const goToLast = () => onPageChange(totalPages);

  // Generate page numbers to show
  const getVisiblePages = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5; // Show max 5 page numbers

    if (totalPages <= showPages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      // Add ellipsis after first page if needed
      if (start > 2) {
        pages.push("ellipsis");
      }

      // Add pages around current page
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis before last page if needed
      if (end < totalPages - 1) {
        pages.push("ellipsis");
      }

      // Always show last page (if not already included)
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border/20",
        className
      )}
    >
      {/* Items Info */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {startIndex}-{endIndex}
          </span>{" "}
          of <span className="font-medium text-foreground">{totalItems}</span>{" "}
          listings
        </span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1">
        {/* First & Previous */}
        <div className="flex items-center gap-1 mr-1 sm:mr-2">
          {/* Hide first button on mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToFirst}
            disabled={currentPage === 1}
            className="hidden sm:flex h-9 w-9 p-0 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevious}
            disabled={currentPage === 1}
            className="h-9 px-2 sm:px-3 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
        </div>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {getVisiblePages().map((page, index) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 sm:px-2 text-muted-foreground text-xs sm:text-sm"
                >
                  ...
                </span>
              );
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn(
                  "h-8 w-8 sm:h-9 sm:w-9 p-0 font-medium transition-all duration-200 text-xs sm:text-sm",
                  currentPage === page
                    ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 border-primary"
                    : "border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20"
                )}
              >
                {page}
              </Button>
            );
          })}
        </div>

        {/* Next & Last */}
        <div className="flex items-center gap-1 ml-1 sm:ml-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToNext}
            disabled={currentPage === totalPages}
            className="h-9 px-2 sm:px-3 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 sm:ml-1" />
          </Button>
          {/* Hide last button on mobile */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToLast}
            disabled={currentPage === totalPages}
            className="hidden sm:flex h-9 w-9 p-0 border-border/50 hover:bg-primary/5 dark:hover:bg-primary/10 hover:border-primary/20 disabled:opacity-50"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
