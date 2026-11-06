"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSearch } from "@/hooks/useSearch";
import Image from "next/image";
import Link from "next/link";
import { NotificationBell } from "@/components/layout/notifications/NotificationBell";
import { SecurityAlertsBadge } from "@/components/admin/SecurityAlertsBadge";
import { PremiumDiscoveryPanel } from "@/components/layout/PremiumDiscoveryPanel";
import { useAuthLinks } from "@/lib/auth/return-to";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { Container, Label } from "@/components/ds";

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  active_role?: string;
}

interface HeaderUser {
  id: string;
  email?: string;
}

interface PublicHeaderProps {
  user?: HeaderUser | null;
  profile?: Profile | null;
  showDiscoveryPanel?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  lister: "Lister",
  data_entry: "Data Entry",
  organizer: "Organizer",
  business_owner: "Business Owner",
  writer: "Writer",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Quiet text action (Sign In) and the single pink action (Get Started / Join)
const quietAction = cn(
  "inline-flex min-h-11 items-center rounded-control px-3 font-ui text-small font-medium text-foreground transition-colors duration-fast ease-standard hover:bg-muted",
  focusRing,
);
const primaryAction = cn(
  "inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-ui text-small font-medium text-primary-foreground transition-colors duration-fast ease-standard hover:bg-primary/90",
  focusRing,
);

// Logo link with a 44px hit area (the shared ThemeAwareLogo link is 35px)
function HeaderLogo() {
  return (
    <Link
      href="/"
      aria-label="Inside Karachi home"
      className={cn("inline-flex min-h-11 items-center rounded-control", focusRing)}
    >
      <Image
        src="/assets/logo-black.png"
        alt=""
        width={120}
        height={40}
        className="h-auto w-auto object-contain dark:hidden"
        priority
      />
      <Image
        src="/assets/logo-white.png"
        alt=""
        width={120}
        height={40}
        className="hidden h-auto w-auto object-contain dark:block"
        priority
      />
    </Link>
  );
}

/**
 * Public site header: solid white bar with a hairline bottom border, fixed to
 * the top with no scroll animation. Same search, discovery panel, auth and
 * notification behaviour as the dashboard header (components/dashboard/
 * PremiumHeader), which /admin and /dashboard keep using.
 */
export function PublicHeader({
  user: userProp,
  profile: profileProp,
  showDiscoveryPanel = true,
}: PublicHeaderProps) {
  // Sign in / Join bring the visitor back to this page afterwards.
  const { loginHref, signupHref } = useAuthLinks();
  const { user: liveUser, isLoading: authLoading } = useSupabaseUser();
  // Modal login leaves SSR props stale — prefer the live session once resolved.
  const user = authLoading
    ? userProp
    : liveUser
      ? { id: liveUser.id, email: liveUser.email }
      : null;
  const profile: Profile | null | undefined = authLoading
    ? profileProp
    : liveUser
      ? {
          id: liveUser.id,
          full_name: liveUser.full_name,
          avatar_url: liveUser.avatar_url,
          role: liveUser.role,
          active_role: liveUser.active_role,
        }
      : null;
  const [isDiscoveryOpen, setIsDiscoveryOpen] = React.useState(false);
  const router = useRouter();

  const activeRole = profile?.active_role || profile?.role;
  const isSuperAdmin = !!user && activeRole === "super_admin";

  // The avatar opens the account sidebar (MobileNav listens for this event)
  const handleAvatarClick = () => {
    window.dispatchEvent(new CustomEvent("insidekhi:toggle-sidebar"));
  };

  // Real-time search integration
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    totalResults,
    isSearching,
    showResults,
    setShowResults,
    getResultUrl,
  } = useSearch({ limit: 12 });

  const handleSearchNavigate = (result: Parameters<typeof getResultUrl>[0]) => {
    setSearchQuery(result.name);
    setShowResults(false);
    setIsDiscoveryOpen(false);
    try {
      router.push(getResultUrl(result));
    } catch {
      window.location.href = getResultUrl(result);
    }
  };

  // Allow other components to request the header discovery panel close
  React.useEffect(() => {
    const handler = () => {
      setIsDiscoveryOpen(false);
      setShowResults(false);
    };
    window.addEventListener("insidekhi:closeDiscovery", handler as EventListener);
    return () =>
      window.removeEventListener(
        "insidekhi:closeDiscovery",
        handler as EventListener,
      );
  }, [setShowResults]);

  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "User";
  const roleLabel =
    (activeRole && ROLE_LABELS[activeRole]) || `${profile?.points || 0} XP`;

