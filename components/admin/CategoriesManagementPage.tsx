"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PremiumStatCard } from "./PremiumStatCard";
import { CategoriesTable } from "./CategoriesTable";
import { CategoryModal } from "./CategoryModal";
import { CategoryArchiveModal } from "./CategoryArchiveModal";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeRefresh } from "@/lib/hooks/useRealtimeRefresh";
import {
  Search,
  Plus,
  RefreshCw,
  FolderTree,
  Folders,
  GitBranch,
  Navigation,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import type {
  CategoryWithParent,
  CategoryFormData,
  CategoryStats,
} from "@/types/category.types";

type FilterType = "all" | "parents" | "children" | "active_subs" | "archived" | "in_nav";

export function CategoriesManagementPage() {
  const [categories, setCategories] = React.useState<CategoryWithParent[]>([]);
  const [stats, setStats] = React.useState<CategoryStats>({
    total: 0,
    parentCategories: 0,
    subcategories: 0,
    archivedSubcategories: 0,
    activeSubcategories: 0,
    shownInNav: 0,
    featured: 0,
    enabled: 0,
    listingCategories: 0,
    eventCategories: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [filterType, setFilterType] = React.useState<FilterType>("all");
  const [parentFilter, setParentFilter] = React.useState<string>("all");
  const [isBulkMode, setIsBulkMode] = React.useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<Set<number>>(new Set());
  const [page, setPage] = React.useState(1);
  const [perPage] = React.useState(20);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [defaultParentId, setDefaultParentId] = React.useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] =
    React.useState<CategoryWithParent | null>(null);
  const [archiveCategory, setArchiveCategory] =
    React.useState<CategoryWithParent | null>(null);
  const { toast } = useToast();

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories. `silent` skips the loading state so background
  // polling refreshes don't flash the table every cycle.
  const fetchCategories = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);

      const params = new URLSearchParams();

      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }

      if (filterType === "parents") {
        params.append("parent_id", "null");
      } else if (filterType === "in_nav") {
        params.append("show_in_nav", "true");
      }

      const response = await fetch(
        `/api/admin/categories?${params.toString()}`
      );
      const result = await response.json();

      if (result.success) {
        let fetchedCategories = result.data.categories;

        // Client-side filters
        if (filterType === "children") {
          fetchedCategories = fetchedCategories.filter(
            (c: CategoryWithParent) => c.parent_id !== null
          );
        } else if (filterType === "active_subs") {
          fetchedCategories = fetchedCategories.filter(
            (c: CategoryWithParent) => c.parent_id !== null && !c.is_archived
          );
        } else if (filterType === "archived") {
          fetchedCategories = fetchedCategories.filter(
            (c: CategoryWithParent) => c.is_archived || !c.is_enabled
          );
        }

        setCategories(fetchedCategories);
        setStats(result.data.stats);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      if (!silent) {
        toast({
          title: "Error",
          description: "Failed to fetch categories",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [debouncedSearch, filterType, toast]);

  // Initial fetch and on filter/search change
  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Background refresh so changes made by other admins eventually show up,
  // without flashing the table on every poll (30s, well below anything a
  // human would notice as "reloading").
  useRealtimeRefresh(
    "categories-management",
    [{ table: "categories" }],
    () => fetchCategories(true),
    30_000
  );

  // Create category
  const handleCreate = async (data: CategoryFormData) => {
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to create category");
    }

    await fetchCategories();
  };

  // Update category
  const handleUpdate = async (data: CategoryFormData) => {
    if (!selectedCategory) return;

    const response = await fetch(
      `/api/admin/categories/${selectedCategory.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Failed to update category");
    }

    await fetchCategories();
  };

  // Delete category
  const handleDelete = async (category: CategoryWithParent) => {
    const response = await fetch(`/api/admin/categories/${category.id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!result.success) {
      toast({
        title: "Cannot Delete",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: result.message || "Category deleted successfully",
    });

    await fetchCategories();
  };

  // Handle category archive / unarchive
  const handleArchiveCategory = async (
    category: CategoryWithParent,
    archiveListings: boolean,
    action: "archive" | "unarchive"
  ) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/categories/${category.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          archiveListings,
          unarchiveListings: archiveListings,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          title: "Error",
          description: result.error || "Failed to update category archive status",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: result.message,
      });

      await fetchCategories();
    } catch (error) {
      console.error("Archive category error:", error);
      toast({
        title: "Error",
        description: "Failed to process category archive request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Open create modal (top-level category)
  const handleOpenCreateModal = () => {
    setSelectedCategory(null);
    setDefaultParentId(null);
    setIsModalOpen(true);
  };

  // Open create subcategory modal
  const handleOpenCreateSubcategory = (parentCategory?: CategoryWithParent) => {
    setSelectedCategory(null);
    setDefaultParentId(
      parentCategory?.id ??
        (categories.find((c) => c.parent_id === null)?.id || null)
    );
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (category: CategoryWithParent) => {
    setSelectedCategory(category);
    setDefaultParentId(category.parent_id);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setDefaultParentId(null);
  };

  // Handle save (create or update)
  const handleSave = async (data: CategoryFormData) => {
    if (selectedCategory) {
      await handleUpdate(data);
    } else {
      await handleCreate(data);
    }
  };

  // Bulk archive selected categories and their listings
  const handleBulkArchive = async () => {
    try {
      setIsLoading(true);
      const updates = Array.from(selectedCategoryIds).map((id) =>
        fetch(`/api/admin/categories/${id}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", archiveListings: true }),
        })
      );

      await Promise.all(updates);

      toast({
        title: "Success",
        description: `Archived ${selectedCategoryIds.size} categories and their listings`,
      });

      setSelectedCategoryIds(new Set());
      await fetchCategories();
    } catch (error) {
      console.error("Bulk archive error:", error);
      toast({
        title: "Error",
        description: "Failed to archive some categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk unarchive selected categories and their listings
  const handleBulkUnarchive = async () => {
    try {
      setIsLoading(true);
      const updates = Array.from(selectedCategoryIds).map((id) =>
        fetch(`/api/admin/categories/${id}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unarchive", unarchiveListings: true }),
        })
      );

      await Promise.all(updates);

      toast({
        title: "Success",
        description: `Unarchived ${selectedCategoryIds.size} categories and restored listings`,
      });

      setSelectedCategoryIds(new Set());
      await fetchCategories();
    } catch (error) {
      console.error("Bulk unarchive error:", error);
      toast({
        title: "Error",
        description: "Failed to unarchive some categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Bulk remove parent
  const handleBulkRemoveParent = async () => {
    try {
      setIsLoading(true);
      const updates = Array.from(selectedCategoryIds).map(id =>
        fetch(`/api/admin/categories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: null }),
        })
      );

      await Promise.all(updates);

      toast({
        title: "Success",
        description: `Removed parent from ${selectedCategoryIds.size} categories`,
      });

      setSelectedCategoryIds(new Set());
      await fetchCategories();
    } catch (error) {
      console.error("Bulk update error:", error);
      toast({
        title: "Error",
        description: "Failed to update some categories",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pagination calculations
  const filteredCategories = React.useMemo(() => {
    let result = categories;

    // Parent Filtering
    if (parentFilter !== "all") {
      const parentId = parseInt(parentFilter);
      result = result.filter(
        (c) => c.id === parentId || c.parent_id === parentId
      );
    }

    return result;
  }, [categories, parentFilter]);

  const totalPages = Math.ceil(filteredCategories.length / perPage);
  const paginatedCategories = React.useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredCategories.slice(start, end);
  }, [filteredCategories, page, perPage]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
      >
        <PremiumStatCard
          title="Total Categories"
          value={stats.total}
          icon={FolderTree}
          color="blue"
          delay={0}
        />
        <PremiumStatCard
          title="Parent Categories"
          value={stats.parentCategories}
          icon={Folders}
          color="purple"
          delay={0.05}
        />
        <PremiumStatCard
          title="Subcategories"
          value={stats.subcategories}
          icon={GitBranch}
          color="orange"
          delay={0.1}
        />
        <div
          onClick={() =>
            setFilterType(filterType === "archived" ? "all" : "archived")
          }
          className="cursor-pointer"
        >
          <PremiumStatCard
            title="Archived Subcategories"
            value={stats.archivedSubcategories ?? 0}
            icon={Archive}
            color="red"
            delay={0.15}
          />
        </div>
        <PremiumStatCard
          title="In Navigation"
          value={stats.shownInNav}
          icon={Navigation}
          color="emerald"
          delay={0.2}
        />
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
      >
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={filterType}
            onValueChange={(value) => setFilterType(value as FilterType)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="parents">Parent Only</SelectItem>
              <SelectItem value="children">All Subcategories</SelectItem>
              <SelectItem value="active_subs">Active Subcategories</SelectItem>
              <SelectItem value="archived">
                Archived Subcategories ({stats.archivedSubcategories ?? 0})
              </SelectItem>
              <SelectItem value="in_nav">In Navigation</SelectItem>
            </SelectContent>
          </Select>

          {/* Parent Category Filter */}
          <Select
            value={parentFilter}
            onValueChange={setParentFilter}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by Parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parents</SelectItem>
              {categories
                .filter(c => c.parent_id === null)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(parent => (
                  <SelectItem key={parent.id} value={parent.id.toString()}>
                    {parent.name}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 w-full sm:w-auto items-center">
          {isBulkMode && selectedCategoryIds.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkArchive}
                disabled={isLoading}
                className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 dark:text-amber-400"
              >
                <Archive className="h-4 w-4 mr-1.5" />
                Archive Selected ({selectedCategoryIds.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkUnarchive}
                disabled={isLoading}
                className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <ArchiveRestore className="h-4 w-4 mr-1.5" />
                Unarchive Selected ({selectedCategoryIds.size})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkRemoveParent}
                disabled={isLoading}
              >
                Remove Parent ({selectedCategoryIds.size})
              </Button>
            </>
          )}

          {/* Bulk Mode Toggle */}
          <Button
            variant={isBulkMode ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedCategoryIds(new Set());
            }}
          >
            {isBulkMode ? "Exit Bulk Mode" : "Bulk Edit"}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchCategories()}
            disabled={isLoading}
            aria-label="Refresh categories"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>

          {/* Add Subcategory Button */}
          <Button
            variant="outline"
            onClick={() => handleOpenCreateSubcategory()}
            className="flex-1 sm:flex-none"
          >
            <GitBranch className="h-4 w-4 mr-2 text-primary" />
            Add Subcategory
          </Button>

          {/* Create Button */}
          <Button
            onClick={handleOpenCreateModal}
            className="flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Category
          </Button>
        </div>
      </motion.div>

      {/* Categories Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="space-y-4"
      >
        <CategoriesTable
          categories={paginatedCategories}
          isLoading={isLoading}
          onEdit={handleOpenEditModal}
          onDelete={handleDelete}
          onAddSubcategory={handleOpenCreateSubcategory}
          onArchiveCategory={(category) => setArchiveCategory(category)}
          isBulkMode={isBulkMode}
          selectedIds={selectedCategoryIds}
          onSelect={setSelectedCategoryIds}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * perPage + 1} -{" "}
              {Math.min(page * perPage, categories.length)} of{" "}
              {categories.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="w-8 h-8 p-0"
                    >
                      {p}
                    </Button>
                  )
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Modal */}
      <CategoryModal
        category={selectedCategory}
        categories={categories}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        defaultParentId={defaultParentId}
      />

      {/* Archive Category Modal */}
      <CategoryArchiveModal
        isOpen={!!archiveCategory}
        onClose={() => setArchiveCategory(null)}
        category={archiveCategory}
        onConfirm={handleArchiveCategory}
      />
    </div>
  );
}
