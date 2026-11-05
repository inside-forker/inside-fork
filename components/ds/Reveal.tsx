"use client";

import type { ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import { revealVariants, revealViewport } from "@/lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds to wait before playing, for a small stagger. */
  delay?: number;
};

/**
 * Plays a single scroll reveal (fade + 16px rise) the first time the content
 * enters the viewport. It never replays. With reduced motion the rise is
 * dropped and only the fade remains. Use one orchestrated reveal per page,
 * not one per section.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={revealViewport}
        variants={revealVariants}
        custom={delay}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
