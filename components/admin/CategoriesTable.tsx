"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pencil,
  Trash2,
  ChevronRight,
  Globe,
  Plus,
  GitBranch,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { getCategoryIcon } from "./CategoryIconSelect";
import type { CategoryWithParent } from "@/types/category.types";

interface CategoriesTableProps {
  categories: CategoryWithParent[];
  isLoading: boolean;
  onEdit: (category: CategoryWithParent) => void;
  onDelete: (category: CategoryWithParent) => Promise<void>;
  onAddSubcategory?: (parentCategory: CategoryWithParent) => void;
  onArchiveCategory?: (category: CategoryWithParent) => void;
  isBulkMode?: boolean;
  selectedIds?: Set<number>;
  onSelect?: (ids: Set<number>) => void;
}

export function CategoriesTable({
  categories,
  isLoading,
  onEdit,
  onDelete,
  onAddSubcategory,
  onArchiveCategory,
  isBulkMode = false,
  selectedIds = new Set(),
  onSelect,
}: CategoriesTableProps) {
  const [deleteCategory, setDeleteCategory] =
    React.useState<CategoryWithParent | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Sort categories: parents first (alphabetically), then children under each parent
  const sortedCategories = React.useMemo(() => {
    const parents = categories
      .filter((c) => c.parent_id === null)
      .sort((a, b) => a.name.localeCompare(b.name));

    const result: CategoryWithParent[] = [];

    parents.forEach((parent) => {
      result.push(parent);
      // Find children of this parent
      const children = categories
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      result.push(...children);
    });

    // Add orphaned children (parent_id set but parent not in list)
    const orphans = categories.filter(
      (c) => c.parent_id !== null && !parents.some((p) => p.id === c.parent_id)
    );
    result.push(...orphans.sort((a, b) => a.name.localeCompare(b.name)));

    return result;
  }, [categories]);

  const handleDeleteConfirm = async () => {
    if (!deleteCategory) return;

    setIsDeleting(true);
    try {
      await onDelete(deleteCategory);
    } finally {
      setIsDeleting(false);
      setDeleteCategory(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50 hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Slug</TableHead>
              <TableHead className="font-semibold">Parent</TableHead>
              <TableHead className="w-24 font-semibold">Type</TableHead>
              <TableHead className="w-24 font-semibold">Status</TableHead>
              <TableHead className="w-24 text-right font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="border-b border-border/30">
                <TableCell>
                  <Skeleton className="h-5 w-5 rounded" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-12" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-20 ml-auto" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 shadow-sm p-12 text-center">
        <div className="mx-auto w-fit rounded-full bg-muted/50 p-4 mb-4 ring-1 ring-border/50">
          <Globe className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No categories found</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your first category to organize your content.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-card/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50 bg-muted/30 hover:bg-muted/40 transition-colors">
              <TableHead className="w-12 font-semibold">Icon</TableHead>
              {isBulkMode && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      categories.length > 0 &&
                      categories.every((c) => selectedIds.has(c.id))
                    }
                    onCheckedChange={(checked) => {
                      if (!onSelect) return;
                      if (checked) {
                        const newIds = new Set(selectedIds);
                        categories.forEach((c) => newIds.add(c.id));
                        onSelect(newIds);
                      } else {
                        const newIds = new Set(selectedIds);
                        categories.forEach((c) => newIds.delete(c.id));
                        onSelect(newIds);
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Slug</TableHead>
              <TableHead className="font-semibold">Parent</TableHead>
              <TableHead className="w-24 font-semibold">Type</TableHead>
              <TableHead className="w-24 font-semibold text-center">Counts</TableHead>
              <TableHead className="w-32 font-semibold">Status</TableHead>
              <TableHead className="w-20 font-semibold text-center">
                Order
              </TableHead>
              <TableHead className="w-24 text-right font-semibold">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCategories.map((category) => {
              const Icon = getCategoryIcon(category.icon_name);
              const isChild = category.parent_id !== null;

              const typeColors = {
                listing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                event: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
                both: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
              };

              return (
                <TableRow
                  key={category.id}
                  className={`
                    border-b border-border/30 
                    transition-colors hover:bg-muted/50
                    ${category.is_archived ? "bg-muted/10 opacity-80" : !category.is_enabled ? "opacity-60" : ""}
                  `}
                >
                  <TableCell>
                    <div
                      className={`
                      rounded-lg p-2 w-fit
                      ${typeColors[category.category_type]}
                      ring-1 ring-current/20
                    `}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </TableCell>
                  {isBulkMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(category.id)}
                        onCheckedChange={(checked) => {
                          if (!onSelect) return;
                          const newIds = new Set(selectedIds);
                          if (checked) {
                            newIds.add(category.id);
                          } else {
                            newIds.delete(category.id);
                          }
                          onSelect(newIds);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {isChild && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                      )}
                      <span
                        className={`font-medium ${
                          isChild ? "text-muted-foreground text-sm" : ""
                        }`}
                      >
                        {category.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 rounded-md bg-muted/50 text-xs font-mono border border-border/30">
                      {category.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    {category.parent_name ? (
                      <span className="text-sm text-muted-foreground">
                        {category.parent_name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={typeColors[category.category_type]}
                    >
                      {category.category_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col gap-1 items-center text-xs">
                      {(category.category_type === "listing" ||
                        category.category_type === "both") && (
                        <>
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {category.published_listing_count ??
                              category.listing_count ??
                              0}{" "}
                            Listings
                          </span>
                          {(category.archived_listing_count ?? 0) > 0 && (
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                              {category.archived_listing_count} Archived
                            </span>
                          )}
                        </>
                      )}
                      {(category.category_type === "event" ||
                        category.category_type === "both") && (
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                          {category.event_count || 0} Events
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {category.is_archived && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40 font-medium"
                        >
                          Archived
                        </Badge>
                      )}
                      {category.show_in_nav && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        >
                          Nav
                        </Badge>
                      )}
                      {category.show_in_featured && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-500/5 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        >
                          Featured
                        </Badge>
                      )}
                      {!category.is_enabled && !category.is_archived && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-500/5 text-red-600 dark:text-red-400 border-red-500/20"
                        >
                          Disabled
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {category.display_order !== null ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-mono bg-primary/5 text-primary border-primary/20"
                      >
                        {category.display_order}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isChild && onAddSubcategory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onAddSubcategory(category)}
                          aria-label={`Add subcategory under ${category.name}`}
                          title={`Add subcategory under ${category.name}`}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      {onArchiveCategory && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onArchiveCategory(category)}
                          aria-label={
                            category.is_archived || !category.is_enabled
                              ? `Unarchive ${category.name}`
                              : `Archive ${category.name}`
                          }
                          title={
                            category.is_archived || !category.is_enabled
                              ? `Unarchive ${category.name}`
                              : `Archive ${category.name} and listings`
                          }
                          className={
                            category.is_archived || !category.is_enabled
                              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                              : "text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                          }
                        >
                          {category.is_archived || !category.is_enabled ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(category)}
                        aria-label={`Edit ${category.name}`}
                        title={`Edit ${category.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteCategory(category)}
                        aria-label={`Delete ${category.name}`}
                        title={`Delete ${category.name}`}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteCategory?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}
