"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { Section } from "@/components/ds";
import { EventBannerCard } from "@/components/events/EventBannerCard";
import { FilterMenu } from "@/components/events/list/FilterMenu";
import type { EventListItem } from "@/lib/events/list";
import { cn } from "@/lib/utils";
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

/** "From Rs 2,250" reads as "From" over "Rs 2,250", as on the homepage. */
function splitPrice(label: string): [string, string] {
  return label.startsWith("From ") ? ["From", label.slice(5)] : ["Tickets", label];
}

const WRAP = "mx-auto w-full max-w-[1200px] px-5 lg:px-8";

/**
 * One event on a short ink band above the wall. Phones show its banner card
 * (the same as the wall's); desktop puts a smaller whole banner beside the
 * details and Get tickets.
 */
function Spotlight({ item }: { item: EventListItem }) {
  const href = `/events/${item.slug}`;
  const price = item.priceLabel ? splitPrice(item.priceLabel) : null;
  return (
    <Section
      tone="ink"
      size="sm"
      aria-labelledby="events-spotlight"
      className="mt-5 pb-[22px] pt-5 md:pb-[22px] md:pt-5 lg:mt-7 lg:pb-8 lg:pt-7"
    >
      <div className={WRAP}>
        <h2
          id="events-spotlight"
          className="mb-3 text-[17px] font-bold leading-[22px] tracking-[-0.01em] lg:sr-only"
        >
          Spotlight
        </h2>
        <EventBannerCard
          href={href}
          name={item.name}
          dateLabel={item.dateLabel}
          priceLabel={item.priceLabel}
          banner={item.banner}
          variant="wall"
          priority
          sizes="100vw"
          className="bg-cream/10 lg:hidden"
        />
        <div className="hidden lg:grid lg:grid-cols-[416px_minmax(0,1fr)] lg:items-center lg:gap-9">
          <Link href={href} tabIndex={-1} aria-hidden="true" className="group block overflow-hidden rounded-media bg-cream/10">
            {item.banner ? (
              <Image
                src={item.banner.url}
                alt=""
                width={item.banner.width}
                height={item.banner.height}
                sizes="416px"
                className="block h-auto w-full transition-transform duration-slow ease-standard group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            ) : (
              <span className="block aspect-video" />
            )}
          </Link>
          <div className="min-w-0">
            <p className="text-label font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Spotlight · {item.whenLabel}
            </p>
            <h3 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">
              <Link href={href} className="hover:underline">
                {item.name}
              </Link>
            </h3>
            {item.venue && <p className="mt-1.5 text-[15px] text-muted-foreground">{item.venue}</p>}
            <div className="mt-5 flex items-center gap-5">
              {price && (
                <p className="text-data text-muted-foreground">
                  {price[0]}
                  <strong className="block text-[19px] leading-6 text-foreground">{price[1]}</strong>
                </p>
              )}
              <Link
                href={href}
                className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-body font-semibold text-primary-foreground outline-none transition-opacity duration-fast hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {item.priceLabel ? "Get tickets" : "View event"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

interface Menu {
  dimension: FilterDimension;
  title: string;
  anyLabel: string;
  options: readonly FilterOption[];
  align: "start" | "end";
}

/**
 * /events: the search, the filter pills, one spotlight event on a short ink
 * band, then the banner wall. Phones stack the banners; from lg they sit in
 * justified rows (each banner grows by its aspect ratio, so a row shares one
 * height and nothing is cropped).
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

  // The spotlight: the soonest event with tickets (else the soonest), only on
  // the unfiltered list and only while the wall still has events under it.
  const spotlight = !filtered && items.length >= 2 ? (items.find((item) => item.priceLabel) ?? items[0]) : null;
  const wall = spotlight ? visible.filter((item) => item.id !== spotlight.id) : visible;

  return (
    <>
      <div className={cn(WRAP, "pt-4 lg:pt-8")}>
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

      </div>

      {spotlight && <Spotlight item={spotlight} />}

      <div className={cn(WRAP, "pb-12 lg:pb-16")}>
        {visible.length > 0 ? (
          <ul className={cn("grid gap-3 lg:flex lg:flex-wrap lg:gap-5", spotlight ? "mt-6 lg:mt-10" : "mt-3.5 lg:mt-6")}>
            {wall.map((item, i) => {
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
                    priority={!spotlight && i < 2}
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
    </>
  );
}
