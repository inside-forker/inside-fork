"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { transition } from "@/lib/motion";

interface FloatingActionButtonProps {
  onClick: () => void;
}

/**
 * Stands in for the bottom bar while the footer is on screen; tapping it
 * brings the bar back. A plain white button with a hairline, like the bar.
 */
export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.base}
      data-mobile-fab=""
      className="fixed bottom-4 right-4 z-50 mb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="Show menu"
        className="grid h-14 w-14 place-items-center rounded-full border border-border bg-background shadow-overlay transition-opacity duration-fast ease-standard active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <LayoutGrid className="h-6 w-6 text-primary" aria-hidden="true" />
      </button>
    </motion.div>
  );
}