  return (
    <header
      data-chrome="header"
      className="fixed inset-x-0 top-0 z-40 h-20 border-b border-border bg-background"
    >
      <Container className="h-full">
        {/* Phones: logo left, actions right. The bottom bar is the phone menu. */}
        <div className="flex h-full items-center justify-between md:hidden">
          <HeaderLogo />

          <div className="flex items-center gap-1">
            {isSuperAdmin && <SecurityAlertsBadge />}
            {user && <NotificationBell variant="mobile" />}
            {!user && (
              <>
                <a href={loginHref} className={quietAction}>
                  <span className="sm:hidden">Login</span>
                  <span className="hidden sm:inline">Sign In</span>
                </a>
                <a href={signupHref} className={primaryAction}>
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Get Started</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Desktop: logo, search, actions */}
        <div className="hidden h-full grid-cols-3 items-center md:grid">
          <div className="flex items-center">
            <HeaderLogo />
          </div>

          <div className="flex justify-center">
            <div className="group relative w-full max-w-lg">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-fast ease-standard group-focus-within:text-foreground"
              />
              <input
                id="main-header-search"
                name="main-header-search"
                type="text"
                autoComplete="off"
                aria-label="Search Karachi"
                placeholder="Find restaurants, places, events in Karachi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                  }
                }}
                onFocus={() => {
                  if (showDiscoveryPanel) {
                    setIsDiscoveryOpen(true);
                  }
                  if (searchQuery.length >= 2) {
                    setShowResults(true);
                  }
                }}
                onBlur={(e) => {
                  const relatedTarget = e.relatedTarget as HTMLElement | null;

                  // Delay to allow clicks inside the discovery panel to register
                  setTimeout(() => {
                    const discoveryFlag = (
                      window as unknown as Record<string, unknown>
                    ).__pkDiscoveryMouseDown as boolean | undefined;
                    const active = document.activeElement;
                    const panel = document.getElementById(
                      "premium-discovery-panel",
                    );

                    const panelContainsActive = panel && panel.contains(active);
                    const panelContainsRelated =
                      panel && relatedTarget && panel.contains(relatedTarget);

                    // Prevent closing if interaction is within the panel
                    if (
                      discoveryFlag ||
                      panelContainsActive ||
                      panelContainsRelated
                    ) {
                      return;
                    }

                    setIsDiscoveryOpen(false);
                    setShowResults(false);
                  }, 200);
                }}
                className={cn(
                  "h-11 w-full rounded-control border border-border bg-background pl-11 pr-4 font-ui text-small text-foreground placeholder:text-muted-foreground",
                  "transition-colors duration-fast ease-standard hover:border-foreground/30",
                  focusRing,
                )}
              />
            </div>
          </div>

          {/* Discovery Panel - positioned relative to the full header */}
          <PremiumDiscoveryPanel
            isOpen={showDiscoveryPanel && (isDiscoveryOpen || showResults)}
            onClose={() => {
              setIsDiscoveryOpen(false);
              setShowResults(false);
            }}
            searchQuery={searchQuery}
            searchResults={searchResults}
            totalResults={totalResults}
            isSearching={isSearching}
            showSearchResults={showResults}
            onSearchSelect={handleSearchNavigate}
          />

          <div className="flex items-center justify-end gap-2">
            {isSuperAdmin && <SecurityAlertsBadge />}
            {user && <NotificationBell variant="desktop" />}

            <div aria-hidden="true" className="mx-3 h-8 w-px bg-border" />

            {user ? (
              <button
                type="button"
                onClick={handleAvatarClick}
                aria-label="Open account menu"
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-control py-1 pl-1 pr-3 text-left transition-colors duration-fast ease-standard hover:bg-muted",
                  focusRing,
                )}
              >
                <Avatar className="size-9">
                  <AvatarImage src={profile?.avatar_url || undefined} alt="" />
                  <AvatarFallback className="bg-foreground font-ui text-small font-medium text-background">
                    {profile?.full_name?.charAt(0) ||
                      user?.email?.charAt(0).toUpperCase() ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:block">
                  <span className="block font-ui text-small font-medium text-foreground">
                    {displayName}
                  </span>
                  <Label className="block">{roleLabel}</Label>
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <a href={loginHref} className={quietAction}>
                  Sign In
                </a>
                <a href={signupHref} className={primaryAction}>
                  Get Started
                </a>
              </div>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
