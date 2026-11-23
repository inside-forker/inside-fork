"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, CalendarDays, Home, Tag, User, type LucideIcon } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { transition } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ProfileShape {
  id?: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string;
}

interface BottomNavProps {
  onMenuOpen?: () => void;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
  user?: SupabaseUser | { id: string; email?: string } | null;
  profile?: ProfileShape | null;
}

type Tab = { href: string; label: string; icon: LucideIcon };

const TAB_CLASS =
  "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-label transition-colors duration-fast ease-standard active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

const tabTone = (on: boolean) => (on ? "font-semibold text-primary" : "font-medium text-muted-foreground");

/**
 * The phone menu: a white bar docked to the bottom with a hairline on top,
 * like the header. Equal tabs; the current page is pink. Sign in lives in
 * the header (Login / Join), so it has no tab here. Hidden from md, where the
 * header carries Events and Discounts.
 */
export function BottomNav({ onMenuOpen, onMenuToggle, isMenuOpen, user, profile }: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const reduceMotion = useReducedMotion();

  const tabs: Tab[] = [
    { href: "/", label: "Home", icon: Home },
    { href: "/events", label: "Events", icon: CalendarDays },
    { href: "/discounts", label: "Discounts", icon: Tag },
    ...(user ? [{ href: "/dashboard", label: "Dashboard", icon: BarChart3 }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const initial = profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase();

  return (
    <motion.nav
      data-chrome="footer"
      aria-label="Main"
      initial={reduceMotion ? false : { y: "100%" }}
      animate={{ y: 0 }}
      transition={transition.base}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-16 items-stretch">
        {tabs.map(({ href, label, icon: Icon }) => {
          const on = isActive(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn(TAB_CLASS, tabTone(on))}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
              {label}
            </Link>
          );
        })}

        {/* Profile opens the account sidebar rather than a page. */}
        <button
          type="button"
          aria-expanded={!!isMenuOpen}
          onClick={() => (onMenuToggle ? onMenuToggle() : onMenuOpen?.())}
          className={cn(TAB_CLASS, tabTone(!!isMenuOpen))}
        >
          {user ? (
            <Avatar className={cn("h-[22px] w-[22px] ring-1", isMenuOpen ? "ring-primary" : "ring-border")}>
              <AvatarImage src={profile?.avatar_url || undefined} alt="" />
              <AvatarFallback className="bg-muted text-[10px] font-semibold text-foreground">{initial}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-[22px] w-[22px]" strokeWidth={isMenuOpen ? 2.4 : 2} aria-hidden="true" />
          )}
          Profile
        </button>
      </div>
    </motion.nav>
  );
}
