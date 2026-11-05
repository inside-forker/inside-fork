import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const variants = {
  "display-xl": "font-display text-display-xl text-balance",
  "display-lg": "font-display text-display-lg text-balance",
  "display-md": "font-display text-display-md text-balance",
  title: "font-display text-title",
} as const;

export type HeadingVariant = keyof typeof variants;

type HeadingProps = ComponentPropsWithoutRef<"h2"> & {
  as?: "h1" | "h2" | "h3" | "h4";
  variant?: HeadingVariant;
};

/**
 * Fraunces headline on the design type scale. Size carries the hierarchy, so
 * it adds no weight or colour; it inherits the colour of its Section.
 */
export function Heading({
  as: Tag = "h2",
  variant = "display-md",
  className,
  ...props
}: HeadingProps) {
  return <Tag className={cn(variants[variant], className)} {...props} />;
}
