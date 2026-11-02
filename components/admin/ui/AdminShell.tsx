"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ChevronDown,
  ChevronsUpDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notifications/NotificationBell";
import { SecurityAlertsBadge } from "@/components/admin/SecurityAlertsBadge";
import { useRole } from "@/lib/context/RoleContext";
import { useCity } from "@/lib/context/city-context";
import {
  ADMIN_NAV_GROUPS,
  adminMainNavigation,
  adminNavigation,
  adminSecondaryNavigation,
  dataEntryNavigation,
  dataEntrySecondaryNavigation,
  listerNavigation,
  listerSecondaryNavigation,
  type RoleNavItem,
} from "@/lib/navigation/role-navigation";
import type { UserRole } from "@/types/auth.types";
import { cn } from "@/lib/utils";
import { AdminAvatar } from "./AdminAvatar";
import { ADMIN_OVERLAY, useReturnFocus } from "./AdminDrawer";

export interface AdminShellProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  active_role?: string;
}

export interface AdminShellProps {
  user: { id: string; email?: string };
  profile: AdminShellProfile | null;
  /** Pending counts for queue links, keyed by href (e.g. "/admin/events/approvals": 3). */
  counts?: Partial<Record<string, number>>;
  children: React.ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string | null;
  links: NavLink[];
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  lister: "Lister",
  data_entry: "Data entry",
};

/** The links this role may see. Same rules as the previous sidebar (role lists, requiredRole, requiredEmail). */
function allowedItems(activeRole: string, email: string | undefined): RoleNavItem[] {
  if (activeRole === "admin" || activeRole === "super_admin") {
    const emailNorm = (email ?? "").trim().toLowerCase();
    const tools = adminNavigation.filter((item) => {
      if (item.requiredRole === "super_admin" && activeRole !== "super_admin") return false;
      if (item.requiredEmail && item.requiredEmail.trim().toLowerCase() !== emailNorm) return false;
      return true;
    });
    return [...adminMainNavigation, ...tools];
  }
  if (activeRole === "lister") return listerNavigation;
  if (activeRole === "data_entry") return dataEntryNavigation;
  return [];
}

function secondaryItems(activeRole: string): RoleNavItem[] {
  if (activeRole === "admin" || activeRole === "super_admin") return adminSecondaryNavigation;
  if (activeRole === "lister") return listerSecondaryNavigation;
  if (activeRole === "data_entry") return dataEntrySecondaryNavigation;
  return [];
}

/** Groups allowed links per ADMIN_NAV_GROUPS. Anything allowed but ungrouped lands in "More". */
function buildSections(items: RoleNavItem[]): NavSection[] {
  const byHref = new Map(items.map((i) => [i.href, i]));
  const placed = new Set<string>();
  const sections: NavSection[] = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.label,
    links: group.items.flatMap((g) => {
      if (g.href === "/dashboard") {
        placed.add(g.href);
        return [{ href: g.href, label: g.label, icon: LayoutDashboard }];
      }
      const item = byHref.get(g.href);
      if (!item) return [];
      placed.add(g.href);
      return [{ href: g.href, label: g.label, icon: item.icon }];
    }),
  }));
  const rest = items.filter((i) => !placed.has(i.href));
  if (rest.length) sections.push({ label: "More", links: rest.map((i) => ({ href: i.href, label: i.name, icon: i.icon })) });
  return sections.filter((s) => s.links.length > 0);
}

/** Longest matching href wins, so /admin/events/approvals beats /admin/events. */
function activeHref(pathname: string, links: NavLink[]) {
  let best = "";
  for (const { href } of links) {
    const hit = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
    if (hit && href.length > best.length) best = href;
  }
  return best;
}

