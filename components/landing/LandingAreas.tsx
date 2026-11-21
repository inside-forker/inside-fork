"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Container, Section } from "@/components/ds";
import type { LandingArea } from "@/lib/homepage/landing";
import { cn } from "@/lib/utils";

/** Pin spots on the schematic map, in % of its box: phones (x, y), desktop (lx, ly). */
const PINS: Record<string, { x: number; y: number; lx: number; ly: number }> = {
  Clifton: { x: 30, y: 69, lx: 32, ly: 70 },
  DHA: { x: 68, y: 72, lx: 64, ly: 73 },
  Gulshan: { x: 70, y: 25, lx: 62, ly: 23 },
  PECHS: { x: 64, y: 50, lx: 56, ly: 47 },
  "North Nazimabad": { x: 32, y: 12, lx: 26, ly: 18 },
  Bahadurabad: { x: 34, y: 37, lx: 40, ly: 36 },
};

/** A grey place label on the map that isn't a pin. */
function MapLabel({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap text-label font-semibold text-muted-foreground lg:text-data",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      {name}
    </span>
  );
}

/**
 * "Pick your side of town": a schematic Karachi map with a pin per area, and
 * the picked area's places beside it.
 */
export function LandingAreas({ areas }: { areas: LandingArea[] }) {
  const [selected, setSelected] = useState(areas[0]?.name);
  if (areas.length === 0) return null;
  const area = areas.find((a) => a.name === selected) ?? areas[0];

  return (
    <Section size="md" className="py-10" aria-labelledby="landing-areas">
      <Container>
        <div className="flex items-center gap-3 lg:mb-8 lg:gap-4">
          <Image
            src="/assets/icons/saved-places.png"
            alt=""
            width={56}
            height={56}
            className="h-10 w-10 shrink-0 rotate-[7deg] lg:h-14 lg:w-14"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="landing-areas"
              className="text-[26px] font-bold leading-8 tracking-[-0.03em] lg:text-[44px] lg:leading-[48px]"
            >
              Pick your side of town
            </h2>
            <p className="mt-1.5 hidden text-[17px] leading-[26px] lg:block">Tap an area on the map to see what&rsquo;s good there.</p>
          </div>
        </div>
        <p className="mt-1.5 text-small lg:hidden">Tap an area to see what&rsquo;s good there.</p>

        <div className="mt-3.5 flex flex-col gap-3 lg:mt-0 lg:flex-row lg:flex-wrap lg:gap-6">
          <div className="relative h-[360px] min-w-0 overflow-hidden rounded-container bg-cream lg:h-[560px] lg:flex-[7_1_560px]">
            {/* Sea and Shahrah-e-Faisal, drawn in the page colour. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full text-background"
            >
              <ellipse cx="50" cy="112" rx="72" ry="31" fill="currentColor" />
              <path
                d="M8 63 C 28 60, 42 58, 53 56 S 77 45, 104 37"
                fill="none"
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span
              aria-hidden="true"
              className="absolute left-[76%] top-[51%] hidden -translate-x-1/2 -translate-y-1/2 -rotate-[17deg] whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground lg:block"
            >
              Shahrah-e-Faisal
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-3 left-3.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:bottom-[6%] lg:left-[8%] lg:text-label"
            >
              Arabian Sea
            </span>
            <MapLabel name="Saddar" className="left-[12%] top-[52%] lg:left-[16%] lg:top-[54%]" />
            <MapLabel name="Korangi" className="left-[87%] top-[60%] lg:left-[86%] lg:top-[66%]" />
            <MapLabel name="Gulistan-e-Johar" className="left-[87%] top-[34%] hidden lg:inline-flex" />

            {areas.map((a) => {
              const pin = PINS[a.name];
              if (!pin) return null;
              const on = a.name === area.name;
              return (
                <button
                  key={a.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(a.name)}
                  style={
                    {
                      "--x": `${pin.x}%`,
                      "--y": `${pin.y}%`,
                      "--lx": `${pin.lx}%`,
                      "--ly": `${pin.ly}%`,
                    } as CSSProperties
                  }
                  className={cn(
                    "absolute left-[var(--x)] top-[var(--y)] inline-flex h-10 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full pl-[9px] pr-3 text-data font-bold transition-colors duration-fast lg:left-[var(--lx)] lg:top-[var(--ly)] lg:h-11 lg:gap-2 lg:pl-3 lg:pr-4 lg:text-[15px]",
                    on ? "z-[2] bg-primary text-primary-foreground" : "z-[1] bg-background text-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", on ? "bg-primary-foreground" : "bg-foreground")} />
                  {a.name}
                  {a.countLabel && (
                    <span className={cn("text-label font-medium lg:text-data", on ? "text-primary-foreground" : "text-muted-foreground")}>
                      {a.countLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="min-w-0 rounded-container border border-border p-4 lg:flex lg:flex-[4_1_340px] lg:flex-col lg:p-7" aria-live="polite">
            <div className="flex items-baseline gap-2 lg:gap-2.5">
              <h3 className="text-[22px] font-bold leading-7 tracking-[-0.03em] lg:text-[32px] lg:leading-[38px]">{area.name}</h3>
              {area.countLabel && (
                <span className="text-data text-muted-foreground lg:text-[15px]">{area.countLabel} places</span>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-3 lg:mt-5 lg:flex-1 lg:gap-4">
              {area.places.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="group flex items-center gap-3 lg:gap-4">
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt=""
                        width={224}
                        height={168}
                        sizes="112px"
                        className="h-[66px] w-[88px] shrink-0 rounded-media object-cover lg:h-[84px] lg:w-[112px]"
                      />
                    ) : (
                      <span className="h-[66px] w-[88px] shrink-0 rounded-media bg-muted lg:h-[84px] lg:w-[112px]" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold leading-5 group-hover:underline lg:text-[17px] lg:leading-[22px]">
                        {p.name}
                      </span>
                      {p.category && (
                        <span className="mt-0.5 block truncate text-label text-muted-foreground lg:text-small">{p.category}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href={area.href}
              className="mt-3.5 flex h-12 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90 lg:mt-6 lg:h-[52px] lg:text-body"
            >
              Explore {area.name}
            </Link>
          </div>
        </div>
      </Container>
    </Section>
  );
}
