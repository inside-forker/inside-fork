"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";

interface FloatingActionButtonProps {
  onClick: () => void;
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <motion.div
      initial={{ scale: 0, y: 50, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0, y: 50, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      data-mobile-fab=""
      className="md:hidden fixed bottom-4 right-4 z-50"
    >
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="group relative w-14 h-14 rounded-2xl bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/20"
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl opacity-100 group-hover:opacity-80 transition-opacity duration-200" />

        {/* Icon container */}
        <div className="relative z-10 flex items-center justify-center w-full h-full">
          <LayoutGrid className="h-6 w-6 text-primary group-hover:text-primary/90 transition-colors duration-200" />
        </div>

        {/* Subtle pulse effect */}
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 rounded-2xl border-2 border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
      </motion.button>
    </motion.div>
  );
}
