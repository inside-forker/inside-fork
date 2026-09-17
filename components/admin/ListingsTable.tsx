"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Building,
  MapPin,
  Phone,
  Globe,
} from "lucide-react";
import { Database } from "@/types/database";
import type { ListingEditorInfo } from "@/lib/hooks/useListingEditors";

type Listing = Database["public"]["Tables"]["listings"]["Row"] & {
  category_name?: string | null;
};

interface ListingsTableProps {
  listings: Listing[];
  isLoading: boolean;
  onEditListing: (listing: Listing) => void;
  onDeleteListing: (listing: Listing) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedListings?: Set<number>;
  onSelectListing?: (listingId: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  isBulkMode?: boolean;
  userRole?: string;
  editorsMap?: Map<number, ListingEditorInfo[]>;
}

export function ListingsTable({
  listings,
  isLoading,
  onEditListing,
  onDeleteListing,
  currentPage,
  totalPages,
  onPageChange,
  selectedListings = new Set(),
  onSelectListing,
  onSelectAll,
  isBulkMode = false,
  userRole,
  editorsMap,
}: ListingsTableProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState<
    Record<number, boolean>
  >({});

  // Prevent scroll lock when dropdown opens
  React.useEffect(() => {
    const hasOpenDropdown = Object.values(dropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenDropdown) {
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
  }, [dropdownOpen]);
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const baseClasses =
      "text-xs font-medium px-2 py-1 rounded-full border backdrop-blur-sm shadow-sm transition-all duration-200 hover:shadow-md";

    switch (status) {
      case "published":
        return (
          <Badge
            className={`${baseClasses} bg-green-500/15 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 dark:border-green-500/40 hover:bg-green-500/15 hover:dark:bg-green-500/20`}
          >
            Published
          </Badge>
        );
      case "draft":
        return (
          <Badge
            className={`${baseClasses} bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/40 hover:bg-blue-500/15 hover:dark:bg-blue-500/20`}
          >
            Draft
          </Badge>
        );
      case "archived":
        return (
          <Badge
            className={`${baseClasses} bg-gray-500/15 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400 border-gray-500/30 dark:border-gray-500/40 hover:bg-gray-500/15 hover:dark:bg-gray-500/20`}
          >
            Archived
          </Badge>
        );
      default:
        return (
          <Badge
            className={`${baseClasses} bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted/50`}
          >
            {status}
          </Badge>
        );
    }
  };

  // Category badge styling with varied colors
  const getCategoryBadgeClasses = (categoryId?: number | null) => {
    const badges = [
      "bg-primary/10 dark:bg-primary/15 text-primary border-primary/30 dark:border-primary/40",
      "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/40",
      "bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 dark:border-purple-500/40",
      "bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-500/40",
      "bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/40",
      "bg-pink-500/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30 dark:border-pink-500/40",
      "bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 dark:border-cyan-500/40",
      "bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/40",
    ];

    if (!categoryId) return badges[0];
    return badges[categoryId % badges.length];
  };

  // Category-based subtle accent colors for styling
  const getCategoryColorScheme = (categoryId?: number | null) => {
    // Subtle accent colors that work with glass-card styling
    const schemes = [
      {
        glow: "hover:shadow-primary/10 dark:hover:shadow-primary/20",
        accent: "bg-primary/5 dark:bg-primary/10",
      },
      {
        glow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20",
        accent: "bg-blue-500/5 dark:bg-blue-500/10",
      },
      {
        glow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20",
        accent: "bg-purple-500/5 dark:bg-purple-500/10",
      },
      {
        glow: "hover:shadow-green-500/10 dark:hover:shadow-green-500/20",
        accent: "bg-green-500/5 dark:bg-green-500/10",
      },
      {
        glow: "hover:shadow-pink-500/10 dark:hover:shadow-pink-500/20",
        accent: "bg-pink-500/5 dark:bg-pink-500/10",
      },
    ];

    if (!categoryId) return schemes[0];
    return schemes[categoryId % schemes.length];
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-h-[600px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-muted rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
              <div className="h-6 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-16" />
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-4 bg-muted rounded w-28" />
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-4 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 min-h-[600px]">
        <Building className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">No listings found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          No listings match the current filters. Try adjusting your search
          criteria or create a new listing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[600px]">
      {/* Bulk Selection Header */}
      {isBulkMode && onSelectAll && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm rounded-xl border border-primary/20 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={
                listings.length > 0 && selectedListings.size === listings.length
              }
              onCheckedChange={(checked) => onSelectAll(checked as boolean)}
              aria-label="Select all listings"
            />
            <span className="text-sm font-medium text-primary">
              {selectedListings.size > 0
                ? `${selectedListings.size} of ${listings.length} selected`
                : `Select listings (${listings.length} total)`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-start">
        {listings.map((listing) => {
          const colorScheme = getCategoryColorScheme(listing.category_id);
          const editors = editorsMap?.get(listing.id);

          return (
            <motion.div
              key={listing.id}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Card
                className={`group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300 ${colorScheme.glow}`}
              >
                {/* Subtle hover background - optimized for less blur */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <CardHeader className="pb-3 relative z-10 flex-shrink-0 min-h-[80px]">
                  <div className="flex items-start justify-between gap-3">
                    {isBulkMode && onSelectListing && (
                      <Checkbox
                        checked={selectedListings.has(listing.id)}
                        onCheckedChange={(checked) =>
                          onSelectListing(listing.id, checked as boolean)
                        }
                        className="mt-1"
                        aria-label={`Select ${listing.name}`}
                      />
                    )}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            onClick={() => onEditListing(listing)}
                            className="text-left font-semibold text-base leading-tight truncate pr-2 text-foreground group-hover:text-primary hover:underline transition-colors duration-300 cursor-pointer"
                            title={`Edit ${listing.name}`}
                          >
                            {listing.name}
                          </button>
                          {userRole === "super_admin" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(
                                  listing.id.toString(),
                                );
                              }}
                              title="Copy listing ID to clipboard"
                              className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors group/idbtn"
                            >
                              <span className="hidden group-hover/idbtn:inline">
                                📋
                              </span>
                              <span className="group-hover/idbtn:hidden">
                                {listing.id}
                              </span>
                            </button>
                          )}
                        </div>
                        {listing.category_name && (
                          <Badge
                            variant="outline"
                            className={`text-xs font-medium px-2 py-0.5 hover:opacity-90 transition-all duration-200 w-fit ${getCategoryBadgeClasses(
                              listing.category_id,
                            )}`}
                          >
                            {listing.category_name}
                          </Badge>
                        )}
                        {editors?.length ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium truncate">
                              Editing:{" "}
                              {editors.map((e) => e.fullName).join(", ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <DropdownMenu
                      onOpenChange={(open) =>
                        setDropdownOpen((prev) => ({
                          ...prev,
                          [listing.id]: open,
                        }))
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Open actions menu for ${listing.name}`}
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onEditListing(listing)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Listing
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            const targetSlug = listing.slug || listing.id.toString();
                            window.open(`/listing/${targetSlug}`, "_blank");
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteListing(listing)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Listing
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col space-y-3 relative z-10 flex-1">
                  {/* Description */}
                  {listing.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {listing.description}
                    </p>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-2 pt-2 border-t border-border/50 flex-1">
                    {listing.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{listing.address}</span>
                      </div>
                    )}
                    {listing.phone_number && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{listing.phone_number}</span>
                      </div>
                    )}
                    {listing.website && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{listing.website}</span>
                      </div>
                    )}
                  </div>

                  {/* Status and Featured Badges - Bottom placement */}
                  <div className="flex items-center justify-between gap-3 mt-auto pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(listing.status)}
                      {listing.is_featured && (
                        <Badge className="text-xs font-medium px-2 py-1 bg-yellow-500/20 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/40 dark:border-yellow-500/30 backdrop-blur-sm shadow-sm">
                          Featured
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(listing.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
