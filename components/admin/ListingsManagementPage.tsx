"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListingsTable } from "./ListingsTable";
import { ListingModal } from "./ListingModal";
import { ExportImportModal } from "./ExportImportModal";
import { SafeImportModal } from "./SafeImportModal";
import { BulkCategoryModal } from "./BulkCategoryModal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  RefreshCw,
  Building,
  Eye,
  Star,
  Archive,
  Upload,
  Download,
  Trash2,
  CheckSquare,
  Square,
  FileText,
  FolderInput,
} from "lucide-react";
import type { Listing } from "@/types/listing.types";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import { useListingEditors } from "@/lib/hooks/useListingEditors";

const DEBUG_PRESENCE_PAGE = process.env.NEXT_PUBLIC_PRESENCE_DEBUG === "1";

export function ListingsManagementPage() {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = React.useState<Listing | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [listingToDelete, setListingToDelete] = React.useState<Listing | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [stats, setStats] = React.useState({
    total: 0,
    published: 0,
    draft: 0,
    featured: 0,
    archived: 0,
  });

  // Categories state
  const [categories, setCategories] = React.useState<
    Array<{
      value: string;
      label: string;
      slug: string;
      parentId: string | null;
      iconName: string | null;
    }>
  >([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(false);

  // Group subcategories under their main categories for hierarchy
  const categoryGroups = React.useMemo(() => {
    const parents = categories.filter((c) => !c.parentId);
    const groups: Array<{
      parent: {
        value: string;
        label: string;
        slug: string;
        parentId: string | null;
        iconName?: string | null;
      };
      subcategories: Array<{
        value: string;
        label: string;
        slug: string;
        parentId: string | null;
        iconName?: string | null;
      }>;
    }> = [];

    const processedSubIds = new Set<string>();

    for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.value);
      subs.forEach((s) => processedSubIds.add(s.value));
      groups.push({
        parent,
        subcategories: subs,
      });
    }

    const orphans = categories.filter(
      (c) => c.parentId && !processedSubIds.has(c.value)
    );
    if (orphans.length > 0) {
      groups.push({
        parent: {
          value: "other",
          label: "Other Categories",
          slug: "other",
          parentId: null,
          iconName: null,
        },
        subcategories: orphans,
      });
    }

    return groups;
  }, [categories]);

  // Track category dropdown open state to prevent layout shift
  const [filterDropdownOpen, setFilterDropdownOpen] = React.useState({
    category: false,
  });

  // Export/Import modal state
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  // Queue realtime refreshes while modal is open; apply after close
  const pendingRefreshRef = React.useRef(false);

  // Separate abort controllers: foreground fetches (user actions) should not
  // be cancelled by background/silent fetches (realtime events).
  const fgAbortRef = React.useRef<AbortController | null>(null);
  const bgAbortRef = React.useRef<AbortController | null>(null);

  // Bulk selection state
  const [selectedListings, setSelectedListings] = React.useState<Set<number>>(
    new Set(),
  );
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] =
    React.useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [isBulkStatusUpdating, setIsBulkStatusUpdating] = React.useState(false);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] =
    React.useState(false);
  const [selectAllPages, setSelectAllPages] = React.useState(false);
  const [isLoadingAllIds, setIsLoadingAllIds] = React.useState(false);
  const [bulkDockMounted, setBulkDockMounted] = React.useState(false);

  React.useEffect(() => {
    setBulkDockMounted(true);
  }, []);

  // User profile state for role-based access control
  const [userProfile, setUserProfile] = React.useState<{
    id: string;
    full_name: string;
    role: string;
  } | null>(null);

  const { toast } = useToast();
  const { editorsMap, trackEditing, stopTracking } = useListingEditors();

  // Client-side validation function
  const validateListingData = (data: Partial<Listing>): string | null => {
    if (!data.name?.trim()) {
      return "Please enter a name for the listing";
    }
    if (
      !data.category_id &&
      !(Array.isArray(data.category_ids) && data.category_ids.length > 0)
    ) {
      return "Please select at least one category for the listing";
    }
    return null; // No validation errors
  };

  // Prevent scroll lock when filter dropdowns open
  React.useEffect(() => {
    const hasOpenFilterDropdown = Object.values(filterDropdownOpen).some(
      (isOpen) => isOpen,
    );

    if (hasOpenFilterDropdown) {
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
  }, [filterDropdownOpen]);

  // Pagination
  const itemsPerPage = 20;
  const [totalListings, setTotalListings] = React.useState(0);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const totalPages = Math.ceil(totalListings / itemsPerPage);
  const hasMore = listings.length < totalListings;

  // Paginated listings fetch. `silent` skips the loading skeleton for background/realtime refreshes.
  // Foreground and background fetches use separate abort controllers so they don't cancel each other.
  const fetchListings = React.useCallback(
    async (
      page: number = 1,
      search: string = "",
      status: string = "",
      category: string = "",
      silent: boolean = false,
      append: boolean = false,
      customLimit?: number,
      offsetOverride?: number,
    ) => {
      const abortRef = silent ? bgAbortRef : fgAbortRef;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!silent) {
          if (append) {
            setIsLoadingMore(true);
          } else {
            setIsLoading(true);
          }
        }

        const effectiveLimit = customLimit ?? itemsPerPage;
        const params = new URLSearchParams({
          page: page.toString(),
          limit: effectiveLimit.toString(),
        });
        if (offsetOverride !== undefined) {
          params.append("offset", offsetOverride.toString());
        }

        if (search) params.append("search", search);
        if (status && status !== "all") params.append("status", status);
        if (category && category !== "all")
          params.append("category_id", category);
        // Append loads don't need global tab counts — skip 5 COUNT(*) queries
        if (append) params.append("skip_stats", "1");

        const response = await fetch(
          `/api/admin/listings?${params.toString()}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (controller.signal.aborted) return;

        if (result.success) {
          if (append) {
            setListings((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newItems = (result.data.listings || []).filter(
                (l: Listing) => !existingIds.has(l.id),
              );
              return [...prev, ...newItems];
            });
            setCurrentPage(page);
          } else {
            setListings(result.data.listings || []);
            setCurrentPage(1);
          }
          setTotalListings(result.data.pagination.total);
          if (result.data.stats) {
            setStats(result.data.stats);
          }
          if (result.data.currentUser) {
            setUserProfile(result.data.currentUser);
            if (DEBUG_PRESENCE_PAGE) {
              console.info(
                "[presence:page] currentUser from API",
                result.data.currentUser,
              );
            }
          }
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Fetch listings error:", error);
        toast({
          title: "Error",
          description: "Failed to fetch listings",
          variant: "destructive",
        });
      } finally {
        if (!controller.signal.aborted && !silent) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [toast, itemsPerPage],
  );

  // Refresh listings - preserves currently loaded depth so multi-page bulk selections aren't wiped.
  // `force` allows a silent post-action sync even while bulk mode is still on (avoids skeleton remount).
  const refreshListings = React.useCallback(
    (silent = false, force = false) => {
      // If silent background refresh and user is working in bulk mode or modal is open, skip
      if (
        silent &&
        !force &&
        (isBulkMode ||
          selectedListings.size > 0 ||
          isModalOpen ||
          isBulkCategoryModalOpen)
      ) {
        return;
      }

      // Preserve currently loaded item count on refresh
      const loadedCount = listings.length > 0 ? listings.length : itemsPerPage;
      fetchListings(
        1,
        debouncedSearchQuery,
        statusFilter,
        categoryFilter,
        silent,
        false,
        loadedCount,
      );
    },
    [
      fetchListings,
      debouncedSearchQuery,
      statusFilter,
      categoryFilter,
      isBulkMode,
      selectedListings.size,
      isModalOpen,
      isBulkCategoryModalOpen,
      listings.length,
      itemsPerPage,
    ],
  );

  /** Remove listings from local state without remounting the grid (no skeleton). */
  const removeListingsLocally = React.useCallback((removed: Listing[]) => {
    if (removed.length === 0) return;
    const idSet = new Set(removed.map((l) => l.id));
    setListings((prev) => prev.filter((l) => !idSet.has(l.id)));
    setTotalListings((prev) => Math.max(0, prev - removed.length));
    setSelectedListings((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      idSet.forEach((id) => next.delete(id));
      return next;
    });
    setStats((prev) => {
      const next = { ...prev };
      next.total = Math.max(0, next.total - removed.length);
      for (const listing of removed) {
        if (listing.status === "published") {
          next.published = Math.max(0, next.published - 1);
        } else if (listing.status === "draft") {
          next.draft = Math.max(0, next.draft - 1);
        } else if (listing.status === "archived") {
          next.archived = Math.max(0, next.archived - 1);
        }
        if (listing.is_featured) {
          next.featured = Math.max(0, next.featured - 1);
        }
      }
      return next;
    });
  }, []);

  // Handle Show More listings
  const handleLoadMore = React.useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;
    const currentOffset = listings.length;
    const nextPage = Math.floor(currentOffset / itemsPerPage) + 1;
    fetchListings(
      nextPage,
      debouncedSearchQuery,
      statusFilter,
      categoryFilter,
      false,
      true,
      itemsPerPage,
      currentOffset,
    );
  }, [
    isLoading,
    isLoadingMore,
    hasMore,
    listings.length,
    itemsPerPage,
    fetchListings,
    debouncedSearchQuery,
    statusFilter,
    categoryFilter,
  ]);

  // Re-fetch when any filter or debounced search changes (resets to page 1)
  React.useEffect(() => {
    setCurrentPage(1);
    fetchListings(
      1,
      debouncedSearchQuery,
      statusFilter,
      categoryFilter,
      false,
      false,
    );
  }, [fetchListings, debouncedSearchQuery, statusFilter, categoryFilter]);

  // Debounce search query - wait 500ms after user stops typing
  React.useEffect(() => {
    const searchTimer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // Realtime: silent background refresh with 10s cooldown so the scraper's
  // bulk writes don't cause constant skeleton flashing for admins.
  useRealtimeRefresh(
    "admin-listings-realtime",
    [{ table: "listings" }],
    () => {
      if (isModalOpen || isBulkCategoryModalOpen) {
        pendingRefreshRef.current = true;
        return;
      }
      refreshListings(true);
    },
    600,
    10_000,
  );

  React.useEffect(() => {
    if (!isModalOpen && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      refreshListings(true);
    }
  }, [isModalOpen, refreshListings]);

  // Fetch categories on mount
  React.useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories?all=true");
        const result = await response.json();

        if (result.success) {
          setCategories(result.categories);
        } else {
          console.error("Failed to fetch categories:", result.error);
          toast({
            title: "Error",
            description: "Failed to load categories",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast({
          title: "Error",
          description: "Failed to load categories",
          variant: "destructive",
        });
      } finally {
        setCategoriesLoading(false);
      }
    };

    fetchCategories();
  }, [toast]);

  const handleStatusTabChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const handleEditListing = React.useCallback((listing: Listing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
    trackEditing(listing.id);
  }, [trackEditing]);

  const handleCreateListing = () => {
    setSelectedListing(null);
    setIsModalOpen(true);
  };

  const handleExportListings = () => {
    setIsExportModalOpen(true);
  };

  const handleImportListings = () => {
    setIsImportModalOpen(true);
  };

  const handleSaveListing = async (listingData: Partial<Listing>) => {
    try {
      // Client-side validation before API call
      const validationError = validateListingData(listingData);
      if (validationError) {
        toast({
          title: "Validation Error",
          description: validationError,
          variant: "destructive",
        });
        return null; // Don't proceed with API call
      }

      const isUpdate = !!selectedListing;
      const url = isUpdate
        ? `/api/admin/listings/${selectedListing.id}`
        : "/api/admin/listings";
      const method = isUpdate ? "PATCH" : "POST";
      const changedKeys = Object.keys(listingData).sort();

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(listingData),
      });

      const result = await response.json().catch(() => null);
      const backendCode =
        result && typeof result === "object" && "code" in result
          ? String(result.code)
          : null;
      const backendError =
        result && typeof result === "object" && "error" in result
          ? String(result.error)
          : "Failed to save listing";
      const requestId =
        response.headers.get("x-request-id") ||
        (result &&
        typeof result === "object" &&
        "requestId" in result &&
        typeof result.requestId === "string"
          ? result.requestId
          : null);

      if (response.ok && result?.success) {
        setIsModalOpen(false);
        setSelectedListing(null);
        stopTracking();
        if (!isUpdate && currentPage !== 1) {
          setCurrentPage(1);
        } else {
          refreshListings();
        }
        toast({
          title: "Success",
          description: `Listing ${
            isUpdate ? "updated" : "created"
          } successfully`,
        });
        // Return the created/updated listing object
        return result.data || null;
      } else {
        const errorMessage = backendError;

        if (response.status === 409) {
          toast({
            title: "Edit Conflict",
            description:
              "Another staff member saved changes first. The listing has been refreshed — please review and try again.",
            variant: "destructive",
          });
          // Re-fetch the fresh listing so the modal has updated data
          try {
            const freshRes = await fetch(
              `/api/admin/listings/${selectedListing?.id}`,
            );
            const freshResult = await freshRes.json();
            if (freshResult.success && freshResult.data) {
              setSelectedListing(freshResult.data.listing);
            }
          } catch {
            // Fall back to closing the modal if re-fetch fails
            setIsModalOpen(false);
            setSelectedListing(null);
            stopTracking();
          }
          refreshListings();
          return null;
        }

        console.error("[ListingsManagementPage] listing save failed", {
          route: url,
          method,
          status: response.status,
          backendCode,
          backendError,
          requestId,
          listingId: selectedListing?.id ?? null,
          changedKeys,
        });

        if (errorMessage.includes("Category is required")) {
          throw new Error("Please select a category for the listing");
        } else if (errorMessage.includes("Listing name is required")) {
          throw new Error("Please enter a name for the listing");
        } else if (errorMessage.includes("Invalid request")) {
          throw new Error("Please check all required fields and try again");
        } else {
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      // Extract error message for display
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save listing";
      console.error("[ListingsManagementPage] listing save request threw", {
        route: selectedListing
          ? `/api/admin/listings/${selectedListing.id}`
          : "/api/admin/listings",
        method: selectedListing ? "PATCH" : "POST",
        listingId: selectedListing?.id ?? null,
        changedKeys: Object.keys(listingData).sort(),
        errorMessage,
      });

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleDeleteListing = React.useCallback((listing: Listing) => {
    setListingToDelete(listing);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!listingToDelete) return;

    try {
      setIsDeleting(true);
      const response = await fetch(
        `/api/admin/listings/${listingToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (result.success) {
        // Optimistic local remove — avoids full-grid skeleton remount during bulk work
        removeListingsLocally([listingToDelete]);
        toast({
          title: "Success",
          description: "Listing deleted successfully",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Delete listing error:", error);
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setListingToDelete(null);
    }
  };

  // Bulk selection handlers
  const handleToggleBulkMode = () => {
    setIsBulkMode((prev) => !prev);
    if (isBulkMode) {
      // Exiting bulk mode, clear selections
      setSelectedListings(new Set());
    }
  };

  const handleSelectListing = React.useCallback((listingId: number, selected: boolean) => {
    setSelectedListings((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(listingId);
      } else {
        newSet.delete(listingId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = React.useCallback((selected: boolean) => {
    // Reset "select all pages" when toggling
    setSelectAllPages(false);

    if (selected) {
      // Select all on current page
      setSelectedListings(new Set(listings.map((listing) => listing.id)));
    } else {
      // Deselect all
      setSelectedListings(new Set());
    }
  }, [listings]);

  const handleSelectAllPages = async () => {
    if (!isBulkMode) return;

    try {
      setIsLoadingAllIds(true);

      // Build query params to match current filters
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (statusFilter && statusFilter !== "all")
        params.append("status", statusFilter);
      if (categoryFilter && categoryFilter !== "all")
        params.append("category_id", categoryFilter);

      const response = await fetch(
        `/api/admin/listings/ids?${params.toString()}`,
      );
      const result = await response.json();

      if (result.success) {
        setSelectedListings(new Set((result.data.ids || []).map((id: unknown) => Number(id))));
        setSelectAllPages(true);

        toast({
          title: "Success",
          description: `Selected all ${result.data.count} matching listings`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error selecting all pages:", error);
      toast({
        title: "Error",
        description: "Failed to select all listings",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAllIds(false);
    }
  };

  const handleDeselectAll = () => {
    setSelectedListings(new Set());
    setSelectAllPages(false);
  };

  const handleBulkDelete = () => {
    if (selectedListings.size === 0 || !isBulkMode) return;
    setIsBulkDeleteDialogOpen(true);
  };

  const handleBulkStatusUpdate = async (nextStatus: "published" | "draft" | "archived") => {
    if (selectedListings.size === 0 || !isBulkMode) return;

    try {
      setIsBulkStatusUpdating(true);
      const selectedCount = selectedListings.size;
      const selectedIds = Array.from(selectedListings).map((id) => Number(id));

      const response = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: selectedIds,
          status: nextStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const idSet = new Set(selectedIds);
        // If current status filter no longer matches, drop those rows locally
        if (statusFilter !== "all" && statusFilter !== nextStatus) {
          const removed = listings.filter((l) => idSet.has(l.id));
          removeListingsLocally(removed);
        } else {
          setListings((prev) =>
            prev.map((l) =>
              idSet.has(l.id) ? { ...l, status: nextStatus } : l,
            ),
          );
        }
        setSelectedListings(new Set());
        setSelectAllPages(false);
        // Silent force refresh to resync totals without skeleton remount
        refreshListings(true, true);

        toast({
          title: "Success",
          description: `${result.updatedCount ?? selectedCount} listing(s) moved to ${nextStatus}`,
        });
      } else {
        throw new Error(result.error || "Failed to update listing status");
      }
    } catch (error) {
      console.error("Bulk status update error:", error);
      toast({
        title: "Error",
        description: "Failed to update listing status",
        variant: "destructive",
      });
    } finally {
      setIsBulkStatusUpdating(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedListings.size === 0 || !isBulkMode) return;

    try {
      setIsBulkDeleting(true);
      const selectedIds = Array.from(selectedListings).map((id) => Number(id));
      const idSet = new Set(selectedIds);
      const removedLocal = listings.filter((l) => idSet.has(l.id));

      const response = await fetch("/api/admin/listings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const result = await response.json();

      if (result.success) {
        removeListingsLocally(removedLocal);
        setSelectedListings(new Set());
        setSelectAllPages(false);
        // Silent force refresh when select-all-pages deleted more than loaded rows
        if (selectAllPages || selectedIds.length > removedLocal.length) {
          refreshListings(true, true);
        }
        toast({
          title: "Success",
          description: `${result.deletedCount} listing(s) deleted successfully`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete listings",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const selectedIds = React.useMemo(
    () => Array.from(selectedListings).map((id) => Number(id)),
    [selectedListings],
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Statistics Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
      >
        {[
          {
            key: "all" as const,
            label: "Total Listings",
            value: stats.total,
            icon: Building,
            card: "bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25",
            ring: "ring-2 ring-blue-500/50",
            title:
              "text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors",
            iconWrap:
              "p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors",
            iconColor: "h-4 w-4 text-blue-600 dark:text-blue-400",
            number:
              "text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
          },
          {
            key: "published" as const,
            label: "Published",
            value: stats.published,
            icon: Eye,
            card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25",
            ring: "ring-2 ring-green-500/50",
            title:
              "text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors",
            iconWrap:
              "p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors",
            iconColor: "h-4 w-4 text-green-600 dark:text-green-400",
            number:
              "text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors",
          },
          {
            key: "draft" as const,
            label: "Draft",
            value: stats.draft,
            icon: FileText,
            card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25",
            ring: "ring-2 ring-orange-500/50",
            title:
              "text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors",
            iconWrap:
              "p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors",
            iconColor: "h-4 w-4 text-orange-600 dark:text-orange-400",
            number:
              "text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors",
          },
          {
            key: "featured" as const,
            label: "Featured",
            value: stats.featured,
            icon: Star,
            card: "bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25",
            ring: "ring-2 ring-purple-500/50",
            title:
              "text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors",
            iconWrap:
              "p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors",
            iconColor: "h-4 w-4 text-purple-600 dark:text-purple-400",
            number:
              "text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors",
          },
          {
            key: "archived" as const,
            label: "Archived",
            value: stats.archived,
            icon: Archive,
            card: "bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-500/5 dark:from-slate-500/10 dark:via-slate-500/5 dark:to-slate-500/0 border-slate-500/30 dark:border-slate-500/20 hover:shadow-xl hover:shadow-slate-500/25",
            ring: "ring-2 ring-slate-500/50",
            title:
              "text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors",
            iconWrap:
              "p-2 bg-slate-500/10 rounded-lg group-hover:bg-slate-500/20 transition-colors",
            iconColor: "h-4 w-4 text-slate-600 dark:text-slate-400",
            number:
              "text-2xl font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors",
          },
        ].map(
          ({
            key,
            label,
            value,
            icon: Icon,
            card,
            ring,
            title,
            iconWrap,
            iconColor,
            number,
          }) => {
            const isClickable = key !== "featured";
            return (
              <motion.div
                key={key}
                variants={itemVariants}
                whileHover={
                  isClickable
                    ? { scale: 1.02, transition: { duration: 0.2 } }
                    : undefined
                }
                onClick={
                  isClickable ? () => handleStatusTabChange(key) : undefined
                }
              >
                <Card
                  className={`${card} transition-all duration-300 group ${isClickable ? "cursor-pointer" : "cursor-default"} ${isClickable && statusFilter === key ? ring : ""}`}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className={title}>{label}</CardTitle>
                    <div className={iconWrap}>
                      <Icon className={iconColor} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={number}>{value}</div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          },
        )}
      </motion.div>

      {/* Status Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs
          value={statusFilter}
          onValueChange={handleStatusTabChange}
          className="w-full"
        >
          <TabsList className="h-11 bg-muted/50 backdrop-blur-sm border border-border/50 p-1 rounded-lg w-full sm:w-auto">
            <TabsTrigger
              value="all"
              className="px-4 data-[state=active]:shadow-md"
            >
              All
              <span className="ml-1.5 text-xs opacity-70">({stats.total})</span>
            </TabsTrigger>
            <TabsTrigger
              value="published"
              className="px-4 data-[state=active]:shadow-md"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Published
              <span className="ml-1.5 text-xs opacity-70">
                ({stats.published})
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="draft"
              className="px-4 data-[state=active]:shadow-md"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Draft
              <span className="ml-1.5 text-xs opacity-70">({stats.draft})</span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="px-4 data-[state=active]:shadow-md"
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archived
              <span className="ml-1.5 text-xs opacity-70">
                ({stats.archived})
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Filters and Actions */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <label htmlFor="listings-search" className="sr-only">
                Search listings
              </label>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 bg-primary/10 rounded-md">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                id="listings-search"
                name="listings-search"
                autoComplete="off"
                placeholder="Search listings by name, category, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            {/* Category Filter */}
            <Select
              name="category-filter"
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              onOpenChange={(open) =>
                setFilterDropdownOpen((prev) => ({ ...prev, category: open }))
              }
            >
              <SelectTrigger
                id="category-filter"
                aria-label="Filter listings by category"
                className="w-52 h-11 bg-background/50 border-border/50"
              >
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesLoading ? (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                ) : (
                  categoryGroups.map(({ parent, subcategories }) => (
                    <SelectGroup key={parent.value}>
                      <SelectLabel className="text-xs font-semibold text-primary uppercase tracking-wider pl-3 py-1.5 bg-muted/40 mt-1 border-b border-border/40">
                        {parent.label}
                      </SelectLabel>
                      {parent.value !== "other" && (
                        <SelectItem
                          value={parent.value}
                          className="pl-5 font-medium text-xs"
                        >
                          All {parent.label}
                        </SelectItem>
                      )}
                      {subcategories.map((category) => (
                        <SelectItem
                          key={category.value}
                          value={category.value}
                          className="pl-7 text-xs"
                        >
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => refreshListings()}
              disabled={isLoading}
              className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {/* Export/Import buttons - only show for admin and super_admin roles */}
            {userProfile &&
              (userProfile.role === "admin" ||
                userProfile.role === "super_admin") && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleExportListings}
                    disabled={isLoading}
                    className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleImportListings}
                    disabled={isLoading}
                    className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import
                  </Button>
                </>
              )}
            <Button
              variant={isBulkMode ? "default" : "outline"}
              onClick={handleToggleBulkMode}
              className={`h-11 px-6 ${
                isBulkMode
                  ? "bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25"
                  : "bg-background/50 border-border/50 hover:bg-background/80"
              }`}
            >
              {isBulkMode ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {isBulkMode ? "Exit Bulk" : "Bulk"}
            </Button>
            <Button
              onClick={handleCreateListing}
              className="h-11 px-6 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Floating Action Dock — portaled to body so layout overflow-x-clip
          cannot trap position:fixed (sticky/fixed both failed inside the shell). */}
      {bulkDockMounted &&
        createPortal(
          <AnimatePresence>
            {isBulkMode && selectedListings.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="fixed bottom-6 right-4 sm:right-6 lg:right-8 z-[100] max-w-[calc(100vw-2rem)] pointer-events-none"
              >
                <div className="p-2.5 sm:p-3 bg-background/95 dark:bg-card/95 backdrop-blur-2xl border border-primary/30 rounded-2xl shadow-2xl shadow-primary/15 pointer-events-auto ring-1 ring-primary/20 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Selected Count & Clear */}
                    <div className="flex items-center gap-2 pr-2 border-r border-border/70">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-primary whitespace-nowrap">
                        <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                        <span>
                          {selectAllPages
                            ? `All ${selectedListings.size.toLocaleString()}`
                            : selectedListings.size.toLocaleString()}{" "}
                          selected
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDeselectAll}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80"
                      >
                        Clear
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsBulkCategoryModalOpen(true)}
                        disabled={isBulkStatusUpdating || isBulkDeleting}
                        className="h-8 px-2.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 font-medium shadow-sm"
                      >
                        <FolderInput className="h-3.5 w-3.5 mr-1.5" />
                        Move Subcategory ({selectedListings.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusUpdate("published")}
                        disabled={isBulkStatusUpdating || isBulkDeleting}
                        className="h-8 px-2.5 text-xs bg-background/80 border-border/80 hover:bg-background"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Publish
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusUpdate("draft")}
                        disabled={isBulkStatusUpdating || isBulkDeleting}
                        className="h-8 px-2.5 text-xs bg-background/80 border-border/80 hover:bg-background"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Draft
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkStatusUpdate("archived")}
                        disabled={isBulkStatusUpdating || isBulkDeleting}
                        className="h-8 px-2.5 text-xs bg-background/80 border-border/80 hover:bg-background"
                      >
                        <Archive className="h-3 w-3 mr-1" />
                        Archive
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting || isBulkStatusUpdating}
                        className="h-8 px-2.5 text-xs bg-destructive hover:bg-destructive/90 shadow-md font-medium"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete ({selectedListings.size})
                      </Button>
                    </div>
                  </div>

                  {/* Select All Pages Banner */}
                  {!selectAllPages &&
                    selectedListings.size === listings.length &&
                    listings.length > 0 &&
                    totalListings > listings.length && (
                      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-1.5 text-xs text-muted-foreground bg-primary/5 dark:bg-primary/10 rounded-lg px-2.5 py-1.5">
                        <span>
                          All <strong>{listings.length}</strong> loaded on this screen selected.
                        </span>
                        <button
                          type="button"
                          onClick={handleSelectAllPages}
                          disabled={isLoadingAllIds}
                          className="font-semibold text-primary hover:underline disabled:opacity-50 cursor-pointer"
                        >
                          {isLoadingAllIds
                            ? "Loading..."
                            : `Select all ${totalListings.toLocaleString()} matching?`}
                        </button>
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      {/* Listings Table */}
      <motion.div variants={itemVariants}>
        <ListingsTable
          listings={listings}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          onEditListing={handleEditListing}
          onDeleteListing={handleDeleteListing}
          totalListings={totalListings}
          currentPage={currentPage}
          totalPages={totalPages}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          selectedListings={selectedListings}
          onSelectListing={handleSelectListing}
          onSelectAll={handleSelectAll}
          selectAllPages={selectAllPages}
          isBulkMode={isBulkMode}
          userRole={userProfile?.role}
          editorsMap={editorsMap}
        />
      </motion.div>

      {/* Bulk Category / Subcategory Modal */}
      <BulkCategoryModal
        isOpen={isBulkCategoryModalOpen}
        onClose={() => setIsBulkCategoryModalOpen(false)}
        selectedCount={selectedListings.size}
        selectedIds={selectedIds}
        categories={categories}
        categoryGroups={categoryGroups}
        onCategoriesRefresh={async () => {
          try {
            const catRes = await fetch("/api/categories?all=true");
            const catData = await catRes.json();
            if (catData.success) {
              setCategories(catData.categories);
            }
          } catch (e) {
            console.error("Failed to refresh categories:", e);
          }
        }}
        onSuccess={async () => {
          setSelectedListings(new Set());
          setSelectAllPages(false);
          // Silent force — keep grid mounted while bulk mode is still on
          refreshListings(true, true);
          // Also refresh categories in background in case a new subcategory was created
          try {
            const catRes = await fetch("/api/categories?all=true");
            const catData = await catRes.json();
            if (catData.success) {
              setCategories(catData.categories);
            }
          } catch (e) {
            console.error("Failed to refresh categories:", e);
          }
        }}
      />

      {/* Listing Modal */}
      <ListingModal
        listing={selectedListing}
        isOpen={isModalOpen}
        currentUserId={userProfile?.id || null}
        activeEditors={
          selectedListing ? editorsMap.get(selectedListing.id) || [] : []
        }
        onClose={() => {
          setIsModalOpen(false);
          setSelectedListing(null);
          stopTracking();
        }}
        onSave={handleSaveListing}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setListingToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Listing"
        description={`Are you sure you want to delete "${listingToDelete?.name}"? This action cannot be undone and will permanently remove the listing from the platform.`}
        confirmText="Delete Listing"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isBulkDeleteDialogOpen}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Multiple Listings"
        description={`Are you sure you want to delete ${selectedListings.size} listing(s)? This action cannot be undone and will permanently remove the selected listings from the platform.`}
        confirmText={`Delete ${selectedListings.size} Listing(s)`}
        cancelText="Cancel"
        variant="destructive"
        isLoading={isBulkDeleting}
      />

      {/* Export Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        mode="export"
      />

      {/* Import Modal */}
      <SafeImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={refreshListings}
      />
    </motion.div>
  );
}
