import * as React from "react";
import { cn } from "@/lib/utils";
import { AdminMetricBar, type AdminMetric } from "./AdminMetricBar";

type LiveState = "live" | "paused" | "offline";

const LIVE: Record<LiveState, { label: string; pill: string; dot: string }> = {
  live: {
    label: "Live",
    pill: "bg-success/10 text-success",
    dot: "bg-success animate-pulse motion-reduce:animate-none",
  },
  paused: { label: "Paused", pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  offline: { label: "Offline", pill: "bg-destructive/10 text-foreground", dot: "bg-destructive" },
};

/** Realtime status pill for pages that refresh on their own. */
export function LiveIndicator({ state }: { state: LiveState }) {
  const s = LIVE[state];
  return (
    <span
      role="status"
      className={cn("inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-medium", s.pill)}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export interface AdminPageShellProps {
  title: string;
  /** Small line above the title, usually the nav group ("Events & ticketing") or today's date. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** One solid primary action, plus secondaries before it. */
  actions?: React.ReactNode;
  live?: LiveState;
  metrics?: AdminMetric[];
  /** Tabs or a segmented control between the header and the content. */
  tabs?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Page header (eyebrow, title, description, actions), optional metrics and tabs, then the page. */
export function AdminPageShell({
  title,
  eyebrow,
  description,
  actions,
  live,
  metrics,
  tabs,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-6", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-2 text-xs font-medium text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        </div>
        {(actions || live) && (
          <div className="flex flex-wrap items-center gap-2">
            {live && <LiveIndicator state={live} />}
            {actions}
          </div>
        )}
      </header>
      {metrics && metrics.length > 0 && <AdminMetricBar metrics={metrics} />}
      {tabs}
      {children}
    </div>
  );
}
