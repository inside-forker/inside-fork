import * as React from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DiffFieldProps {
  label: string;
  /** What's live now. Pass null for a field that didn't exist (shows "Not set"). */
  before: React.ReactNode;
  /** What's proposed. */
  after: React.ReactNode;
  /** Defaults to comparing before/after when both are strings or numbers. */
  changed?: boolean;
}

/** One field of a change request: live value, arrow, proposed value. Unchanged rows recede. */
export function DiffField({ label, before, after, changed }: DiffFieldProps) {
  const isChanged =
    changed ??
    (typeof before === "string" || typeof before === "number"
      ? before !== after
      : true);
  return (
    <div
      className={cn(
        "grid gap-1 border-t py-3 text-data md:grid-cols-[theme(spacing.40)_minmax(0,1fr)_theme(spacing.6)_minmax(0,1fr)] md:items-center md:gap-3",
        !isChanged && "opacity-60",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground">
        <span className="sr-only">Live: </span>
        {before ?? "Not set"}
      </span>
      <ArrowRight aria-hidden="true" className="hidden size-3.5 text-muted-foreground md:block" />
      <span
        className={cn(
          isChanged && "-ml-2 rounded-md bg-warning/10 px-2 py-1 font-medium text-foreground",
        )}
      >
        <span className="sr-only">{isChanged ? "Proposed: " : "Unchanged: "}</span>
        {after ?? "Not set"}
      </span>
    </div>
  );
}

/** Heading for a group of DiffFields (Schedule, Tickets, Details). */
export function DiffGroup({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="flex items-center gap-2 pb-2 pt-6 text-xs font-semibold text-muted-foreground">
        {Icon && <Icon aria-hidden="true" className="size-3.5" />}
        {title}
      </h4>
      {children}
    </div>
  );
}
