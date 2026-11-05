import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type LabelProps = ComponentPropsWithoutRef<"span"> & {
  as?: "span" | "p" | "time" | "dt" | "dd";
  dateTime?: string;
};

/**
 * Small mono metadata (a date, an area, a category, a count). Use it only
 * when it tells the reader something the heading does not; it is not an
 * automatic eyebrow above every heading.
 */
export function Label({ as: Tag = "span", className, ...props }: LabelProps) {
  return (
    <Tag
      className={cn("font-mono-label text-label text-muted-foreground", className)}
      {...props}
    />
  );
}
