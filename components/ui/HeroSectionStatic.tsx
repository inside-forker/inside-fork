import React from "react";

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
            className={`relative flex items-center justify-center overflow-hidden bg-background pt-10 pb-8 sm:pt-16 sm:pb-12 lg:pt-24 lg:pb-16 ${className}`}
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
