import {
  LayoutDashboard,
  MapPin,
  Calendar,
  Heart,
  Star,
  Trophy,
  User as UserIcon,
  CreditCard,
  Settings,
  Bell,
  Home,
  Shield,
  BarChart3,
  Users,
  FileText,
  ClipboardList,
  ScanLine,
  ClipboardCheck,
  Store,
  PenSquare,
  Smartphone,
  Flag,
  Ticket,
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/auth.types";

/**
 * Single source of truth for role-based navigation.
 * PremiumSidebar renders these lists directly; DashboardQuickAccess curates
 * a subset of the same items into cards. Add/edit routes here so the
 * sidebar and dashboard quick-access grid never drift apart.
 */
export interface RoleNavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Restricts visibility to a specific role within a shared list (e.g. admin tools only super_admin should see). */
  requiredRole?: UserRole;
}

// ---- Public user (default consumer role) ----
export const publicUserNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Your personal overview" },
  { name: "Scan QR", href: "/dashboard/scan", icon: ScanLine, description: "Check in with a QR code" },
  { name: "Explore", href: "/dashboard/explore", icon: MapPin, description: "Discover places nearby" },
  { name: "My Bookings", href: "/dashboard/bookings", icon: Calendar, description: "Manage your bookings" },
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart, description: "Places you've saved" },
  { name: "Reviews", href: "/dashboard/reviews", icon: Star, description: "Reviews you've written" },
  { name: "Become a Writer", href: "/dashboard/writer/apply", icon: PenSquare, description: "Apply to write for us" },
];

export const publicUserSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Achievements", href: "/dashboard/achievements", icon: Trophy, description: "View your badges" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// ---- Business owner ----
export const businessOwnerNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard/business", icon: LayoutDashboard, description: "Your business overview" },
  { name: "My Listings", href: "/dashboard/business/listings", icon: Store, description: "Manage your listings" },
  { name: "Redeem offers", href: "/dashboard/business/redemptions", icon: Ticket, description: "Validate guest offer codes" },
  { name: "Analytics", href: "/dashboard/business/analytics", icon: BarChart3, description: "Track your performance" },
  { name: "Reviews", href: "/dashboard/business/reviews", icon: Star, description: "See customer feedback" },
  { name: "Reports", href: "/dashboard/business/reports", icon: FileText, description: "View business reports" },
];

export const businessOwnerSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// ---- Writer ----
export const writerNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard/writer", icon: LayoutDashboard, description: "Your writer overview" },
  { name: "My Posts", href: "/dashboard/writer/blogs", icon: PenSquare, description: "Manage your posts" },
];

export const writerSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// ---- Admin / Super admin (main + secondary) ----
export const adminMainNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Platform overview" },
  { name: "Scan QR", href: "/dashboard/scan", icon: ScanLine, description: "Check in with a QR code" },
];

export const adminSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// Admin Tools section — shared by admin + super_admin, some items gated to super_admin only
export const adminNavigation: RoleNavItem[] = [
  { name: "User Management", href: "/admin/users", icon: Users, description: "Manage user accounts" },
  { name: "Event Management", href: "/admin/events", icon: Calendar, description: "Manage all events" },
  { name: "Event Approvals", href: "/admin/events/approvals", icon: ClipboardCheck, description: "Review pending events" },
  { name: "Bookings", href: "/admin/bookings", icon: CreditCard, description: "View all bookings" },
  { name: "Listing Management", href: "/admin/listings", icon: MapPin, description: "Manage all listings" },
  { name: "Listing Capacity", href: "/admin/listing-capacity", icon: Store, description: "Update capacity fields" },
  { name: "Listing Approvals", href: "/admin/listings/approvals", icon: ClipboardCheck, description: "Review pending listings" },
  { name: "Review Moderation", href: "/admin/reviews", icon: Star, description: "Moderate user reviews" },
  { name: "Reported Content", href: "/admin/reports", icon: Flag, description: "Review flagged reviews & comments" },
  { name: "Form Submissions", href: "/admin/forms", icon: ClipboardList, description: "View submitted forms" },
  { name: "Blog Approvals", href: "/admin/blogs/approvals", icon: ClipboardCheck, description: "Review pending posts" },
  { name: "Writer Applications", href: "/admin/writer-applications", icon: PenSquare, description: "Review writer applicants" },
  { name: "Blog Categories", href: "/admin/blog-categories", icon: FileText, description: "Manage blog categories" },
  { name: "Gamification", href: "/admin/gamification", icon: Trophy, description: "Manage ranks & badges" },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3, description: "Platform-wide analytics" },
  { name: "Mobile Events", href: "/admin/mobile-events", icon: Smartphone, description: "Screen views & search activity" },
  { name: "Offer Redemptions", href: "/admin/redemptions", icon: Ticket, description: "Platform redemption GMV & validate codes" },
  { name: "Segments", href: "/admin/segments", icon: Layers, description: "Segment membership counts" },
  { name: "Listing Scraper", href: "/admin/listing-scraper", icon: Store, description: "Bulk-import listings", requiredRole: "super_admin" },
  { name: "Logs Management", href: "/admin/logs", icon: FileText, description: "View system logs", requiredRole: "super_admin" },
  { name: "Security Center", href: "/admin/security", icon: Shield, description: "Platform security", requiredRole: "super_admin" },
  { name: "System Settings", href: "/admin/settings", icon: Settings, description: "Global configuration", requiredRole: "super_admin" },
];

