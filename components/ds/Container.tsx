import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const widths = {
  /** Reading width for long text (about 65 characters per line). */
  prose: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-screen-2xl",
} as const;

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  width?: keyof typeof widths;
};

/** Centred content column with the site gutters (16px on phones). */
export function Container({
  width = "default",
  className,
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[width], className)}
      {...props}
    />
  );
}
