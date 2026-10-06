import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  SectionHeading,
  containerClass,
  sectionClass,
} from "@/components/shared/SectionHeading";
import { HOMEPAGE_AREAS, areaHref } from "@/lib/homepage/areas";
import { getAreaPlaceCounts } from "@/lib/homepage/area-counts";
import { formatStat } from "@/lib/homepage/platform-stats";

/** Neighbourhood shortcuts as a full-width row of cards, each with its place count. */
export async function AreasSection() {
  const counts = await getAreaPlaceCounts(
    HOMEPAGE_AREAS.map((a) => a.label),
  );

  return (
    <section className={sectionClass}>
      <div className={containerClass}>
        <SectionHeading
          title="Explore your side of Karachi"
          subtitle="Pick an area to see what's around."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {HOMEPAGE_AREAS.map((area) => {
            const places = counts[area.label];
            return (
              <Link
                key={area.label}
                href={areaHref(area.label)}
                className="group flex items-start justify-between gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 active:opacity-80"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary sm:text-base">
                    {area.label}
                  </p>
                  {places ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatStat(places)} {places === 1 ? "place" : "places"}
                    </p>
                  ) : null}
                </div>
                <ArrowUpRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
