"use client";

import React, { useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import type { Event } from "@/types/events.types";

interface FeaturedEventsCarouselProps {
  items: Event[];
}

export default function FeaturedEventsCarousel({
  items,
}: FeaturedEventsCarouselProps) {
  const [viewportRef, embla] = useEmblaCarousel({
    loop: false,
    containScroll: "trimSnaps",
  });

  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const scrollPrev = React.useCallback(
    () => embla && embla.scrollPrev(),
    [embla]
  );
  const scrollNext = React.useCallback(
    () => embla && embla.scrollNext(),
    [embla]
  );

  React.useEffect(() => {
    if (!embla) return;
    const onSelect = () => {
      setCanScrollLeft(embla.canScrollPrev());
      setCanScrollRight(embla.canScrollNext());
    };
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla]);

  // Refs to slide elements and content elements for equal-height calculation
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const contentRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!items || items.length === 0) return;

    let raf = 0;
    const observers: ResizeObserver[] = [];

    const recalc = () => {
      // Compute max content height among all slides
      let max = 0;
      for (const el of contentRefs.current) {
        if (el) {
          const h = el.getBoundingClientRect().height;
          if (h > max) max = Math.ceil(h);
        }
      }

      // Apply height to slide wrappers so cards equalize
      for (const slide of slideRefs.current) {
        if (slide) {
          if (max > 0) {
            slide.style.height = `${max}px`;
          } else {
            slide.style.height = "auto";
          }
        }
      }
    };

    // Observe each content element for size changes (images, dynamic text)
    contentRefs.current.forEach((el) => {
      if (!el) return;
      const ro = new ResizeObserver(() => {
        // debounce via rAF for smoother updates
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(recalc);
      });
      ro.observe(el);
      observers.push(ro);
    });

    // Also recalc once after mount (allow layout to settle)
    raf = requestAnimationFrame(recalc);

    // Recalc on window resize
    const onWin = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    };
    window.addEventListener("resize", onWin);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("resize", onWin);
    };
  }, [items]);

  return (
    <div className="w-full relative">
      {/* Left fade */}
      <div
        className={`absolute left-0 top-0 bottom-4 w-20 z-20 pointer-events-none bg-gradient-to-r from-background md:via-background/80 md:to-transparent via-background/40 to-transparent`}
      />
      {/* Right fade */}
      <div
        className={`absolute right-0 top-0 bottom-4 w-20 z-20 pointer-events-none bg-gradient-to-l from-background md:via-background/80 md:to-transparent via-background/40 to-transparent`}
      />

      {/* Left control */}
      {canScrollLeft && (
        <button
          onClick={scrollPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
          aria-label="Scroll left"
        >
          <ArrowRight className="w-5 h-5 rotate-180 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
        </button>
      )}

      {/* Right control */}
      {canScrollRight && (
        <button
          onClick={scrollNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-background/95 backdrop-blur-md border border-border/50 rounded-full flex items-center justify-center shadow-xl hover:shadow-2xl hover:shadow-primary/20 hover:bg-background hover:scale-110 hover:border-primary/30 transition-all duration-300 group"
          aria-label="Scroll right"
        >
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-l from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm" />
        </button>
      )}

      <div className="embla overflow-hidden" ref={viewportRef}>
        <div className="embla__container flex gap-6 items-stretch py-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex-shrink-0 snap-start w-[280px] sm:w-[320px] md:w-[360px] lg:w-[420px]"
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
            >
              <div
                className="h-full"
                ref={(el) => {
                  contentRefs.current[idx] = el;
                }}
              >
                <EventCard event={item} showAnimation={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
