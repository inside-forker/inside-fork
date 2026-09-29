"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { CategoryIconSelect } from "./CategoryIconSelect";
import {
  type CategoryWithParent,
  type CategoryFormData,
  generateCategorySlug,
  DEFAULT_CATEGORY_ICON,
} from "@/types/category.types";
import {
  getGradientOptions,
  getCategoryGradient,
} from "@/lib/utils/gradientStyles";

interface CategoryModalProps {
  category: CategoryWithParent | null;
  categories: CategoryWithParent[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<void>;
  defaultParentId?: number | null;
}

export function CategoryModal({
  category,
  categories,
  isOpen,
  onClose,
  onSave,
  defaultParentId = null,
}: CategoryModalProps) {
  const [formData, setFormData] = React.useState<CategoryFormData>({
    name: "",
    slug: "",
    parent_id: defaultParentId ?? null,
    icon_name: DEFAULT_CATEGORY_ICON,
    show_in_nav: false,
    show_in_featured: false,
    show_in_filters: true,
    is_enabled: true,
    category_type: "listing",
    display_order: null,
    gradient_style: "slate",
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { toast } = useToast();

  const isEditing = !!category;

  // Prevent layout shift when modal opens (Radix scroll-lock fix)
  React.useEffect(() => {
    if (isOpen) {
      const body = document.body;
      const removeScrollLock = () => {
        body.removeAttribute("data-scroll-locked");
        body.style.marginRight = "";
        body.style.paddingRight = "";
        body.style.overflow = "";
      };

      // Remove immediately and set up observer to catch any future additions
      removeScrollLock();

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "data-scroll-locked" &&
            body.hasAttribute("data-scroll-locked")
          ) {
            removeScrollLock();
          }
        });
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
  }, [isOpen]);

  // Initialize form data when modal opens or category changes
  React.useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          name: category.name,
          slug: category.slug,
          parent_id: category.parent_id,
          icon_name: category.icon_name || DEFAULT_CATEGORY_ICON,
          show_in_nav: category.show_in_nav,
          show_in_featured: category.show_in_featured,
          show_in_filters: category.show_in_filters,
          is_enabled: category.is_enabled,
          category_type: category.category_type,
          display_order: category.display_order,
          gradient_style: category.gradient_style || "slate",
        });
        setSlugManuallyEdited(true); // Preserve existing slug
      } else {
        setFormData({
          name: "",
          slug: "",
          parent_id: defaultParentId ?? null,
          icon_name: DEFAULT_CATEGORY_ICON,
          show_in_nav: false,
          show_in_featured: false,
          show_in_filters: true,
          is_enabled: true,
          category_type: "listing",
          display_order: null,
          gradient_style: "slate",
        });
        setSlugManuallyEdited(false);
      }
      setErrors({});
    }
  }, [isOpen, category, defaultParentId]);

  // Auto-generate slug from name if not manually edited
  React.useEffect(() => {
    if (!slugManuallyEdited && formData.name) {
      setFormData((prev) => ({
        ...prev,
        slug: generateCategorySlug(prev.name),
      }));
    }
  }, [formData.name, slugManuallyEdited]);

  // Get available parent categories (exclude self and children if editing)
  const availableParents = React.useMemo(() => {
    // Only show root categories (those without parents) as potential parents
    let parents = categories.filter((c) => c.parent_id === null);

    // If editing, exclude the current category
    if (category) {
      parents = parents.filter((c) => c.id !== category.id);
    }

    return parents;
  }, [categories, category]);

  const isSubcategory = formData.parent_id !== null;
  const parentCategoryObj = categories.find((c) => c.id === formData.parent_id);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!formData.slug.trim()) {
      newErrors.slug = "Slug is required";
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug =
        "Slug must contain only lowercase letters, numbers, and hyphens";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave(formData);
      toast({
        title: "Success",
        description: `${
          isSubcategory ? "Subcategory" : "Category"
        } ${isEditing ? "updated" : "created"} successfully`,
      });
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save category";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: "" }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData((prev) => ({ ...prev, slug: value }));
    setSlugManuallyEdited(true);
    if (errors.slug) {
      setErrors((prev) => ({ ...prev, slug: "" }));
    }
  };

  const handleParentChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      parent_id: value === "none" ? null : parseInt(value),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>
            {isEditing
              ? isSubcategory
                ? "Edit Subcategory"
                : "Edit Category"
              : isSubcategory
                ? `Create Subcategory${parentCategoryObj ? ` under "${parentCategoryObj.name}"` : ""}`
                : "Create Category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the category details below."
              : isSubcategory
                ? "Add a new subcategory to organize listings and events under this parent category."
                : "Add a new top-level category or select a parent category to create a subcategory."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleNameChange}
                placeholder="e.g., Food & Drink"
                disabled={isLoading}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p id="name-error" className="text-sm text-red-500">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Slug Field */}
            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={handleSlugChange}
                placeholder="e.g., food-and-drink"
                disabled={isLoading}
                aria-describedby={errors.slug ? "slug-error" : "slug-hint"}
                className={`font-mono text-sm ${
                  errors.slug ? "border-red-500" : ""
                }`}
              />
              {errors.slug ? (
                <p id="slug-error" className="text-sm text-red-500">
                  {errors.slug}
                </p>
              ) : (
                <p id="slug-hint" className="text-xs text-muted-foreground">
                  URL-friendly identifier. Auto-generated from name.
                </p>
              )}
            </div>

            {/* Parent Category Field */}
            <div className="space-y-2">
              <Label htmlFor="parent">Parent Category</Label>
              <Select
                value={formData.parent_id?.toString() || "none"}
                onValueChange={handleParentChange}
                disabled={isLoading}
              >
                <SelectTrigger id="parent" aria-label="Select parent category">
                  <SelectValue placeholder="Select a parent category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">
                      None (Root Category)
                    </span>
                  </SelectItem>
                  {availableParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id.toString()}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to create a top-level category.
              </p>
            </div>

            {/* Icon Field */}
            <CategoryIconSelect
              value={formData.icon_name}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, icon_name: value }))
              }
              disabled={isLoading}
            />

            {/* Show in Navigation Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-in-nav">Show in Navigation</Label>
                <p className="text-xs text-muted-foreground">
                  Display this category in the main site navigation.
                </p>
              </div>
              <Switch
                id="show-in-nav"
                checked={formData.show_in_nav}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, show_in_nav: checked }))
                }
                disabled={isLoading}
                aria-label="Toggle show in navigation"
              />
            </div>

            {/* Show in Featured Section Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-in-featured">Show in Featured</Label>
                <p className="text-xs text-muted-foreground">
                  Display this category in the homepage featured section.
                </p>
              </div>
              <Switch
                id="show-in-featured"
                checked={formData.show_in_featured}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    show_in_featured: checked,
                  }))
                }
                disabled={isLoading}
                aria-label="Toggle show in featured"
              />
            </div>

            {/* Show in Filters Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-in-filters">Show in Filters</Label>
                <p className="text-xs text-muted-foreground">
                  Display this category in search and filter dropdowns.
                </p>
              </div>
              <Switch
                id="show-in-filters"
                checked={formData.show_in_filters}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, show_in_filters: checked }))
                }
                disabled={isLoading}
                aria-label="Toggle show in filters"
              />
            </div>

            {/* Is Enabled Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is-enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Global enable/disable switch. Disabled categories hidden
                  everywhere.
                </p>
              </div>
              <Switch
                id="is-enabled"
                checked={formData.is_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_enabled: checked }))
                }
                disabled={isLoading}
                aria-label="Toggle enabled"
              />
            </div>

            {/* Category Type Select */}
            <div className="space-y-2">
              <Label htmlFor="category-type">Category Type</Label>
              <Select
                value={formData.category_type}
                onValueChange={(value: "listing" | "event" | "both") =>
                  setFormData((prev) => ({ ...prev, category_type: value }))
                }
                disabled={isLoading}
              >
                <SelectTrigger
                  id="category-type"
                  aria-label="Select category type"
                >
                  <SelectValue placeholder="Select category type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listing">
                    Listings (Venues/Businesses)
                  </SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                  <SelectItem value="both">Both (Listings & Events)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determines where this category can be used.
              </p>
            </div>

            {/* Display Order Field */}
            <div className="space-y-2">
              <Label htmlFor="display-order">Display Order (Optional)</Label>
              <Input
                id="display-order"
                type="number"
                min="1"
                value={formData.display_order ?? ""}
                onChange={(e) => {
                  const value = e.target.value
                    ? parseInt(e.target.value)
                    : null;
                  setFormData((prev) => ({ ...prev, display_order: value }));
                }}
                placeholder="e.g., 10, 20, 30"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Custom sort order for featured section (lower numbers appear
                first).
              </p>
            </div>

            {/* Gradient Style Field */}
            <div className="space-y-2">
              <Label htmlFor="gradient-style">Gradient Style</Label>
              <Select
                value={formData.gradient_style}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    gradient_style: value as typeof formData.gradient_style,
                  }))
                }
                disabled={isLoading}
              >
                <SelectTrigger id="gradient-style">
                  <SelectValue placeholder="Select gradient style" />
                </SelectTrigger>
                <SelectContent>
                  {getGradientOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full bg-gradient-to-r ${option.colors.bg} border ${option.colors.border}`}
                        />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Visual gradient for featured categories section.
              </p>
              {/* Gradient Preview */}
              {formData.gradient_style && (
                <div
                  className={`mt-2 p-4 rounded-lg bg-gradient-to-br ${
                    getCategoryGradient(formData.gradient_style).bg
                  } border ${
                    getCategoryGradient(formData.gradient_style).border
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      getCategoryGradient(formData.gradient_style).icon
                    }`}
                  >
                    Preview: {formData.name || "Category Name"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 shrink-0 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Category" : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
