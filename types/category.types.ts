import { z } from "zod";
import type { GradientStyle } from "@/lib/utils/gradientStyles";

// ============================================================================
// DATABASE TYPES
// ============================================================================

/**
 * Category type classification
 */
export type CategoryType = "listing" | "event" | "both";

/**
 * Category as stored in database
 */
export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  icon_name: string | null;
  show_in_nav: boolean;
  show_in_featured: boolean;
  show_in_filters: boolean;
  is_enabled: boolean;
  category_type: CategoryType;
  display_order: number | null;
  gradient_style: GradientStyle | null;
  created_at: string;
}

/**
 * Category with parent information for display
 */
export interface CategoryWithParent extends Category {
  parent_name: string | null;
  parent_slug: string | null;
  listing_count?: number;
  published_listing_count?: number;
  draft_listing_count?: number;
  archived_listing_count?: number;
  event_count?: number;
  is_archived?: boolean;
}

/**
 * Category tree node for hierarchical display
 */
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth: number;
}

/**
 * Category usage statistics from get_category_usage_count RPC
 */
export interface CategoryUsageStats {
  listings_count: number;
  events_count: number;
}

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Form data for creating/editing categories
 */
export interface CategoryFormData {
  name: string;
  slug: string;
  parent_id: number | null;
  icon_name: string;
  show_in_nav: boolean;
  show_in_featured: boolean;
  show_in_filters: boolean;
  is_enabled: boolean;
  category_type: CategoryType;
  display_order: number | null;
  gradient_style: GradientStyle;
}

/**
 * API response for category operations
 */
export interface CategoryApiResponse {
  success: boolean;
  data?: Category | Category[];
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Stats for categories management page
 */
export interface CategoryStats {
  total: number;
  parentCategories: number;
  subcategories: number;
  archivedSubcategories: number;
  activeSubcategories: number;
  shownInNav: number;
  featured: number;
  enabled: number;
  listingCategories: number;
  eventCategories: number;
}

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for creating a new category
 */
export const categoryCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    )
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must be less than 100 characters")
    .optional(),
  parent_id: z.number().positive().nullable().optional(),
  icon_name: z.string().min(1, "Icon name is required").optional(),
  show_in_nav: z.boolean().optional(),
  show_in_featured: z.boolean().optional(),
  show_in_filters: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  category_type: z.enum(["listing", "event", "both"]).optional(),
  display_order: z.number().int().positive().nullable().optional(),
  gradient_style: z
    .enum([
      "orange",
      "blue",
      "purple",
      "emerald",
      "red",
      "indigo",
      "amber",
      "teal",
      "pink",
      "cyan",
      "lime",
      "rose",
      "slate",
    ])
    .optional(),
});

/**
 * Schema for updating an existing category
 */
export const categoryUpdateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim()
    .optional(),
  slug: z
    .string()
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    )
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug must be less than 100 characters")
    .optional(),
  parent_id: z.number().positive().nullable().optional(),
  icon_name: z.string().min(1).optional(),
  show_in_nav: z.boolean().optional(),
  show_in_featured: z.boolean().optional(),
  show_in_filters: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  category_type: z.enum(["listing", "event", "both"]).optional(),
  display_order: z.number().int().positive().nullable().optional(),
  gradient_style: z
    .enum([
      "orange",
      "blue",
      "purple",
      "emerald",
      "red",
      "indigo",
      "amber",
      "teal",
      "pink",
      "cyan",
      "lime",
      "rose",
      "slate",
    ])
    .optional(),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// ============================================================================
// ICON CONFIGURATION
// ============================================================================

/**
 * Available icons for categories (lucide-react icon names)
 * These match the icons used across the platform
 */
export const CATEGORY_ICONS = [
  { value: "compass", label: "Compass", description: "General/Default" },
  { value: "utensils", label: "Utensils", description: "Food & Dining" },
  { value: "building", label: "Building", description: "Accommodation" },
  { value: "ticket", label: "Ticket", description: "Events" },
  { value: "newspaper", label: "Newspaper", description: "News & Guides" },
  {
    value: "heart-pulse",
    label: "Heart Pulse",
    description: "Health & Fitness",
  },
  {
    value: "graduation-cap",
    label: "Graduation Cap",
    description: "Education",
  },
  { value: "popcorn", label: "Popcorn", description: "Entertainment" },
  { value: "shopping-cart", label: "Shopping Cart", description: "Shopping" },
  { value: "map-pin", label: "Map Pin", description: "Places" },
  { value: "star", label: "Star", description: "Featured" },
  { value: "coffee", label: "Coffee", description: "Cafes" },
  { value: "music", label: "Music", description: "Music & Nightlife" },
  { value: "camera", label: "Camera", description: "Photography" },
  {
    value: "book-open",
    label: "Book Open",
    description: "Libraries & Reading",
  },
  { value: "dumbbell", label: "Dumbbell", description: "Gyms & Sports" },
  { value: "briefcase", label: "Briefcase", description: "Business Services" },
  { value: "car", label: "Car", description: "Transportation" },
  { value: "hospital", label: "Hospital", description: "Hospitals & Clinics" },
  { value: "scissors", label: "Scissors", description: "Salons & Barbers" },
  { value: "sparkles", label: "Sparkles", description: "Beauty & Spa" },
  { value: "home", label: "Home", description: "Real Estate & Housing" },
  { value: "plane", label: "Plane", description: "Travel & Tourism" },
  { value: "gamepad-2", label: "Gamepad", description: "Gaming & Arcades" },
  { value: "palette", label: "Palette", description: "Arts & Culture" },
  { value: "gift", label: "Gift", description: "Gifts & Souvenirs" },
  { value: "paw-print", label: "Paw Print", description: "Pets & Animals" },
  { value: "landmark", label: "Landmark", description: "Banks & Institutions" },
  { value: "leaf", label: "Leaf", description: "Nature & Parks" },
  { value: "wifi", label: "Wifi", description: "Internet & Services" },
] as const;

export type CategoryIconName = (typeof CATEGORY_ICONS)[number]["value"];

/**
 * Default icon for new categories
 */
export const DEFAULT_CATEGORY_ICON: CategoryIconName = "compass";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a URL-friendly slug from a category name
 */
export function generateCategorySlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a tree structure from flat categories array
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const categoryMap = new Map<number, CategoryTreeNode>();
  const rootNodes: CategoryTreeNode[] = [];

  // First pass: create nodes
  categories.forEach((category) => {
    categoryMap.set(category.id, {
      ...category,
      children: [],
      depth: 0,
    });
  });

  // Second pass: build tree
  categories.forEach((category) => {
    const node = categoryMap.get(category.id)!;
    if (category.parent_id === null) {
      rootNodes.push(node);
    } else {
      const parent = categoryMap.get(category.parent_id);
      if (parent) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootNodes.push(node);
      }
    }
  });

  // Sort: parents alphabetically, children alphabetically within parent
  const sortNodes = (nodes: CategoryTreeNode[]): CategoryTreeNode[] => {
    return nodes
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(rootNodes);
}

/**
 * Flatten a category tree back to array (for table display with hierarchy indicators)
 */
export function flattenCategoryTree(
  tree: CategoryTreeNode[]
): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];

  const traverse = (nodes: CategoryTreeNode[]) => {
    nodes.forEach((node) => {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    });
  };

  traverse(tree);
  return result;
}
