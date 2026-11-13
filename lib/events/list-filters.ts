import type { KarachiToday } from "@/lib/events/datetime";

/**
 * The /events filters (Date, Area, Type, Price and search). Pure functions,
 * shared by the page (reading the URL) and the browser (filtering live).
 */

/** What each event needs for filtering. */
export interface EventFilterFields {
  /** First and last Karachi day the event covers (days since the epoch). */
  firstDay: number;
  lastDay: number;
  area: string | null;
  /** Category slug, or null when the event has none. */
  category: string | null;
  /** Cheapest ticket, or null when the event sells none. */
  fromPrice: number | null;
  /** Name, venue, address and organizer, lower case. */
  searchText: string;
}

export type WhenKey = "today" | "tomorrow" | "weekend" | "week" | "month";
export type PriceKey = "free" | "under-1500" | "under-3000";
export type FilterDimension = "when" | "area" | "type" | "price";

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
}

export const WHEN_OPTIONS: readonly FilterOption<WhenKey>[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This weekend" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "This month" },
];

export const PRICE_OPTIONS: readonly FilterOption<PriceKey>[] = [
  { value: "free", label: "Free" },
  { value: "under-1500", label: "Under Rs 1,500" },
  { value: "under-3000", label: "Under Rs 3,000" },
];

export interface EventFilters {
  search: string;
  when: WhenKey | null;
  area: string | null;
  type: string | null;
  price: PriceKey | null;
}

export const NO_FILTERS: EventFilters = { search: "", when: null, area: null, type: null, price: null };

/** Karachi day range for a date option. The weekend runs Friday to Sunday. */
export function whenRange(when: WhenKey, today: KarachiToday): [number, number] {
  const t = today.index;
  const w = today.weekday;
  switch (when) {
    case "today":
      return [t, t];
    case "tomorrow":
      return [t + 1, t + 1];
    case "weekend":
      if (w === 0) return [t, t];
      if (w >= 5) return [t, t + (7 - w)];
      return [t + (5 - w), t + (7 - w)];
    case "week":
      return [t, t + 6];
    case "month":
      return [t, t + today.daysLeftInMonth];
  }
}

function matchesPrice(item: EventFilterFields, price: PriceKey): boolean {
  if (item.fromPrice == null) return false;
  if (price === "free") return item.fromPrice === 0;
  return item.fromPrice < (price === "under-1500" ? 1500 : 3000);
}

/** Does the event pass every filter, ignoring `skip` (used to count a menu's options)? */
export function matchesFilters(
  item: EventFilterFields,
  filters: EventFilters,
  today: KarachiToday,
  skip?: FilterDimension,
): boolean {
  const q = filters.search.trim().toLowerCase();
  if (q && !item.searchText.includes(q)) return false;
  if (skip !== "when" && filters.when) {
    const [lo, hi] = whenRange(filters.when, today);
    if (item.firstDay > hi || item.lastDay < lo) return false;
  }
  if (skip !== "area" && filters.area && item.area !== filters.area) return false;
  if (skip !== "type" && filters.type && item.category !== filters.type) return false;
  if (skip !== "price" && filters.price && !matchesPrice(item, filters.price)) return false;
  return true;
}

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Filters from the URL. Unknown values are dropped. The old `location` and
 * `category` params still work: a known area or type is picked, anything else
 * becomes the search.
 */
export function parseEventFilters(
  params: Params,
  known: { areas: readonly FilterOption[]; types: readonly FilterOption[] },
): EventFilters {
  const pick = <T extends string>(value: string, options: readonly FilterOption<T>[]) =>
    options.find((o) => o.value === value.toLowerCase() || o.label.toLowerCase() === value.toLowerCase())?.value ?? null;

  let search = first(params.search);
  const location = first(params.location);
  let area = pick(first(params.area), known.areas);
  if (!area && location) {
    area = pick(location, known.areas);
    if (!area && !search) search = location;
  }

  return {
    search,
    when: pick(first(params.when), WHEN_OPTIONS),
    area,
    type: pick(first(params.type) || first(params.category), known.types),
    price: pick(first(params.price), PRICE_OPTIONS),
  };
}

/** The query string for a set of filters ("" when none are on). */
export function filtersToQuery(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.when) params.set("when", filters.when);
  if (filters.area) params.set("area", filters.area);
  if (filters.type) params.set("type", filters.type);
  if (filters.price) params.set("price", filters.price);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
