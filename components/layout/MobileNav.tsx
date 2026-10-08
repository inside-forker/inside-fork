"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { useScroll } from "@/lib/context/scroll-context";
import { BottomNav } from "./BottomNav";
import { PremiumSidebar } from "@/components/dashboard/PremiumSidebar";
import { FloatingActionButton } from "./FloatingActionButton";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { User } from "@supabase/supabase-js";

type NavItem = {
  id: number;
  name: string;
  slug: string;
  categories?: { id: number; name: string; slug: string }[];
};

interface ProfileShape {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  points?: number | null;
  role?: string;
  active_role?: string;
}

interface MobileNavProps {
  categoryNavItems: NavItem[];
  simpleNavLinks: NavItem[];
  user?: User | null;
  profile?: ProfileShape | null;
}

export function MobileNav({
  categoryNavItems: _categoryNavItems,
  simpleNavLinks: _simpleNavLinks,
  user: userProp,
  profile: profileProp,
}: MobileNavProps) {
  const { user: liveUser, isLoading: authLoading } = useSupabaseUser();
  // After modal login the server props stay stale until refresh — prefer live session.
  const user = authLoading
    ? userProp
    : liveUser
      ? ({ id: liveUser.id, email: liveUser.email } as User)
      : null;
  const profile = authLoading
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

  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const { isFooterInView } = useScroll();

  // New state to handle manually expanding the nav when it's collapsed
  const [isNavForcedOpen, setNavForcedOpen] = React.useState(false);

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  // If the footer is no longer in view, reset the forced open state
  React.useEffect(() => {
    if (!isFooterInView) {
      setNavForcedOpen(false);
    }
  }, [isFooterInView]);

  // Determine if the full nav should be shown
  const showFullNav = !isFooterInView || isNavForcedOpen;

  // Listen for sidebar toggle events from header avatar
  React.useEffect(() => {
    const handleOpen = () => setMenuOpen(true);
    const handleClose = () => setMenuOpen(false);
    const handleToggle = () => setMenuOpen((v) => !v);

    window.addEventListener("insidekhi:open-sidebar", handleOpen);
    window.addEventListener("insidekhi:close-sidebar", handleClose);
    window.addEventListener("insidekhi:toggle-sidebar", handleToggle);

    return () => {
      window.removeEventListener("insidekhi:open-sidebar", handleOpen);
      window.removeEventListener("insidekhi:close-sidebar", handleClose);
      window.removeEventListener("insidekhi:toggle-sidebar", handleToggle);
    };
  }, []);

  // Lock body scroll when the full-screen menu is open
  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isMenuOpen]);

  // Prevent server-side rendering of this client-only logic
  const [isClient, setIsClient] = React.useState(false);
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showFullNav ? (
          // Render the full BottomNav if the condition is met
          <BottomNav
            onMenuOpen={openMenu}
            onMenuToggle={() => setMenuOpen((v) => !v)}
            isMenuOpen={isMenuOpen}
            user={user}
            profile={profile}
          />
        ) : (
          // Otherwise, render the FloatingActionButton
          <FloatingActionButton onClick={() => setNavForcedOpen(true)} />
        )}
      </AnimatePresence>

      <PremiumSidebar
        isOpen={isMenuOpen}
        onClose={closeMenu}
        user={user}
        profile={profile}
      />

      {/* Backdrop for mobile */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={closeMenu}
        />
      )}
    </>
  );
}
