"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Flag,
  MapPin,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminAvatar,
  AdminPageShell,
  AdminSection,
  EmptyState,
  StatusBadge,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { PremiumFormActivityHub } from "./PremiumFormActivityHub";
import type { SuperAdminDashboardProps } from "@/types/dashboard.types";

const numFmt = new Intl.NumberFormat("en-PK");
const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface AttentionItem {
  label: string;
  detail: string;
  count?: number;
  href: string;
  icon: LucideIcon;
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  const hasCount = item.count !== undefined;
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center gap-4 border-b px-6 py-4 transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md border text-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
        </span>
        {hasCount && (
          <span
            className={cn(
              "text-xl font-semibold tabular-nums",
              item.count ? "text-primary" : "text-muted-foreground",
            )}
          >
            {numFmt.format(item.count ?? 0)}
          </span>
        )}
        <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
      </Link>
    </li>
  );
}

type ActivityEntry = {
  key: string;
  kind: "user" | "event" | "listing";
  title: string;
  detail: string;
  at: string;
  status?: string;
  avatar?: string | null;
};

const KIND_ICON: Record<ActivityEntry["kind"], LucideIcon> = {
  user: UserPlus,
  event: CalendarDays,
  listing: MapPin,
};

/** Super admin overview: platform totals, queues that need people, and the latest activity. */
export function SuperAdminDashboard({ user, profile, dashboardData }: SuperAdminDashboardProps) {
  const { statistics, recentActivity, forms } = dashboardData;
  const now = new Date();
  const firstName = profile?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there";

  const attention: AttentionItem[] = [
    {
      label: "Reviews to moderate",
      detail: `${numFmt.format(statistics.totalReviews)} reviews in total`,
      count: statistics.pendingReviews,
      href: "/admin/reviews",
      icon: Star,
    },
    {
      label: "Flagged comments",
      detail: `Reported by users · ${numFmt.format(statistics.pendingComments)} comments awaiting moderation`,
      count: statistics.flaggedComments,
      href: "/admin/reports",
      icon: Flag,
    },
    { label: "Event approvals", detail: "Organizer changes to review", href: "/admin/events/approvals", icon: ClipboardCheck },
    { label: "Listing approvals", detail: "New and edited listings", href: "/admin/listings/approvals", icon: MapPin },
  ];

  const activity: ActivityEntry[] = [
    ...(recentActivity.users ?? []).map((u) => ({
      key: `u-${u.id}`,
      kind: "user" as const,
      title: u.full_name || "New user",
      detail: `Signed up as ${u.role.replace(/_/g, " ")}`,
      at: u.created_at,
      avatar: u.avatar_url,
    })),
    ...(recentActivity.events ?? []).map((e) => ({
      key: `e-${e.id}`,
      kind: "event" as const,
      title: e.name,
      detail: "Event created",
      at: e.created_at,
      status: e.status,
    })),
    ...(recentActivity.listings ?? []).map((l) => ({
      key: `l-${l.id}`,
      kind: "listing" as const,
      title: l.name,
      detail: "Listing added",
      at: l.created_at,
      status: l.status,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  return (
    <AdminPageShell
      eyebrow={dateFmt.format(now)}
      title={`${greeting(now.getHours())}, ${firstName}`}
      description="Everything on the platform at a glance."
      actions={
        <Button variant="outline" asChild>
          <Link href="/admin/analytics">
            <BarChart3 />
            Analytics
          </Link>
        </Button>
      }
      metrics={[
        { label: "Users", value: numFmt.format(statistics.totalUsers), caption: `${numFmt.format(statistics.activeUsers)} active`, href: "/admin/users" },
        { label: "Events", value: numFmt.format(statistics.totalEvents), caption: `${numFmt.format(statistics.publishedEvents)} published`, href: "/admin/events" },
        { label: "Listings", value: numFmt.format(statistics.totalListings), caption: `${numFmt.format(statistics.activeListings)} active`, href: "/admin/listings" },
        { label: "Reviews", value: numFmt.format(statistics.totalReviews), caption: `${numFmt.format(statistics.pendingReviews)} pending`, href: "/admin/reviews" },
      ]}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <AdminSection title="Needs attention" padded={false} className="lg:col-span-2">
          <ul>
            {attention.map((item) => (
              <AttentionRow key={item.label} item={item} />
            ))}
          </ul>
        </AdminSection>

        <AdminSection title="Recent activity" description="Newest sign-ups, events and listings" padded={false} className="lg:col-span-3">
          {activity.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nothing new yet" description="New sign-ups, events and listings show up here." />
          ) : (
            <ul>
              {activity.map((entry) => {
                const Icon = KIND_ICON[entry.kind];
                return (
                  <li key={entry.key} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
                    {entry.kind === "user" ? (
                      <AdminAvatar name={entry.title} src={entry.avatar} size="lg" />
                    ) : (
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{entry.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{entry.detail}</span>
                    </span>
                    {entry.status && <StatusBadge status={entry.status} />}
                    <time dateTime={entry.at} className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.at), { addSuffix: true })}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminSection>
      </div>

      {forms && <PremiumFormActivityHub forms={forms} />}
    </AdminPageShell>
  );
}
