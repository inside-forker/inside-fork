"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumHeadingProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  gradient?: boolean;
  className?: string;
  dense?: boolean;
  animate?: boolean;
  delay?: number;
}

interface PremiumTextProps {
  children: React.ReactNode;
  variant?: "body" | "caption" | "subtitle" | "lead";
  muted?: boolean;
  className?: string;
  animate?: boolean;
  delay?: number;
}

const headingStyles = {
  1: "text-6xl md:text-7xl font-black tracking-tight",
  2: "text-4xl md:text-5xl font-bold tracking-tight",
  3: "text-3xl md:text-4xl font-bold tracking-tight",
  4: "text-2xl md:text-3xl font-semibold tracking-tight",
  5: "text-xl md:text-2xl font-semibold tracking-tight",
  6: "text-lg md:text-xl font-semibold tracking-tight",
};

const textStyles = {
  lead: "text-xl md:text-2xl font-medium leading-relaxed",
  body: "text-base md:text-lg leading-relaxed",
  subtitle: "text-sm md:text-base font-medium leading-relaxed",
  caption: "text-xs md:text-sm leading-relaxed",
};

export function PremiumHeading({
  children,
  level = 1,
  gradient = false,
  className,
  dense = false,
  animate = true,
  delay = 0,
}: PremiumHeadingProps) {
  const Component = `h${level}` as keyof React.JSX.IntrinsicElements;

  const computedHeading =
    dense && level === 2
      ? "text-xl md:text-[40px] font-bold tracking-tight"
      : headingStyles[level];

  const content = (
    <Component
      className={cn(
        computedHeading,
        // `gradient` is accepted for compatibility but renders solid, and the
        // heading stays in Inter (font-sans) to match the mobile app.
        "text-foreground",
        className
      )}
    >
      {children}
    </Component>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.8,
        delay,
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
    >
      {content}
    </motion.div>
  );
}

export function PremiumText({
  children,
  variant = "body",
  muted = false,
  className,
  animate = true,
  delay = 0,
}: PremiumTextProps) {
  const content = (
    <p
      className={cn(
        textStyles[variant],
        muted ? "text-muted-foreground" : "text-foreground",
        "font-sans",
        className
      )}
    >
      {children}
    </p>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {content}
    </motion.div>
  );
}

interface GradientTextProps {
  children: React.ReactNode;
  gradient?: "primary" | "blue" | "purple" | "emerald" | "amber";
  className?: string;
  animate?: boolean;
  delay?: number;
}

// Solid colours: the site no longer uses gradient text (matches the app).
const gradientVariants = {
  primary: "text-primary",
  blue: "text-blue-600",
  purple: "text-purple-600",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
};

export function GradientText({
  children,
  gradient = "primary",
  className,
  animate = true,
  delay = 0,
}: GradientTextProps) {
  const content = (
    <span
      className={cn(
        "font-semibold",
        gradientVariants[gradient],
        className
      )}
    >
      {children}
    </span>
  );

  if (!animate) return content;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        type: "spring",
        stiffness: 200,
        damping: 15,
      }}
    >
      {content}
    </motion.span>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  animate?: boolean;
  delay?: number;
}

export function SectionHeader({
  title,
  subtitle,
  className,
  animate = true,
  delay = 0,
}: SectionHeaderProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <PremiumHeading
        level={2}
        animate={animate}
        delay={delay}
        className="text-foreground"
      >
        {title}
      </PremiumHeading>
      {subtitle && (
        <PremiumText
          variant="subtitle"
          muted
          animate={animate}
          delay={delay + 0.1}
        >
          {subtitle}
        </PremiumText>
      )}
    </div>
  );
}

interface MetricDisplayProps {
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  animate?: boolean;
  delay?: number;
}

export function MetricDisplay({
  value,
  label,
  trend,
  className,
  animate = true,
  delay = 0,
}: MetricDisplayProps) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, scale: 0.8 } : false}
      animate={animate ? { opacity: 1, scale: 1 } : false}
      transition={{
        duration: 0.6,
        delay,
        type: "spring",
        stiffness: 150,
        damping: 15,
      }}
      className={cn("text-center space-y-2", className)}
    >
      <div className="text-3xl md:text-4xl font-bold text-foreground">
        {value}
      </div>
      <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </div>
      {trend && (
        <div
          className={cn(
            "text-xs font-semibold",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}
        >
          {trend.isPositive ? "+" : ""}
          {trend.value}%
        </div>
      )}
    </motion.div>
  );
}