// Mirrors PremiumSidebar's sign-out so both shells behave the same.
async function signOut() {
  try {
    const { clearParchiChannel } = await import("@/lib/parchi/prefill");
    clearParchiChannel();
    await Promise.race([
      fetch("/api/auth/logout", { method: "POST" }),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  } catch (err) {
    console.error("[SignOut] admin shell signOut error:", err);
  } finally {
    window.location.href = "/";
  }
}

function SidebarNav({
  sections,
  current,
  counts,
  onNavigate,
}: {
  sections: NavSection[];
  current: string;
  counts?: AdminShellProps["counts"];
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.label ?? "top"}>
          {section.label && (
            <p className="mb-1 px-3 text-xs font-medium text-background/50">{section.label}</p>
          )}
          <ul className="flex flex-col gap-1">
            {section.links.map((link) => {
              const on = link.href === current;
              const count = counts?.[link.href];
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "relative flex h-8 items-center gap-3 rounded-md px-3 text-data transition-colors duration-150",
                      on
                        ? "bg-background/10 font-medium text-background before:absolute before:-left-3 before:inset-y-2 before:w-0.5 before:rounded-r before:bg-primary"
                        : "text-background/70 hover:bg-background/5 hover:text-background",
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("size-4 shrink-0", !on && "opacity-70")} />
                    <span className="truncate">{link.label}</span>
                    {count ? (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary/15 px-2 text-xs font-semibold tabular-nums text-primary">
                        {count}
                        <span className="sr-only"> waiting</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function CitySwitcher() {
  const { activeCity, cities, setActiveCity } = useCity();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md border border-background/15 px-3 text-data text-background hover:bg-background/5"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          <span className="sr-only">City: </span>
          {activeCity.name}
          <ChevronDown aria-hidden="true" className="ml-auto size-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-admin="" align="start" className="w-52">
        {cities.map((city) => (
          <DropdownMenuItem key={city.slug} onSelect={() => setActiveCity(city)}>
            {city.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ user, profile, activeRole }: { user: AdminShellProps["user"]; profile: AdminShellProfile | null; activeRole: string }) {
  const { user: roleUser, switchRole } = useRole();
  const [switching, setSwitching] = React.useState(false);
  const name = profile?.full_name || user.email || "Account";

  const toPersonal = async () => {
    setSwitching(true);
    try {
      await switchRole("public_user" as UserRole);
      window.location.reload();
    } catch (error) {
      console.error("Role switch error:", error);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-background/5"
        >
          <AdminAvatar name={name} src={profile?.avatar_url} size="lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-data font-medium text-background">{name}</span>
            <span className="block truncate text-xs text-background/60">{ROLE_LABEL[activeRole] ?? activeRole}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 text-background/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-admin="" side="top" align="start" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        {secondaryItems(activeRole).map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="gap-2">
              <item.icon aria-hidden="true" className="size-4" />
              {item.name}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem asChild>
          <Link href="/" className="gap-2">
            <Globe aria-hidden="true" className="size-4" />
            View site
          </Link>
        </DropdownMenuItem>
        {roleUser?.canSwitchRoles && (
          <DropdownMenuItem disabled={switching} onSelect={toPersonal} className="gap-2">
            <UserRound aria-hidden="true" className="size-4" />
            {switching ? "Switching…" : "Switch to personal"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="gap-2">
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarBody(props: {
  sections: NavSection[];
  current: string;
  counts?: AdminShellProps["counts"];
  user: AdminShellProps["user"];
  profile: AdminShellProfile | null;
  activeRole: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 bg-foreground px-3 pb-3 pt-5 text-background/70">
      <Link href="/dashboard" onClick={props.onNavigate} className="flex h-7 items-center gap-3 px-2">
        <Image src="/logo-white.png" alt="Inside" width={75} height={20} className="h-5 w-auto" priority />
        <span className="border-l border-background/15 pl-3 text-xs font-medium text-background/60">Admin</span>
      </Link>
      <CitySwitcher />
      <div className="-mx-3 min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        <SidebarNav sections={props.sections} current={props.current} counts={props.counts} onNavigate={props.onNavigate} />
      </div>
      <div className="border-t border-background/10 pt-3">
        <UserMenu user={props.user} profile={props.profile} activeRole={props.activeRole} />
      </div>
    </div>
  );
}

function CommandPalette({ sections }: { sections: NavSection[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const returnFocus = useReturnFocus();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex h-9 w-full max-w-xs items-center gap-2 rounded-md border bg-background px-3 text-data text-muted-foreground hover:border-foreground/20"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="flex-1 text-left">Go to a page</span>
          <kbd className="hidden rounded border bg-muted px-2 font-sans text-xs sm:inline">⌘K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPortal>
        <DialogOverlay className={ADMIN_OVERLAY} />
        <DialogPrimitive.Content
          data-admin=""
          {...returnFocus}
          className="fixed left-1/2 top-24 z-50 w-[calc(100%-theme(spacing.8))] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border bg-popover shadow-xl outline-none duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogPrimitive.Title className="sr-only">Go to a page</DialogPrimitive.Title>
          <Command>
            <CommandInput placeholder="Go to a page…" />
            <CommandList className="max-h-80">
              <CommandEmpty>No admin page matches that.</CommandEmpty>
              {sections.map((section) => (
                <CommandGroup key={section.label ?? "top"} heading={section.label ?? undefined}>
                  {section.links.map((link) => (
                    <CommandItem
                      key={link.href}
                      value={`${section.label ?? ""} ${link.label}`}
                      onSelect={() => {
                        setOpen(false);
                        router.push(link.href);
                      }}
                      className="gap-2"
                    >
                      <link.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                      {link.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

/**
 * Admin chrome: ink sidebar with grouped navigation, top bar with breadcrumbs,
 * page search and notifications. Carries data-admin for the admin style scope.
 */
export function AdminShell({ user, profile, counts, children }: AdminShellProps) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const activeRole = profile?.active_role || profile?.role || "public_user";

  const sections = React.useMemo(() => buildSections(allowedItems(activeRole, user.email)), [activeRole, user.email]);
  const links = sections.flatMap((s) => s.links);
  const current = activeHref(pathname, links);
  const currentSection = sections.find((s) => s.links.some((l) => l.href === current));
  const currentLink = links.find((l) => l.href === current);

  const sidebarProps = { sections, current, counts, user, profile, activeRole };

  return (
    <div data-admin="" className="min-h-dvh bg-muted/50 lg:grid lg:grid-cols-[theme(spacing.60)_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh lg:block">
        <SidebarBody {...sidebarProps} />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPortal>
          <DialogOverlay className={ADMIN_OVERLAY} />
          <DialogPrimitive.Content
            data-admin=""
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-full outline-none duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left motion-reduce:data-[state=open]:slide-in-from-left-0"
          >
            <DialogPrimitive.Title className="sr-only">Admin navigation</DialogPrimitive.Title>
            <SidebarBody {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-col [--admin-sticky-top:theme(spacing.14)]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-data text-muted-foreground sm:flex">
            {currentSection?.label && (
              <>
                <span className="truncate">{currentSection.label}</span>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span aria-current="page" className="truncate font-medium text-foreground">
              {currentLink?.label ?? "Admin"}
            </span>
          </nav>
          <div className="ml-auto flex flex-1 items-center justify-end gap-2">
            <CommandPalette sections={sections} />
            {activeRole === "super_admin" && <SecurityAlertsBadge />}
            <NotificationBell variant="desktop" />
          </div>
        </header>
        {/* The root ConditionalLayout already provides <main> for admin routes. */}
        <div id="admin-main" className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
