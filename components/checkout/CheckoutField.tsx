"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CheckoutFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

/**
 * One labelled input, the checkout's only field shape (mirrors the app's
 * CheckoutField): the label above the box, a soft fill inside a hairline,
 * and the box turns destructive on an error.
 */
export const CheckoutField = forwardRef<HTMLInputElement, CheckoutFieldProps>(
  function CheckoutField({ label, error, id, className, ...rest }, ref) {
    const inputId = id ?? `field-${label.toLowerCase().replace(/\W+/g, "-")}`;
    return (
      <div className="flex-1 space-y-2">
        <label htmlFor={inputId} className="block text-sm font-semibold">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            "w-full rounded-lg border bg-muted px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-foreground/30",
            error ? "border-destructive" : "border-border",
            className,
          )}
          {...rest}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  },
);
