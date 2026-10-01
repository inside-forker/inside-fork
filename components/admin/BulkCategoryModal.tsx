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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  FolderInput,
  Plus,
  Search,
  Check,
  AlertTriangle,
  Loader2,
  FolderTree,
  Tag,
} from "lucide-react";

export type CategoryOption = {
  value: string;
  label: string;
  slug: string;
  parentId: string | null;
  iconName?: string | null;
};

export type CategoryGroup = {
  parent: CategoryOption;
  subcategories: CategoryOption[];
};

interface BulkCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  selectedIds: number[];
  categories: CategoryOption[];
  categoryGroups: CategoryGroup[];
  onSuccess: (newCategoryId: number, newCategoryName: string) => void;
}

export function BulkCategoryModal({
  isOpen,
  onClose,
  selectedCount,
  selectedIds,
  categories,
  categoryGroups,
  onSuccess,
}: BulkCategoryModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<"select" | "create">("select");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = React.useState<string>("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // New subcategory creation state
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryParentId, setNewCategoryParentId] = React.useState<string>("");
  const [newCategorySlug, setNewCategorySlug] = React.useState("");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);

  // Root/parent categories for parent picker
  const parentCategories = React.useMemo(() => {
    return categories.filter((c) => !c.parentId);
  }, [categories]);

  // Filter subcategories by search query
  const filteredGroups = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categoryGroups;

    return categoryGroups
      .map((group) => {
        const parentMatches = group.parent.label.toLowerCase().includes(q);
        const matchedSubs = group.subcategories.filter((s) =>
          s.label.toLowerCase().includes(q),
        );

        if (parentMatches) {
          return group;
        }

        if (matchedSubs.length > 0) {
          return {
            ...group,
            subcategories: matchedSubs,
          };
        }

        return null;
      })
      .filter((g): g is CategoryGroup => g !== null);
  }, [categoryGroups, searchQuery]);

  // Auto-generate slug when typing category name
  React.useEffect(() => {
    if (newCategoryName) {
      const slug = newCategoryName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setNewCategorySlug(slug);
    } else {
      setNewCategorySlug("");
    }
  }, [newCategoryName]);

  // Reset state when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedSubcategoryId("");
      setSearchQuery("");
      setNewCategoryName("");
      setNewCategoryParentId(parentCategories[0]?.value || "");
      setNewCategorySlug("");
      setActiveTab("select");
    }
  }, [isOpen, parentCategories]);

  // Handle submit for existing subcategory
  const handleMoveToExisting = async () => {
    if (!selectedSubcategoryId) {
      toast({
        title: "Selection Required",
        description: "Please choose a subcategory to move the listings to.",
        variant: "destructive",
      });
      return;
    }

    const catIdNum = Number(selectedSubcategoryId);
    const chosenCat = categories.find((c) => c.value === selectedSubcategoryId);

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          category_id: catIdNum,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to update listings category");
      }

      toast({
        title: "Listings Moved",
        description: `${selectedCount} listing(s) successfully moved to "${chosenCat?.label || "new category"}" (all previous categories replaced).`,
      });

      onSuccess(catIdNum, chosenCat?.label || "New Subcategory");
      onClose();
    } catch (err: unknown) {
      console.error("Error moving listings category:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to move listings",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle submit for creating a new subcategory and moving listings into it
  const handleCreateAndMove = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the new subcategory.",
        variant: "destructive",
      });
      return;
    }

    if (!newCategoryParentId) {
      toast({
        title: "Parent Category Required",
        description: "Please select a main category for this subcategory.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreatingCategory(true);

      // 1) Create the subcategory
      const createRes = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: newCategorySlug || trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          parent_id: Number(newCategoryParentId),
          category_type: "listing",
          show_in_nav: true,
          show_in_filters: true,
          is_enabled: true,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok || !createData.success || !createData.data?.id) {
        throw new Error(createData.error || "Failed to create new subcategory");
      }

      const createdCategoryId = Number(createData.data.id);
      const createdCategoryName = createData.data.name || trimmedName;

      // 2) Move selected listings into the newly created subcategory
      const patchRes = await fetch("/api/admin/listings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          category_id: createdCategoryId,
        }),
      });

      const patchData = await patchRes.json();
      if (!patchRes.ok || !patchData.success) {
        throw new Error(patchData.error || "Subcategory created, but failed to move listings.");
      }

      toast({
        title: "Subcategory Created & Listings Moved",
        description: `Created "${createdCategoryName}" and moved ${selectedCount} listing(s) into it.`,
      });

      onSuccess(createdCategoryId, createdCategoryName);
      onClose();
    } catch (err: unknown) {
      console.error("Error creating subcategory or moving listings:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create subcategory and move listings",
        variant: "destructive",
      });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && !isCreatingCategory && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl bg-background">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <FolderInput className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                Move Selected Listings to Subcategory
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Assign <strong className="text-foreground">{selectedCount}</strong> selected listing(s) to an existing subcategory or create a new one.
              </DialogDescription>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> All previously assigned categories and subcategories on these {selectedCount} listing(s) will be removed and replaced with the selected subcategory.
            </span>
          </div>
        </DialogHeader>

        {/* Tab Selector */}
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "select" | "create")}>
            <TabsList className="grid grid-cols-2 w-full h-10">
              <TabsTrigger value="select" className="flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Select Existing Subcategory
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                + Create New Subcategory
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Select Existing Subcategory */}
            <TabsContent value="select" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search subcategory or main category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-background"
                />
              </div>

              {/* Subcategories List */}
              <div className="max-h-[320px] overflow-y-auto border border-border/60 rounded-xl divide-y divide-border/40 p-1 bg-muted/10">
                {filteredGroups.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No matching categories found for &ldquo;{searchQuery}&rdquo;.
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.parent.value} className="p-2 space-y-1">
                      {/* Main Category Header */}
                      <div className="px-2.5 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-primary/70" />
                        {group.parent.label}
                      </div>

                      {/* Subcategories Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {group.subcategories.length > 0 ? (
                          group.subcategories.map((sub) => {
                            const isSelected = selectedSubcategoryId === sub.value;
                            return (
                              <button
                                key={sub.value}
                                type="button"
                                onClick={() => setSelectedSubcategoryId(sub.value)}
                                className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-all border ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-medium"
                                    : "bg-background/80 hover:bg-accent border-border/50 text-foreground"
                                }`}
                              >
                                <span className="truncate">{sub.label}</span>
                                {isSelected && <Check className="h-4 w-4 shrink-0" />}
                              </button>
                            );
                          })
                        ) : (
                          // Fallback to allow selecting the parent itself if no subs exist
                          <button
                            type="button"
                            onClick={() => setSelectedSubcategoryId(group.parent.value)}
                            className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg text-left transition-all border ${
                              selectedSubcategoryId === group.parent.value
                                ? "bg-primary text-primary-foreground border-primary shadow-sm font-medium"
                                : "bg-background/80 hover:bg-accent border-border/50 text-foreground"
                            }`}
                          >
                            <span className="truncate">{group.parent.label} (Main)</span>
                            {selectedSubcategoryId === group.parent.value && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Create New Subcategory */}
            <TabsContent value="create" className="mt-4 space-y-4">
              <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="parent-cat" className="text-sm font-medium">
                    Parent Category <span className="text-destructive">*</span>
                  </Label>
                  <Select value={newCategoryParentId} onValueChange={setNewCategoryParentId}>
                    <SelectTrigger id="parent-cat" className="h-10 bg-background">
                      <SelectValue placeholder="Select parent category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-cat-name" className="text-sm font-medium">
                    New Subcategory Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-cat-name"
                    placeholder="e.g. Specialty Coffee, Rooftop Lounges, Padel Courts"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="h-10 bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-cat-slug" className="text-xs text-muted-foreground">
                    URL Slug (Auto-generated)
                  </Label>
                  <Input
                    id="new-cat-slug"
                    value={newCategorySlug}
                    onChange={(e) => setNewCategorySlug(e.target.value)}
                    className="h-8 text-xs font-mono bg-muted/50 text-muted-foreground"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting || isCreatingCategory}
          >
            Cancel
          </Button>

          {activeTab === "select" ? (
            <Button
              type="button"
              onClick={handleMoveToExisting}
              disabled={isSubmitting || !selectedSubcategoryId}
              className="bg-primary hover:bg-primary/90 shadow-md font-semibold"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving {selectedCount} Listing(s)...
                </>
              ) : (
                `Move ${selectedCount} Listing(s)`
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleCreateAndMove}
              disabled={isCreatingCategory || !newCategoryName.trim() || !newCategoryParentId}
              className="bg-primary hover:bg-primary/90 shadow-md font-semibold"
            >
              {isCreatingCategory ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating & Moving...
                </>
              ) : (
                `Create & Move ${selectedCount} Listing(s)`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
