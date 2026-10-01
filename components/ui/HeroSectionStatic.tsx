import React from "react";
import { cn } from "@/lib/utils";

interface HeroSectionStaticProps {
    children: React.ReactNode;
    className?: string;
    floating?: React.ReactNode;
}

/**
 * Lightweight hero section wrapper without framer-motion. Solid background,
 * no decorative layers, to match the mobile app's flat home screen.
 * Uses CSS for all animations and avoids JavaScript-driven scroll effects.
 * This version is optimized for LCP as it renders immediately without
 * waiting for React hydration or motion library initialization.
 */
export function HeroSectionStatic({
    children,
    className = "",
    floating,
}: HeroSectionStaticProps) {
    return (
        <section
            className={cn(
                "relative flex items-center justify-center overflow-hidden bg-background py-10 sm:py-14 lg:py-20",
                className,
            )}
        >
            {/* Floating slot (panels/icons) */}
            {floating}

            {/* Content slot */}
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                {children}
            </div>
        </section>
    );
}

export default HeroSectionStatic;
