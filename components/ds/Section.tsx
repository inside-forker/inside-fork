import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const tones = {
  white: "bg-background text-foreground",
  cream: "ds-tone-cream bg-background text-foreground",
  ink: "ds-tone-ink bg-background text-foreground",
  muted: "ds-tone-muted bg-background text-foreground",
} as const;

const sizes = {
  sm: "py-12 md:py-16",
  md: "py-16 md:py-24",
  lg: "py-24 md:py-32",
  xl: "py-32 md:py-48",
} as const;

export type SectionTone = keyof typeof tones;
export type SectionSize = keyof typeof sizes;

type SectionProps = ComponentPropsWithoutRef<"section"> & {
  as?: "section" | "div" | "header" | "footer" | "aside" | "article";
  /** Full-width band colour. Cream and ink re-map the theme tokens inside. */
  tone?: SectionTone;
  /** Vertical padding. The only place section spacing is defined. */
  size?: SectionSize;
};

/** A full-width band. Put a Container inside it for the content width. */
export function Section({
  as: Tag = "section",
  tone = "white",
  size = "lg",
  className,
  ...props
}: SectionProps) {
  return (
    <Tag
      data-tone={tone}
      className={cn(tones[tone], sizes[size], className)}
      {...props}
    />
  );
}
