"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Search } from "lucide-react";
import { EventBannerCard } from "@/components/events/EventBannerCard";
import { FilterMenu } from "@/components/events/list/FilterMenu";
import type { EventListItem } from "@/lib/events/list";
import type { KarachiToday } from "@/lib/events/datetime";
import {
  NO_FILTERS,
  PRICE_OPTIONS,
  WHEN_OPTIONS,
  filtersToQuery,
  matchesFilters,
  type EventFilters,
  type FilterDimension,
  type FilterOption,
} from "@/lib/events/list-filters";

interface Menu {
  dimension: FilterDimension;
  title: string;
  anyLabel: string;
  options: readonly FilterOption[];
  align: "start" | "end";
}

/**
 * /events: the search, the filter pills and the banner wall. Phones stack
 * the banners; from lg they sit in justified rows (each banner grows by its
 * aspect ratio, so a row shares one height and nothing is cropped).
 */
export function EventsBrowser({
  items,
  areas,
  types,
  today,
  initialFilters,
}: {
  items: EventListItem[];
  areas: FilterOption[];
  types: FilterOption[];
  today: KarachiToday;
  initialFilters: EventFilters;
}) {
  const [filters, setFilters] = useState<EventFilters>(initialFilters);
  const update = (patch: Partial<EventFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clear = () => setFilters(NO_FILTERS);

  // Keep the URL in step so a filtered list can be shared or reloaded.
  useEffect(() => {
    const next = `${window.location.pathname}${filtersToQuery(filters)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [filters]);

  const visible = useMemo(
    () => items.filter((item) => matchesFilters(item, filters, today)),
    [items, filters, today],
  );

  const menus: Menu[] = [
    { dimension: "when", title: "Date", anyLabel: "Any day", options: WHEN_OPTIONS, align: "start" },
    { dimension: "area", title: "Area", anyLabel: "All areas", options: areas, align: "start" },
    // Type shows once events carry a category.
    ...(types.length > 0
      ? [{ dimension: "type", title: "Type", anyLabel: "All types", options: types, align: "end" } as Menu]
      : []),
    { dimension: "price", title: "Price", anyLabel: "Any price", options: PRICE_OPTIONS, align: "end" },
  ];

  const count = (dimension: FilterDimension, value: string | null) =>
    items.filter((item) => matchesFilters(item, { ...filters, [dimension]: value }, today)).length;

  const filtered = Boolean(filters.search.trim() || filters.when || filters.area || filters.type || filters.price);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 pb-12 pt-4 lg:px-8 lg:pb-16 lg:pt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 lg:gap-x-4">
        <h1 className="order-1 text-[22px] font-bold leading-7 tracking-[-0.02em] lg:text-3xl lg:leading-9">
          <span className="lg:hidden">Events</span>
          <span className="hidden lg:inline">Events in Karachi</span>
        </h1>

        <label className="relative order-2 min-w-0 flex-1 lg:order-3 lg:ml-auto lg:w-[300px] lg:flex-none">
          <span className="sr-only">Search events</span>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search events"
            className="h-10 w-full rounded-full bg-muted pl-10 pr-4 text-small text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary lg:h-[42px]"
          />
        </label>

        <div role="group" aria-label="Filter events" className="order-3 flex w-full flex-wrap gap-2 lg:order-2 lg:ml-4 lg:w-auto">
          {menus.map((menu) => (
            <FilterMenu
              key={menu.dimension}
              title={menu.title}
              anyLabel={menu.anyLabel}
              anyCount={count(menu.dimension, null)}
              value={filters[menu.dimension]}
              options={menu.options.map((o) => ({ ...o, count: count(menu.dimension, o.value) }))}
              onChange={(value) => update({ [menu.dimension]: value } as Partial<EventFilters>)}
              align={menu.align}
            />
          ))}
        </div>
      </div>

      {filtered && (
        <div className="mt-2.5 flex items-center gap-3 text-data lg:mt-3.5 lg:text-small" aria-live="polite">
          <span className="font-semibold">
            {visible.length} {visible.length === 1 ? "event" : "events"}
          </span>
          <button
            type="button"
            onClick={clear}
            className="h-8 font-semibold text-muted-foreground underline underline-offset-[3px] transition-colors duration-fast hover:text-foreground"
          >
            Clear filters
          </button>
        </div>
      )}

      {visible.length > 0 ? (
        <ul className="mt-3.5 grid gap-3 lg:mt-6 lg:flex lg:flex-wrap lg:gap-5">
          {visible.map((item, i) => {
            const ratio = item.banner ? item.banner.width / item.banner.height : 16 / 9;
            return (
              <li
                key={item.id}
                style={{ "--ratio": ratio.toFixed(4) } as CSSProperties}
                className="min-w-0 lg:[flex:var(--ratio)_1_calc(var(--ratio)*14rem)]"
              >
                <EventBannerCard
                  href={`/events/${item.slug}`}
                  name={item.name}
                  dateLabel={item.dateLabel}
                  priceLabel={item.priceLabel}
                  banner={item.banner}
                  variant="wall"
                  priority={i < 2}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </li>
            );
          })}
          {/* Takes the slack on the last row so its banners don't stretch. */}
          <li aria-hidden="true" className="hidden lg:block lg:h-0 lg:flex-[1000000_1_0px]" />
        </ul>
      ) : (
        <div className="py-16 text-center lg:py-24">
          <p className="text-body font-bold">
            {items.length === 0 ? "No events coming up" : "No events match these filters"}
          </p>
          {items.length === 0 ? (
            <p className="mt-1 text-small text-muted-foreground">Check back soon.</p>
          ) : (
            <button
              type="button"
              onClick={clear}
              className="mt-4 h-11 rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground transition-opacity duration-fast hover:opacity-90"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
