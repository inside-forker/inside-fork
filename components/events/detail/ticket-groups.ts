import type { Event, TicketType } from "@/types/events.types";
import { eventDaySpan, formatKarachiDay } from "@/lib/events/datetime";

export interface TicketGroup {
  key: string;
  name: string;
  /** "Sat 28 Nov" for "Day N" groups of a multi-day event; null otherwise. */
  dateLabel: string | null;
  tickets: TicketType[];
}

/**
 * Tiers grouped by `group_name` in the order they arrive, with any ungrouped
 * tiers last as "General passes" (or "Tickets" when nothing is grouped).
 * A group named "Day 2" on a multi-day event gets that day's date.
 */
export function groupTickets(
  ticketTypes: TicketType[],
  event: Pick<Event, "start_time" | "end_time">,
): TicketGroup[] {
  const named = new Map<string, TicketType[]>();
  const ungrouped: TicketType[] = [];
  for (const t of ticketTypes) {
    const g = t.group_name?.trim();
    if (g) named.set(g, [...(named.get(g) ?? []), t]);
    else ungrouped.push(t);
  }

  const span = eventDaySpan(event.start_time, event.end_time);
  const dayDate = (name: string) => {
    const n = Number(/^day\s*(\d+)$/i.exec(name)?.[1]);
    if (!span || span.last === span.first || !n) return null;
    const index = span.first + n - 1;
    return index <= span.last ? formatKarachiDay(index) : null;
  };

  const groups: TicketGroup[] = [...named].map(([name, tickets]) => ({
    key: name,
    name,
    dateLabel: dayDate(name),
    tickets,
  }));
  if (ungrouped.length > 0) {
    groups.push({
      key: "__ungrouped",
      name: groups.length > 0 ? "General passes" : "Tickets",
      dateLabel: null,
      tickets: ungrouped,
    });
  }
  return groups;
}
