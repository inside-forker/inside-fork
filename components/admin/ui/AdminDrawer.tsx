"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Ink scrim, no blur. Shared with AdminModal.
export const ADMIN_OVERLAY = "bg-foreground/45";

/**
 * Radix returns focus only to its own Trigger. Admin pages open overlays from their
 * own buttons, so remember whatever had focus on open and restore it on close.
 */
export function useReturnFocus() {
  const ref = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      ref.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      if (ref.current?.isConnected) {
        event.preventDefault();
        ref.current.focus();
      }
    },
  };
}

const DRAWER_SIZES = {
  /** Inspecting a record. */
  md: "max-w-xl",
  /** Editing a record. */
  lg: "max-w-2xl",
} as const;

export interface AdminDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Leading thumbnail in the header, e.g. the event poster. */
  media?: React.ReactNode;
  /** Badges next to the description: status, featured. */
  meta?: React.ReactNode;
  /** Icon buttons left of Close, e.g. "Open public page". */
  headerActions?: React.ReactNode;
  /** Tabs row under the header (TabsList variant="underline"). */
  tabs?: React.ReactNode;
  /** Sticky footer, usually a FormFooter. */
  footer?: React.ReactNode;
  size?: keyof typeof DRAWER_SIZES;
  children: React.ReactNode;
}

/**
 * Right-side panel for inspecting or editing one record without leaving the list.
 * Radix traps focus, closes on Escape and returns focus to the trigger.
 */
export function AdminDrawer({
  open,
  onOpenChange,
  title,
  description,
  media,
  meta,
  headerActions,
  tabs,
  footer,
  size = "lg",
  children,
}: AdminDrawerProps) {
  const returnFocus = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={ADMIN_OVERLAY} />
        <DialogPrimitive.Content
          // Portals render outside the shell, so the drawer carries the admin scope itself.
          data-admin=""
          {...returnFocus}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-xl outline-none",
            "duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right data-[state=closed]:duration-150",
            "motion-reduce:data-[state=open]:slide-in-from-right-0 motion-reduce:data-[state=closed]:slide-out-to-right-0",
            DRAWER_SIZES[size],
          )}
        >
          <header className={cn("border-b px-6 pt-6 md:px-8", !tabs && "pb-6")}>
            <div className="flex items-start gap-4">
              {media && <div className="shrink-0">{media}</div>}
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="truncate text-xl font-semibold tracking-tight">
                  {title}
                </DialogPrimitive.Title>
                {(description || meta) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-data text-muted-foreground">
                    {meta}
                    {description && (
                      <DialogPrimitive.Description asChild>
                        <span>{description}</span>
                      </DialogPrimitive.Description>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {headerActions}
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close">
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </div>
            {tabs && <div className="mt-4">{tabs}</div>}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 md:px-8">{children}</div>
          {footer}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
