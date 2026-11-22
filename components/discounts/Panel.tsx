"use client";

import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A white panel: a bottom sheet on phones, a centred dialog from lg. Used for
 * the deal sheet and the card wallet dialogs on /discounts.
 */
export function Panel({
  open,
  onOpenChange,
  title,
  description,
  fixedHeight = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** For screen readers; the body shows its own visible heading. */
  title: string;
  description?: string;
  /** Step flows keep one height so the panel doesn't jump between steps. */
  fixedHeight?: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 duration-base data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6">
          <Dialog.Content
            ref={contentRef}
            tabIndex={-1}
            // Focus the panel itself, not its first link, so it opens at the top.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              contentRef.current?.focus();
            }}
            className={cn(
              "pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-t-container bg-background text-foreground shadow-overlay outline-none duration-base data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-safe:data-[state=open]:slide-in-from-bottom-6 lg:w-[560px] lg:rounded-container",
              fixedHeight ? "h-[85vh] lg:h-[640px] lg:max-h-[85vh]" : "max-h-[88vh] lg:max-h-[85vh]",
            )}
          >
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
            {children}
            <Dialog.Close
              aria-label="Close"
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground outline-none transition-colors duration-fast hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The panel's visible heading row, leaving room for the close button. */
export function PanelHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 px-5 pb-3 pr-16 pt-5 lg:px-6 lg:pt-6", className)}>{children}</div>
  );
}
