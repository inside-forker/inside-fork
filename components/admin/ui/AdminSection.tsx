import * as React from "react";
import { cn } from "@/lib/utils";

export interface AdminSectionProps {
  title: string;
  description?: string;
  /** Right side of the header: a link, a segmented control, a button. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Pad the body. Off for tables and lists that run edge to edge. Default true. */
  padded?: boolean;
  className?: string;
}

/** A white panel with a titled header. Replaces Card in admin; never nest one in another. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  padded = true,
  className,
}: AdminSectionProps) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn("min-w-0 overflow-hidden rounded-lg border bg-card", className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-6 py-4">
        <h2 id={titleId} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="text-data text-muted-foreground">{description}</p>}
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(padded && "p-6")}>{children}</div>
    </section>
  );
}
