"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, RotateCcw } from "lucide-react";

interface FullScreenFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onApply?: () => void;
  onClear?: () => void;
  applyLabel?: string;
  clearLabel?: string;
  /** Optional CSS selector (within document) to autofocus when opened (mimics listings behaviour) */
  focusSelector?: string;
}

/**
 * Reusable full-screen filters wrapper used across listings and events.
 * Keeps header, scrollable content area, and fixed bottom action bar consistent.
 */
export function FullScreenFilters({
  isOpen,
  onClose,
  title = "Filter",
  subtitle,
  children,
  onApply,
  onClear,
  applyLabel = "Apply",
  clearLabel = "Clear",
  focusSelector,
}: FullScreenFiltersProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll while full-screen filters are open
      document.body.style.overflow = "hidden";

      // If a focus selector is provided, focus that element after a short delay
      if (focusSelector) {
        setTimeout(() => {
          const el = document.querySelector(
            focusSelector
          ) as HTMLElement | null;
          el?.focus();
        }, 100);
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, focusSelector]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 z-[60] flex flex-col bg-background"
        >
          {/* Header wrapper */}
          <div className="relative">

            <div className="relative flex items-center justify-between p-6 border-b border-border/50">
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {subtitle}
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-primary/10"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Close filters</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>

          <div className="relative border-t border-border/50 bg-background">
            <div className="p-6 flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => onClear && onClear()}
                disabled={!onClear}
                className="flex-1 h-12 rounded-xl border-border/50 hover:border-primary/50 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {clearLabel}
              </Button>

              <Button
                onClick={() => onApply && onApply()}
                className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground active:opacity-80"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {applyLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FullScreenFilters;
