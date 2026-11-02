"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ADMIN_OVERLAY, useReturnFocus } from "./AdminDrawer";

const MODAL_SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
} as const;

export interface AdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Buttons, secondary first, primary last. */
  footer?: React.ReactNode;
  size?: keyof typeof MODAL_SIZES;
  children?: React.ReactNode;
}

/**
 * Centered dialog for confirmations and short forms (four fields at most).
 * Anything longer belongs in an AdminDrawer.
 */
export function AdminModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "sm",
  children,
}: AdminModalProps) {
  const returnFocus = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={ADMIN_OVERLAY} />
        <DialogPrimitive.Content
          data-admin=""
          {...returnFocus}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-theme(spacing.8))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border bg-background p-6 shadow-xl outline-none",
            "duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-150",
            "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
            MODAL_SIZES[size],
          )}
        >
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold tracking-tight">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {children}
          {footer && <div className="mt-2 flex flex-wrap justify-end gap-2">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
