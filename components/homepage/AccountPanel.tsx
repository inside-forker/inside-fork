"use client";

import Link from "next/link";
import { ArrowRight, Compass, Heart, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/context/RoleContext";

const memberLinks = [
  { icon: Heart, label: "Saved places", href: "/dashboard/favorites" },
  { icon: Ticket, label: "Your tickets", href: "/dashboard/bookings" },
  { icon: Compass, label: "Continue exploring", href: "/listings" },
];

/**
 * Signed-in visitors get shortcuts back to their own things; guests get one
 * reason to sign up. Nothing renders until the session is known, so a member
 * never sees the sign-up pitch flash first.
 */
export function AccountPanel() {
  const { user, isLoading } = useRole();

  if (isLoading) return null;

  if (user) {
    return (
      <nav aria-label="Your account" className="grid gap-3 sm:grid-cols-3">
        {memberLinks.map(({ icon: Icon, label, href }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 active:opacity-80"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary"
              aria-hidden
            />
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="text-base font-bold tracking-tight text-foreground">
          Keep the places you like
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A free account saves places, keeps your tickets in one place and
          earns you XP.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button asChild className="rounded-xl font-semibold active:opacity-80">
          <Link href="/signup">Sign up free</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl font-semibold active:opacity-80">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
