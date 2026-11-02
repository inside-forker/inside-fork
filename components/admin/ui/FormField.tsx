"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props FormField hands to its control so label, hint and error are announced. */
export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FormFieldProps {
  label: string;
  /** Short helper text under the control. Hidden while there's an error. */
  hint?: React.ReactNode;
  /** Error message. Say what's wrong and how to fix it. */
  error?: React.ReactNode;
  /** Adds a muted "Optional" next to the label. Required is the default, so it isn't marked. */
  optional?: boolean;
  /** Use your own id, e.g. for a Radix Select trigger. */
  id?: string;
  /**
   * One control element (Input, Textarea, SelectTrigger…), which receives id and
   * aria props. Or a function that receives them, for controls you build yourself.
   */
  children: React.ReactElement | ((control: FieldControlProps) => React.ReactNode);
  className?: string;
}

/** Label above, control, then a hint or an inline error. Works with plain state or react-hook-form. */
export function FormField({
  label,
  hint,
  error,
  optional,
  id,
  children,
  className,
}: FormFieldProps) {
  const autoId = React.useId();
  // Keep an id the control already has (callers may look it up), else generate one.
  const childId =
    typeof children === "function"
      ? undefined
      : (children.props as { id?: string }).id;
  const controlId = id ?? childId ?? autoId;
  const messageId = `${controlId}-message`;
  const message = error ?? hint;

  const control: FieldControlProps = {
    id: controlId,
    "aria-describedby": message ? messageId : undefined,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={controlId} className="flex items-baseline gap-2 text-data font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </Label>
      {typeof children === "function"
        ? children(control)
        : React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            ...control,
            className: cn(
              (children.props as { className?: string }).className,
              error && "border-destructive",
            ),
          })}
      {error ? (
        <p id={messageId} className="flex items-start gap-2 text-data text-foreground">
          <AlertCircle aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-destructive" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** A group of fields: title and description on the left, fields on the right (stacked on small screens). */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  const titleId = React.useId();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "grid gap-4 border-b pb-8 last:border-b-0 last:pb-0 md:grid-cols-[theme(spacing.44)_minmax(0,1fr)] md:gap-6",
        className,
      )}
    >
      <div>
        <h3 id={titleId} className="text-sm font-semibold">
          {title}
        </h3>
        {description && <p className="mt-1 text-data text-muted-foreground">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </section>
  );
}

export interface FormFooterProps {
  /** Left side: "Unsaved changes", "1 error to fix", "Saved 2 min ago". */
  status?: React.ReactNode;
  /** Buttons, secondary first, primary last. */
  children: React.ReactNode;
  className?: string;
}

/** Sticky action bar for forms and drawers. One primary action, on the right. */
export function FormFooter({ status, children, className }: FormFooterProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t bg-background px-6 py-3",
        className,
      )}
    >
      {status && (
        <p role="status" className="mr-auto text-data text-muted-foreground">
          {status}
        </p>
      )}
      <div className={cn("flex items-center gap-2", !status && "ml-auto")}>{children}</div>
    </div>
  );
}
