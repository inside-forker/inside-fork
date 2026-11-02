import * as React from "react";
import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StateFrameProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}

function StateFrame({ icon: Icon, title, description, children, className, role }: StateFrameProps) {
  return (
    <div
      role={role}
      className={cn("flex flex-col items-center px-6 py-16 text-center", className)}
    >
      <span className="mb-4 grid size-12 place-items-center rounded-lg border text-foreground">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-base font-semibold">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-data text-muted-foreground">{description}</p>
      )}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export interface EmptyStateProps {
  icon: LucideIcon;
  /** What's missing, e.g. "No events yet" or "No events match “qawali”". */
  title: string;
  description?: React.ReactNode;
  /** One next step: create, import, or clear filters. */
  action?: React.ReactNode;
  className?: string;
}

/** Nothing to show. Say what's missing and offer one action. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <StateFrame icon={icon} title={title} description={description} className={className}>
      {action}
    </StateFrame>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** A failed load. Says what happened and offers a retry; the page around it stays. */
export function ErrorState({
  title = "Couldn’t load this",
  description = "The server didn’t answer in time. Try again in a moment.",
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <StateFrame
      role="alert"
      icon={AlertCircle}
      title={title}
      description={description}
      className={className}
    >
      {onRetry && (
        <Button variant="outline" onClick={onRetry} loading={retrying}>
          <RefreshCw />
          Try again
        </Button>
      )}
    </StateFrame>
  );
}
