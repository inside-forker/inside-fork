"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { karachiBackgrounds } from "@/components/auth/AuthBackground";

interface AuthImmersiveBackgroundProps {
  children: React.ReactNode;
}

/**
 * Full-bleed Karachi photography behind the auth form ("Fixed Immersive"
 * login direction). Unlike AuthBackground this uses a single directional
 * scrim tuned so text stays legible over any of the rotating shots, drops
 * the floating-dot decoration, and anchors a "Now showing" credit to the
 * bottom-right. Kept separate so signup / reset-password are untouched.
 */
export function AuthImmersiveBackground({
  children,
}: AuthImmersiveBackgroundProps) {
  const [index, setIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Rotate landmarks every 8s.
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % karachiBackgrounds.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // Preload so cross-fades don't flash.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      karachiBackgrounds.map(
        (bg) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = bg.image;
          }),
      ),
    ).finally(() => {
      if (!cancelled) setIsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const current = karachiBackgrounds[index];

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950">
      {/* Rotating photograph */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={current.image}
            alt={current.name}
            fill
            priority={index === 0}
            quality={90}
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Directional scrim: darkest at bottom-left where the form sits,
          clearing toward the top-right so the photo still breathes. */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#08060a]/90 via-[#08060a]/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#08060a]/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 min-h-screen">{children}</div>

      {/* Now showing credit + indicators (desktop only to prevent mobile overlap) */}
      {isLoaded && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="hidden md:flex absolute bottom-5 right-5 z-20 items-center gap-3 text-white/75"
        >
          <div className="text-right">
            <p className="text-[13px] font-medium leading-tight">
              {current.name}
            </p>
            <p className="font-mono-label text-[10px] uppercase tracking-[0.14em] text-white/45">
              Now showing &middot; {index + 1} / {karachiBackgrounds.length}
            </p>
          </div>
          <div className="flex gap-1.5">
            {karachiBackgrounds.map((bg, i) => (
              <button
                key={bg.id}
                type="button"
                aria-label={`Show ${bg.name}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
