// Design-system motion tokens for framer-motion.
// Mirrors the CSS variables in app/globals.css (--ease-standard,
// --duration-fast/base/slow) and the Tailwind classes ease-standard and
// duration-fast/base/slow. Change both places together.
import type { Transition, Variants } from "framer-motion";

/** The one easing curve: cubic-bezier(0.22, 1, 0.36, 1). */
export const ease = [0.22, 1, 0.36, 1] as const;

/** Durations in seconds (framer-motion units): 150ms, 300ms, 600ms. */
export const duration = {
  fast: 0.15,
  base: 0.3,
  slow: 0.6,
} as const;

export const transition = {
  fast: { duration: duration.fast, ease },
  base: { duration: duration.base, ease },
  slow: { duration: duration.slow, ease },
} satisfies Record<keyof typeof duration, Transition>;

/** Distance a revealed element travels, in px. */
export const revealDistance = 16;

/**
 * Scroll reveal: opacity + transform only. Pair with
 * <MotionConfig reducedMotion="user"> (components/ds/Reveal does), which drops
 * the movement and keeps the fade for people who prefer reduced motion.
 * Pass a delay in seconds through framer-motion's `custom` prop.
 */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: revealDistance },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { ...transition.slow, delay },
  }),
};

/** Scroll reveals play once and never replay on scroll back. */
export const revealViewport = { once: true, amount: 0.2 } as const;
