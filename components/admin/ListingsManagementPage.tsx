"use client";

import * as React from "react";
import { motion } from "framer-motion";
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
  const [selectAllPages, setSelectAllPages] = React.useState(false);
  const [isLoadingAllIds, setIsLoadingAllIds] = React.useState(false);

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
  const totalPages = Math.ceil(totalListings / itemsPerPage);

  // Paginated listings fetch. `silent` skips the loading skeleton for background/realtime refreshes.
  // Foreground and background fetches use separate abort controllers so they don't cancel each other.
  const fetchListings = React.useCallback(
    async (
      page: number = 1,
      search: string = "",
      status: string = "",
      category: string = "",
      silent: boolean = false,
    ) => {
      const abortRef = silent ? bgAbortRef : fgAbortRef;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!silent) setIsLoading(true);

        const params = new URLSearchParams({
          page: page.toString(),
          limit: itemsPerPage.toString(),
        });

        if (search) params.append("search", search);
        if (status && status !== "all") params.append("status", status);
        if (category && category !== "all")
          params.append("category_id", category);

        const response = await fetch(
          `/api/admin/listings?${params.toString()}`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (controller.signal.aborted) return;

        if (result.success) {
          setListings(result.data.listings);
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
        }
      }
    },
    [toast, itemsPerPage],
  );

  // Refresh listings - pass `silent: true` for background/realtime refreshes
  // to avoid showing a loading skeleton while admins are working.
  const refreshListings = React.useCallback(
    (silent = false) => {
      fetchListings(
        currentPage,
        debouncedSearchQuery,
        statusFilter,
        categoryFilter,
        silent,
      );
    },
    [
      fetchListings,
      currentPage,
      debouncedSearchQuery,
      statusFilter,
      categoryFilter,
    ],
  );

  // Re-fetch when any filter, page, or debounced search changes
  React.useEffect(() => {
    refreshListings();
  }, [refreshListings]);

  // Debounce search query - wait 500ms after user stops typing
  React.useEffect(() => {
    const searchTimer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, debouncedSearchQuery]);

  // Realtime: silent background refresh with 10s cooldown so the scraper's
  // bulk writes don't cause constant skeleton flashing for admins.
  useRealtimeRefresh(
    "admin-listings-realtime",
    [{ table: "listings" }],
    () => {
      if (isModalOpen) {
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
        const response = await fetch("/api/categories");
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

  const handleEditListing = (listing: Listing) => {
    setSelectedListing(listing);
    setIsModalOpen(true);
    trackEditing(listing.id);
  };

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

  const handleDeleteListing = (listing: Listing) => {
    setListingToDelete(listing);
    setIsDeleteDialogOpen(true);
  };

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
        refreshListings();
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

  const handleSelectListing = (listingId: number, selected: boolean) => {
    if (!isBulkMode) return;
    setSelectedListings((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(listingId);
      } else {
        newSet.delete(listingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (!isBulkMode) return;

    // Reset "select all pages" when toggling
    setSelectAllPages(false);

    if (selected) {
      // Select all on current page
      setSelectedListings(new Set(listings.map((listing) => listing.id)));
    } else {
      // Deselect all
      setSelectedListings(new Set());
    }
  };

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
        setSelectedListings(new Set(result.data.ids));
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

  const handleBulkStatusUpdate = async (nextStatus: "published" | "draft") => {
    if (selectedListings.size === 0 || !isBulkMode) return;

    try {
      setIsBulkStatusUpdating(true);
      const selectedCount = selectedListings.size;

      const response = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedListings),
          status: nextStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSelectedListings(new Set());
        setSelectAllPages(false);
        refreshListings();

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
      const response = await fetch("/api/admin/listings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: Array.from(selectedListings) }),
      });

      const result = await response.json();

      if (result.success) {
        setSelectedListings(new Set());
        refreshListings();
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

        {/* Bulk Actions */}
        {isBulkMode && selectedListings.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 space-y-3"
          >
            {/* Main Selection Bar */}
            <div className="p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border border-primary/30 rounded-xl shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      {selectAllPages
                        ? `All ${selectedListings.size} listing(s) selected`
                        : `${selectedListings.size} listing(s) selected`}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="h-8 bg-background/50 border-border/50 hover:bg-background/80"
                  >
                    Clear Selection
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate("published")}
                    disabled={isBulkStatusUpdating || isBulkDeleting}
                    className="h-8 bg-background/50 border-border/50 hover:bg-background/80"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Publish Selected
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkStatusUpdate("draft")}
                    disabled={isBulkStatusUpdating || isBulkDeleting}
                    className="h-8 bg-background/50 border-border/50 hover:bg-background/80"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Move to Draft
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting || isBulkStatusUpdating}
                    className="h-8 bg-destructive hover:bg-destructive/90 shadow-sm hover:shadow-md"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Selected ({selectedListings.size})
                  </Button>
                </div>
              </div>
            </div>

            {/* Select All Pages Banner (shown when current page is fully selected but not all pages) */}
            {!selectAllPages &&
              selectedListings.size === listings.length &&
              listings.length > 0 &&
              stats.total > listings.length && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      All <strong>{listings.length}</strong> listings on this
                      page are selected.{" "}
                      <button
                        onClick={handleSelectAllPages}
                        disabled={isLoadingAllIds}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingAllIds
                          ? "Loading..."
                          : `Select all ${stats.total} listings?`}
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}
          </motion.div>
        )}
      </motion.div>

      {/* Listings Table */}
      <motion.div variants={itemVariants}>
        <ListingsTable
          listings={listings}
          isLoading={isLoading}
          onEditListing={handleEditListing}
          onDeleteListing={handleDeleteListing}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          selectedListings={selectedListings}
          onSelectListing={handleSelectListing}
          onSelectAll={handleSelectAll}
          isBulkMode={isBulkMode}
          userRole={userProfile?.role}
          editorsMap={editorsMap}
        />
      </motion.div>

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
