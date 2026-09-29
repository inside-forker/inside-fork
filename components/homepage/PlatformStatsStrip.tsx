import { CalendarDays, LayoutGrid, MapPin } from "lucide-react";
import { containerClass } from "@/components/homepage/SectionHeading";
import { formatStat, getPlatformStats } from "@/lib/homepage/platform-stats";

export async function PlatformStatsStrip() {
  const stats = await getPlatformStats();

  const items = [
    { icon: MapPin, value: stats.places, label: "places listed" },
    { icon: CalendarDays, value: stats.upcomingEvents, label: "upcoming events" },
    { icon: LayoutGrid, value: stats.categories, label: "categories" },
  ].filter(
    (item): item is typeof item & { value: number } =>
      typeof item.value === "number" && item.value > 0,
  );

  // A lone number reads as filler; only show the strip when it says something.
  if (items.length < 2) return null;

  return (
    <section aria-label="Inside Karachi at a glance">
      <div className={containerClass}>
        <dl className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
          {items.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <div className="flex items-baseline gap-2">
                <dt className="order-2 text-sm text-muted-foreground">{label}</dt>
                <dd className="order-1 text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                  {formatStat(value)}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
