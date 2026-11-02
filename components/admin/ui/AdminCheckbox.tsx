"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin checkbox: 16px square with a 4px radius, quiet border at rest, pink when on.
 * Pass checked="indeterminate" for a partly selected group (select-all in tables).
 */
export const AdminCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "grid size-4 shrink-0 place-items-center rounded border border-foreground/25 bg-background text-primary-foreground transition-colors duration-150",
      "hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-60",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
      "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-items-center">
      {props.checked === "indeterminate" ? (
        <Minus aria-hidden="true" className="size-3" strokeWidth={3} />
      ) : (
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
AdminCheckbox.displayName = "AdminCheckbox";
