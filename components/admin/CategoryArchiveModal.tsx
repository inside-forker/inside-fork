"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Archive, ArchiveRestore, AlertTriangle, Layers, Store } from "lucide-react";
import type { CategoryWithParent } from "@/types/category.types";

interface CategoryArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryWithParent | null;
  onConfirm: (
    category: CategoryWithParent,
    archiveListings: boolean,
    action: "archive" | "unarchive"
  ) => Promise<void>;
}

export function CategoryArchiveModal({
  isOpen,
  onClose,
  category,
  onConfirm,
}: CategoryArchiveModalProps) {
  const [includeListings, setIncludeListings] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIncludeListings(true);
      setIsLoading(false);
    }
  }, [isOpen, category]);

  if (!category) return null;

  const isAlreadyArchived = category.is_archived || !category.is_enabled;
  const isParent = category.parent_id === null;
  const publishedCount = category.published_listing_count ?? category.listing_count ?? 0;
  const archivedCount = category.archived_listing_count ?? 0;

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await onConfirm(
        category,
        includeListings,
        isAlreadyArchived ? "unarchive" : "archive"
      );
      onClose();
    } catch (err) {
      console.error("Failed to archive/unarchive category:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl ${
                isAlreadyArchived
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {isAlreadyArchived ? (
                <ArchiveRestore className="h-6 w-6" />
              ) : (
                <Archive className="h-6 w-6" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isAlreadyArchived ? "Unarchive Category" : "Archive Category"}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {category.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Summary Box */}
          <div className="p-3.5 rounded-lg border border-border/60 bg-muted/30 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Category Level:
              </span>
              <Badge variant="outline">
                {isParent ? "Parent Category" : "Subcategory"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Store className="h-4 w-4" /> Published Listings:
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {publishedCount}
              </span>
            </div>
            {archivedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Archive className="h-4 w-4" /> Archived Listings:
                </span>
                <span className="font-semibold text-slate-500">
                  {archivedCount}
                </span>
              </div>
            )}
          </div>

          {!isAlreadyArchived ? (
            <>
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-xs leading-relaxed">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  {isParent ? (
                    <span>
                      Archiving <strong>{category.name}</strong> will hide this parent category and all its subcategories from the website navigation, browse pages, and mobile app.
                    </span>
                  ) : (
                    <span>
                      Archiving <strong>{category.name}</strong> will hide this subcategory from public filters, browse pages, and the mobile app.
                    </span>
                  )}
                </div>
              </div>

              {/* Archive Listings Checkbox */}
              <div className="flex items-center space-x-3 pt-2">
                <Checkbox
                  id="includeListings"
                  checked={includeListings}
                  onCheckedChange={(checked) => setIncludeListings(Boolean(checked))}
                />
                <Label
                  htmlFor="includeListings"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Also archive all {publishedCount} listings in this category {isParent ? "(and its subcategories)" : ""}
                </Label>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Unarchiving will re-enable <strong>{category.name}</strong> {isParent ? "and all its subcategories" : ""} so they can appear on the website and mobile app when listings are active.
              </p>

              {/* Restore Listings Checkbox */}
              <div className="flex items-center space-x-3 pt-2">
                <Checkbox
                  id="includeListings"
                  checked={includeListings}
                  onCheckedChange={(checked) => setIncludeListings(Boolean(checked))}
                />
                <Label
                  htmlFor="includeListings"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Also restore all {archivedCount} archived listings back to Published
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isAlreadyArchived ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={isLoading}
            className="gap-1.5"
          >
            {isAlreadyArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4" />
                {isLoading ? "Unarchiving..." : "Unarchive Category"}
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                {isLoading ? "Archiving..." : "Archive Category & Listings"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
