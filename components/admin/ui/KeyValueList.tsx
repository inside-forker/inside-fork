import * as React from "react";
import { cn } from "@/lib/utils";

export interface KeyValueItem {
  label: string;
  value: React.ReactNode;
}

/** Read-only details as label/value pairs, two columns from md up. */
export function KeyValueList({
  items,
  columns = 2,
  className,
}: {
  items: KeyValueItem[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4", columns === 2 && "md:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm">
            {item.value ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