// ---- Lister ----
export const listerNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Your content overview" },
  { name: "Scan QR", href: "/dashboard/scan", icon: ScanLine, description: "Check in with a QR code" },
  { name: "Listing Management", href: "/admin/listings", icon: MapPin, description: "Manage all listings" },
  { name: "Listing Approvals", href: "/admin/listings/approvals", icon: ClipboardCheck, description: "Review pending listings" },
  { name: "Listing Capacity", href: "/admin/listing-capacity", icon: Store, description: "Update capacity fields" },
  { name: "Event Management", href: "/admin/events", icon: Calendar, description: "Manage all events" },
  { name: "Event Approvals", href: "/admin/events/approvals", icon: ClipboardCheck, description: "Review pending events" },
  { name: "Review Moderation", href: "/admin/reviews", icon: Star, description: "Moderate user reviews" },
  { name: "Reported Content", href: "/admin/reports", icon: Flag, description: "Review flagged reviews & comments" },
  { name: "Form Submissions", href: "/admin/forms", icon: ClipboardList, description: "View submitted forms" },
  { name: "Blog Approvals", href: "/admin/blogs/approvals", icon: ClipboardCheck, description: "Review pending posts" },
  { name: "Writer Applications", href: "/admin/writer-applications", icon: PenSquare, description: "Review writer applicants" },
  { name: "Blog Categories", href: "/admin/blog-categories", icon: FileText, description: "Manage blog categories" },
];

export const listerSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// ---- Data entry (single-purpose capacity tool account) ----
export const dataEntryNavigation: RoleNavItem[] = [
  { name: "Listing Capacity", href: "/admin/listing-capacity", icon: Store, description: "Update capacity fields" },
];

export const dataEntrySecondaryNavigation: RoleNavItem[] = [];

// ---- Organizer ----
export const organizerMainNavigation: RoleNavItem[] = [
  { name: "Home", href: "/", icon: Home, description: "Back to the homepage" },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Your events overview" },
  { name: "My Events", href: "/dashboard/events", icon: Calendar, description: "Manage your events" },
  { name: "Scan Tickets", href: "/dashboard/scan", icon: ScanLine, description: "Check in attendees" },
];

export const organizerSecondaryNavigation: RoleNavItem[] = [
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, description: "Stay up to date" },
  { name: "Profile", href: "/dashboard/profile", icon: UserIcon, description: "Edit your profile" },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, description: "Account preferences" },
];

// ---- Dashboard quick-access curation ----

export type QuickAccessColor = "primary" | "blue" | "green" | "amber" | "purple" | "rose";

const QUICK_ACCESS_COLOR_CYCLE: QuickAccessColor[] = [
  "blue",
  "green",
  "amber",
  "purple",
  "rose",
  "primary",
];

export interface QuickAccessItem extends RoleNavItem {
  color: QuickAccessColor;
}

function withColors(items: RoleNavItem[], max: number): QuickAccessItem[] {
  return items
    .slice(0, max)
    .map((item, index) => ({
      ...item,
      color: QUICK_ACCESS_COLOR_CYCLE[index % QUICK_ACCESS_COLOR_CYCLE.length],
    }));
}

// "Dashboard" just links to the current page and "Home" is already reachable
// from the top nav — neither is a useful shortcut card.
const NOT_A_SHORTCUT = new Set(["Home", "Dashboard"]);

/**
 * Returns the curated set of nav items to render as quick-access cards on
 * the dashboard for a given active role. Pulls from the same lists that
 * PremiumSidebar renders so the dashboard and sidebar can never disagree
 * about which routes a role can reach.
 */
export function getQuickAccessItems(
  activeRole: string | null | undefined,
  max = 6,
): QuickAccessItem[] {
  switch (activeRole) {
    case "super_admin":
    case "admin": {
      const items = adminNavigation.filter(
        (item) => !item.requiredRole || item.requiredRole === activeRole,
      );
      return withColors(items, max);
    }
    case "lister": {
      const items = listerNavigation.filter((item) => !NOT_A_SHORTCUT.has(item.name));
      return withColors(items, max);
    }
    case "organizer": {
      const items = [
        ...organizerMainNavigation.filter((item) => !NOT_A_SHORTCUT.has(item.name)),
        ...organizerSecondaryNavigation,
      ];
      return withColors(items, max);
    }
    case "business_owner": {
      const items = businessOwnerNavigation.filter((item) => !NOT_A_SHORTCUT.has(item.name));
      return withColors(items, max);
    }
    case "writer": {
      const items = [
        ...writerNavigation.filter((item) => !NOT_A_SHORTCUT.has(item.name)),
        {
          name: "New Post",
          href: "/dashboard/writer/blogs/new",
          icon: PenSquare,
          description: "Start writing a new post",
        },
        ...writerSecondaryNavigation.filter((item) => item.name === "Profile"),
      ];
      return withColors(items, max);
    }
    case "data_entry": {
      return withColors(dataEntryNavigation, max);
    }
    case "public_user":
    default: {
      const items = [
        ...publicUserNavigation.filter((item) => !NOT_A_SHORTCUT.has(item.name)),
        ...publicUserSecondaryNavigation.filter((item) => item.name === "Achievements"),
      ];
      return withColors(items, max);
    }
  }
}
