import { EventsBrowser } from "@/components/events/list/EventsBrowser";
import { loadEventsList } from "@/lib/events/list";
import { parseEventFilters } from "@/lib/events/list-filters";

interface EventsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** /events: every upcoming event as its banner, with Date, Area, Type and Price filters. */
export default async function EventsPage({ searchParams }: EventsPageProps) {
  const [params, data] = await Promise.all([searchParams, loadEventsList()]);
  const initialFilters = parseEventFilters(params, { areas: data.areas, types: data.types });

  return (
    <div className="min-h-screen bg-background">
      <EventsBrowser
        items={data.items}
        areas={data.areas}
        types={data.types}
        today={data.today}
        initialFilters={initialFilters}
      />
    </div>
  );
}
