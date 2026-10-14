import { LucideIcon } from "lucide-react";

// Core filter state interface
export interface FilterState {
  sort: string | null;
  deals: boolean;
  open_now: boolean;
  near: boolean;
  bank: string | null;
  card: string | null;
  category: string | null;
  subCategory: string | null;
  priceRange?: [number, number];
  rating?: number;
  features?: string[];
}

// Filter actions interface
export interface FilterActions {
  updateFilter: <K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) => void;
  clearFilters: () => void;
  applyFilters: () => void;
  resetToDefaults: () => void;
}

// Toggle switch types
export interface PremiumToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

// Dropdown types
export interface DropdownOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface PremiumDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: DropdownOption[];
  placeholder: string;
  loading?: boolean;
  error?: string;
  icon?: LucideIcon;
  searchable?: boolean;
  variant?: "default" | "compact";
  placement?: "auto" | "top" | "bottom";
}

// Caching interfaces
export interface FilterCache {
  categories: {
    data: DropdownOption[]; // API returns already transformed data
    timestamp: number;
    ttl: number; // 5 minutes
  };
  banks: {
    data: DropdownOption[]; // API returns already transformed data
    timestamp: number;
    ttl: number; // 10 minutes
  };
  cardVariants: {
    [bankId: string]: {
      data: DropdownOption[]; // API returns already transformed data
      timestamp: number;
      ttl: number; // 3 minutes
    };
  };
}

// Performance optimization types
export interface DebounceConfig {
  filterUpdates: number; // ms
  searchInput: number; // ms
  apiRequests: number; // ms
}

export interface LoadingStates {
  initialLoad: boolean;
  filterApply: boolean;
  cardVariants: boolean;
  categories: boolean;
}

// Error handling types
export enum FilterErrorType {
  NETWORK_ERROR = "network_error",
  VALIDATION_ERROR = "validation_error",
  CACHE_ERROR = "cache_error",
  TIMEOUT_ERROR = "timeout_error",
}

export interface ErrorHandling {
  retryAttempts: number;
  retryDelay: number;
  fallbackData?: unknown;
  userMessage: string;
  recoveryAction?: () => void;
}

// Data types (these would typically come from your database schema)
export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  icon_name?: string;
}

export interface Bank {
  id: string;
  name: string;
  logo_url?: string;
}

export interface CardVariant {
  id: string;
  bank_id: string;
  name: string;
  type: string;
  benefits?: string[];
}

export interface SortOption {
  key: string;
  label: string;
  icon_name: string;
  is_default: boolean;
}

export interface SiteSettings {
  site_title?: string;
  site_description?: string;
  search_placeholder?: string;
  filter_debounce_ms?: string;
  max_categories_display?: string;
}
