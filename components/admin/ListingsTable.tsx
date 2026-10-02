"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
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
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Database } from "@/types/database";
import type { ListingEditorInfo } from "@/lib/hooks/useListingEditors";

type Listing = Database["public"]["Tables"]["listings"]["Row"] & {
  category_name?: string | null;
};

interface ListingsTableProps {
  listings: Listing[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  onEditListing: (listing: Listing) => void;
  onDeleteListing: (listing: Listing) => void;
  totalListings?: number;
  currentPage: number;
  totalPages: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  selectedListings?: Set<number>;
  onSelectListing?: (listingId: number, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  /** True when every listing matching the current filters is selected (may exceed loaded rows). */
  selectAllPages?: boolean;
  isBulkMode?: boolean;
  userRole?: string;
  editorsMap?: Map<number, ListingEditorInfo[]>;
}

const CATEGORY_BADGES = [
  "bg-primary/10 dark:bg-primary/15 text-primary border-primary/30 dark:border-primary/40",
  "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 dark:border-blue-500/40",
  "bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 dark:border-purple-500/40",
  "bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-500/40",
  "bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/40",
  "bg-pink-500/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/30 dark:border-pink-500/40",
  "bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 dark:border-cyan-500/40",
  "bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-500/40",
];

function getCategoryBadgeClasses(categoryId?: number | null) {
  if (!categoryId) return CATEGORY_BADGES[0];
  return CATEGORY_BADGES[categoryId % CATEGORY_BADGES.length];
}

const CATEGORY_SCHEMES = [
  { glow: "hover:shadow-primary/10 dark:hover:shadow-primary/20" },
  { glow: "hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20" },
  { glow: "hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20" },
  { glow: "hover:shadow-green-500/10 dark:hover:shadow-green-500/20" },
  { glow: "hover:shadow-pink-500/10 dark:hover:shadow-pink-500/20" },
];

function getCategoryGlow(categoryId?: number | null) {
  if (!categoryId) return CATEGORY_SCHEMES[0].glow;
  return CATEGORY_SCHEMES[categoryId % CATEGORY_SCHEMES.length].glow;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function useGridColumnCount() {
  const [columns, setColumns] = React.useState(3);

  React.useEffect(() => {
    const mdQuery = window.matchMedia("(min-width: 768px)");
    const lgQuery = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      if (lgQuery.matches) setColumns(3);
      else if (mdQuery.matches) setColumns(2);
      else setColumns(1);
    };

    update();
    mdQuery.addEventListener("change", update);
    lgQuery.addEventListener("change", update);
    return () => {
      mdQuery.removeEventListener("change", update);
      lgQuery.removeEventListener("change", update);
    };
  }, []);

  return columns;
}

function StatusBadge({ status }: { status: string }) {
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
}

interface ListingCardItemProps {
  listing: Listing;
  isSelected: boolean;
  isBulkMode: boolean;
  userRole?: string;
  editors?: ListingEditorInfo[];
  onEditListing: (listing: Listing) => void;
  onDeleteListing: (listing: Listing) => void;
  onSelectListing?: (listingId: number, selected: boolean) => void;
}

// Highly optimized memoized listing card item
const ListingCardItem = React.memo(function ListingCardItem({
  listing,
  isSelected,
  isBulkMode,
  userRole,
  editors,
  onEditListing,
  onDeleteListing,
  onSelectListing,
}: ListingCardItemProps) {
  const glow = getCategoryGlow(listing.category_id);

  const handleEdit = React.useCallback(() => {
    onEditListing(listing);
  }, [onEditListing, listing]);

  const handleDelete = React.useCallback(() => {
    onDeleteListing(listing);
  }, [onDeleteListing, listing]);

  const handleCopyId = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(listing.id.toString());
    },
    [listing.id],
  );

  const handleOpenPublicView = React.useCallback(() => {
    const targetSlug = listing.slug || listing.id.toString();
    window.open(`/listing/${targetSlug}`, "_blank");
  }, [listing.slug, listing.id]);

  const handleCheckboxChange = React.useCallback(
    (checked: boolean | "indeterminate") => {
      onSelectListing?.(listing.id, checked === true);
    },
    [onSelectListing, listing.id],
  );

  return (
    <div className="transition-transform duration-200 hover:-translate-y-0.5 h-full">
      <Card
        className={`group relative overflow-hidden flex flex-col h-full bg-background/95 border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300 ${glow} ${
          isSelected ? "ring-2 ring-primary border-primary/60 bg-primary/[0.03]" : ""
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <CardHeader className="pb-3 relative z-10 flex-shrink-0 min-h-[80px]">
          <div className="flex items-start justify-between gap-3">
            {isBulkMode && onSelectListing && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={handleCheckboxChange}
                className="mt-1"
                aria-label={`Select ${listing.name}`}
              />
            )}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="text-left font-semibold text-base leading-tight truncate pr-2 text-foreground group-hover:text-primary hover:underline transition-colors duration-200 cursor-pointer"
                    title={`Edit ${listing.name}`}
                  >
                    {listing.name}
                  </button>
                  {userRole === "super_admin" && (
                    <button
                      type="button"
                      onClick={handleCopyId}
                      title="Copy listing ID to clipboard"
                      className="flex-shrink-0 px-1.5 py-0.5 text-xs font-mono bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded transition-colors group/idbtn"
                    >
                      <span className="hidden group-hover/idbtn:inline">📋</span>
                      <span className="group-hover/idbtn:hidden">{listing.id}</span>
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
                      Editing: {editors.map((e) => e.fullName).join(", ")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <DropdownMenu>
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
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Listing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenPublicView}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
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
              <StatusBadge status={listing.status} />
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
    </div>
  );
});

const ROW_GAP_PX = 24;
const ESTIMATED_ROW_HEIGHT = 320;

function ListingsTableInner({
  listings,
  isLoading,
  isLoadingMore = false,
  onEditListing,
  onDeleteListing,
  totalListings,
  hasMore = false,
  onLoadMore,
  selectedListings = new Set(),
  onSelectListing,
  onSelectAll,
  selectAllPages = false,
  isBulkMode = false,
  userRole,
  editorsMap,
}: ListingsTableProps) {
  const columns = useGridColumnCount();
  const listRef = React.useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = React.useState(0);

  const rowCount = Math.ceil(listings.length / columns);

  React.useLayoutEffect(() => {
    if (listRef.current) {
      setScrollMargin(listRef.current.offsetTop);
    }
  }, [listings.length, isBulkMode, isLoading]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT + ROW_GAP_PX,
    overscan: 3,
    scrollMargin,
  });

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

  const virtualRows = rowVirtualizer.getVirtualItems();

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
                listings.length === 0
                  ? false
                  : selectAllPages || selectedListings.size >= listings.length
                    ? true
                    : selectedListings.size > 0
                      ? "indeterminate"
                      : false
              }
              onCheckedChange={(checked) => onSelectAll(checked === true)}
              aria-label="Select all listings"
            />
            <span className="text-sm font-medium text-primary">
              {selectAllPages
                ? `All ${selectedListings.size.toLocaleString()} matching listing(s) selected`
                : selectedListings.size > 0
                  ? `${selectedListings.size} of ${listings.length} loaded selected`
                  : `Select listings (${listings.length} loaded)`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Virtualized listings grid (row-based for 1/2/3 columns) */}
      <div ref={listRef}>
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowListings = listings.slice(startIndex, startIndex + columns);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${
                    virtualRow.start - rowVirtualizer.options.scrollMargin
                  }px)`,
                  paddingBottom: ROW_GAP_PX,
                }}
              >
                <div
                  className="grid gap-6 items-start"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  }}
                >
                  {rowListings.map((listing) => {
                    const isSelected = selectedListings.has(listing.id);
                    const editors = editorsMap?.get(listing.id);

                    return (
                      <ListingCardItem
                        key={listing.id}
                        listing={listing}
                        isSelected={isSelected}
                        isBulkMode={isBulkMode}
                        userRole={userRole}
                        editors={editors}
                        onEditListing={onEditListing}
                        onDeleteListing={onDeleteListing}
                        onSelectListing={onSelectListing}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Show More / Continuous Pagination */}
      {listings.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t border-border/60">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span>
              Showing <strong className="text-foreground">{listings.length}</strong> of{" "}
              <strong className="text-foreground">
                {totalListings != null
                  ? totalListings.toLocaleString()
                  : listings.length.toLocaleString()}
              </strong>{" "}
              listings
            </span>
            {isBulkMode && selectedListings.size > 0 && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 font-semibold text-primary bg-primary/10 border border-primary/20"
              >
                {selectedListings.size} selected
              </Badge>
            )}
          </div>

          {hasMore ? (
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={isLoading || isLoadingMore}
              className="h-11 px-8 bg-background/90 hover:bg-accent border-primary/30 hover:border-primary/60 text-foreground font-semibold shadow-sm hover:shadow-md transition-all w-full sm:w-auto"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
                  Loading More Listings...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2 text-primary" />
                  Show More Listings{" "}
                  {totalListings != null && totalListings > listings.length
                    ? `(${(totalListings - listings.length).toLocaleString()} remaining)`
                    : ""}
                </>
              )}
            </Button>
          ) : (
            <div className="text-xs font-medium text-muted-foreground bg-muted/40 px-3.5 py-2 rounded-full border border-border/40">
              ✓ All {listings.length.toLocaleString()} matching listings loaded
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ListingsTable = React.memo(ListingsTableInner);
