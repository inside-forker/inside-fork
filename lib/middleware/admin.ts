/**
 * Admin middleware utilities
 * Provides helper functions for admin route management
 */

/**
 * Checks if the current request is for an admin route
 */
export function isAdminRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin")
  );
}

/**
 * Checks if the current request is for a staff route (lister access)
 */
export function isStaffRoute(pathname: string): boolean {
  // Staff routes for content management - listers can only access these
  return (
    // API routes for lister access
    pathname.startsWith("/api/admin/listings") ||
    pathname.startsWith("/api/admin/events") ||
    pathname.startsWith("/api/admin/reviews") ||
    pathname.startsWith("/api/admin/categories") ||
    // Page routes for lister access
    pathname === "/admin/listings" ||
    pathname === "/admin/events" ||
    pathname === "/admin/reviews" ||
    pathname === "/admin/categories" ||
    pathname.startsWith("/admin/listings/") ||
    pathname.startsWith("/admin/events/") ||
    pathname.startsWith("/admin/reviews/") ||
    pathname.startsWith("/admin/categories/")
  );
}

/**
 * Routes allowed for the limited data_entry role
 */
export function isDataEntryRoute(pathname: string): boolean {
  return (
    pathname === "/admin/listing-capacity" ||
    pathname.startsWith("/admin/listing-capacity/") ||
    pathname.startsWith("/api/admin/listing-capacity") ||
    pathname.startsWith("/api/admin/listings") ||
    pathname.startsWith("/api/admin/categories") ||
    pathname.startsWith("/api/admin/upload") ||
    pathname.startsWith("/api/categories") ||
    pathname.startsWith("/api/upload")
  );
}

/**
 * Gets the admin dashboard URL
 */
export function getAdminDashboardUrl(): string {
  return "/panel";
}

/**
 * Gets the user dashboard URL (for non-admin users)
 */
export function getUserDashboardUrl(): string {
  return "/dashboard";
}
