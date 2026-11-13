import { query } from "@/lib/db";
import { EVENT_CARD_SQL_COLUMNS, EVENTS_FROM_SQL } from "@/lib/events/upcoming-query";
import { fetchPriceRangeByEventId, type EventPriceRange } from "@/lib/mobile/event-pricing";
import { getImageSize } from "@/lib/images/dimensions";
import { EVENT_AREAS, eventAreaKey } from "@/lib/events/areas";
import { eventDaySpan, formatEventDateLine, karachiToday, type KarachiToday } from "@/lib/events/datetime";
import type { EventFilterFields, FilterOption } from "@/lib/events/list-filters";

/** An event banner with its pixel size, so it can be laid out uncropped. */
export interface EventBanner {
  url: string;
  width: number;
  height: number;
}

export interface EventListItem extends EventFilterFields {
  id: number;
  slug: string;
  name: string;
  /** "Sat 14 Nov" or "Sat 28 – Sun 29 Nov". */
  dateLabel: string;
  /** "Rs 2,500", "From Rs 2,550", "Free", or null without tickets. */
  priceLabel: string | null;
  banner: EventBanner | null;
}

export interface EventsListData {
  items: EventListItem[];
  /** Areas and types that have events, for the filter menus. */
  areas: FilterOption[];
  types: FilterOption[];
  today: KarachiToday;
}

/** 16:9, for banners whose size can't be read. */
export const DEFAULT_BANNER_SIZE = { width: 1600, height: 900 };

const rs = (n: number) => `Rs ${n.toLocaleString("en-US")}`;

/** "Rs 2,500", "From Rs 2,550", "Free" or "Free – Rs 1,000"; null without tickets. */
export function eventPriceLabel(range: EventPriceRange | undefined): string | null {
  if (!range || range.from == null) return null;
  const to = range.to ?? range.from;
  if (range.from === 0) return to > 0 ? `Free – ${rs(to)}` : "Free";
  return to > range.from ? `From ${rs(range.from)}` : rs(range.from);
}

/** A banner with its real size (16:9 when it can't be read). */
export async function toEventBanner(url: string | null | undefined): Promise<EventBanner | null> {
  if (!url) return null;
  const size = (await getImageSize(url)) ?? DEFAULT_BANNER_SIZE;
  return { url, ...size };
}

/** Published events that haven't ended, soonest first, ready for /events. */
export async function loadEventsList(now = new Date()): Promise<EventsListData> {
  const { rows } = await query(
    `SELECT ${EVENT_CARD_SQL_COLUMNS}
     FROM ${EVENTS_FROM_SQL}
     WHERE e.status = 'published' AND e.end_time >= now()
     ORDER BY e.start_time ASC, e.id ASC
     LIMIT 200`,
  );
  const events = (rows as Record<string, unknown>[]).filter(
    (r) => r.event_id != null && typeof r.event_name === "string" && typeof r.event_slug === "string" && r.start_time,
  );
  const ids = events.map((r) => Number(r.event_id));

  const [{ rows: imageRows }, prices] = await Promise.all([
    ids.length
      ? query(
          `SELECT DISTINCT ON (event_id) event_id, url
           FROM event_images
           WHERE event_id = ANY($1)
           ORDER BY event_id, is_primary DESC NULLS LAST, display_order ASC NULLS LAST, id ASC`,
          [ids],
        )
      : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
    fetchPriceRangeByEventId(ids),
  ]);
  const imageByEvent = new Map<number, string>(
    (imageRows as { event_id: number; url: string }[]).map((r) => [Number(r.event_id), r.url]),
  );

  // TEMP PREVIEW ONLY (tracked as INSID-238), same as the event page.
  if (!imageByEvent.has(85)) imageByEvent.set(85, "/tmp-preview-farmhouse.jpg");

  const banners = await Promise.all(ids.map((id) => toEventBanner(imageByEvent.get(id))));

  const types = new Map<string, string>();
  const items: EventListItem[] = events.map((r, i) => {
    const id = ids[i];
    const start = String(r.start_time);
    const end = String(r.end_time ?? r.start_time);
    const span = eventDaySpan(start, end);
    const locationName = (r.location_name as string | null) ?? null;
    const address = (r.address as string | null) ?? null;
    const categorySlug = (r.category_slug as string | null) ?? null;
    if (categorySlug && typeof r.category_name === "string") types.set(categorySlug, r.category_name);
    const range = prices.get(id);

    return {
      id,
      slug: String(r.event_slug),
      name: String(r.event_name),
      dateLabel: formatEventDateLine(start, end),
      priceLabel: eventPriceLabel(range),
      banner: banners[i],
      firstDay: span?.first ?? 0,
      lastDay: span?.last ?? 0,
      area: eventAreaKey(locationName, address),
      category: categorySlug,
      fromPrice: range?.from ?? null,
      searchText: [r.event_name, locationName, address, r.organizer_name]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ")
        .toLowerCase(),
    };
  });

  const usedAreas = new Set(items.map((item) => item.area));
  return {
    items,
    areas: EVENT_AREAS.filter((a) => usedAreas.has(a.key)).map((a) => ({ value: a.key, label: a.label })),
    types: [...types].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    today: karachiToday(now),
  };
}
